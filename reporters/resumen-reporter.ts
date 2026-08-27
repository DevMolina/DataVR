import * as fs from 'fs';
import * as path from 'path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { HTTP_EXITOSO, HTTP_PARCIAL_ENROLAMIENTO_FALLIDO } from '../src/testing/httpCodes';

interface FilaResumen {
  index: number;
  tipoDoc: string;
  documento: string;
  nombre: string;
  apellido: string;
  representante: string;
  email: string;
  telefono: string;
  departamento: string;
  municipio: string;
  placa: string;
  categoria: number;
  epc: string;
  http: number;
  resultado: string;
}

interface FilaCasoValidacion {
  documentType: string;
  campo: string;
  caso: string;
  descripcion: string;
  httpEsperado: number;
  httpReal: number;
  correcto: boolean;
  bugConocido: boolean;
}

// Escapa el contenido de una celda para no romper el formato de tabla Markdown.
function celda(valor: unknown): string {
  return String(valor ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

// Timestamp seguro para nombre de archivo, ej. 2026-08-25_15-30-05.
function timestampArchivo(fecha: Date): string {
  return fecha.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
}

// Agrega en el proceso principal los resultados de TODOS los workers (leídos desde
// el adjunto 'ResumenFila' de cada test) y escribe la tabla final en Markdown.
export default class ResumenReporter implements Reporter {
  private filas: FilaResumen[] = [];
  private filasValidacion: FilaCasoValidacion[] = [];

  onTestEnd(_test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find((a) => a.name === 'ResumenFila');
    if (attachment?.body) {
      try {
        this.filas.push(JSON.parse(attachment.body.toString('utf-8')) as FilaResumen);
      } catch {
        // Adjunto malformado: se ignora esa fila en el resumen.
      }
    }

    const attachmentValidacion = result.attachments.find((a) => a.name === 'ResumenCasoValidacion');
    if (attachmentValidacion?.body) {
      try {
        this.filasValidacion.push(JSON.parse(attachmentValidacion.body.toString('utf-8')) as FilaCasoValidacion);
      } catch {
        // Adjunto malformado: se ignora esa fila en el resumen.
      }
    }
  }

  onEnd(): void {
    if (this.filas.length > 0) {
      this.reportarRegistrosCreados();
    }
    if (this.filasValidacion.length > 0) {
      this.reportarCasosValidacion();
    }
    if (this.filas.length === 0 && this.filasValidacion.length === 0) {
      console.warn('\n[REPORTE] No se capturó ninguna fila de resumen (¿se canceló la corrida antes de terminar?)\n');
    }
  }

  private reportarRegistrosCreados(): void {
    this.filas.sort((a, b) => a.index - b.index);

    const total = this.filas.length;
    const exitosos = this.filas.filter((f) => f.http === HTTP_EXITOSO).length;
    const parciales = this.filas.filter((f) => f.http === HTTP_PARCIAL_ENROLAMIENTO_FALLIDO).length;
    const fallidos = total - exitosos - parciales;

    // ── Resumen de consola en formato tabla ──
    console.log('\n[REPORTE] Resumen de ejecución:');
    console.table({
      Total: total,
      'Exitosos (200)': exitosos,
      'Parciales (204, enrolamiento fallido)': parciales,
      Fallidos: fallidos,
    });
    console.table(
      this.filas.map((f, i) => ({
        '#': i + 1,
        Tipo: f.tipoDoc,
        Documento: f.documento,
        'Nombre/Razón Social': f.nombre,
        Placa: f.placa,
        HTTP: f.http,
        Resultado: f.resultado,
      }))
    );

    // ── Tabla Markdown con los datos enviados en cada petición ──
    const encabezados = ['#', 'Tipo', 'Documento', 'Nombre/Razón Social', 'Apellido', 'Repr. Legal', 'Email', 'Teléfono', 'Departamento', 'Municipio', 'Placa', 'Categoría', 'EPC', 'HTTP', 'Resultado'];
    const filasMd = this.filas.map((f, i) =>
      `| ${[i + 1, f.tipoDoc, f.documento, f.nombre, f.apellido, f.representante, f.email, f.telefono, f.departamento, f.municipio, f.placa, f.categoria, f.epc, f.http, f.resultado].map(celda).join(' | ')} |`
    );

    const fecha = new Date();
    const lineas = [
      '# Resumen de registros creados',
      '',
      `Generado: ${fecha.toISOString()}`,
      '',
      `- Total: ${total}`,
      `- Exitosos (200): ${exitosos}`,
      `- Parciales (204, enrolamiento fallido): ${parciales}`,
      `- Fallidos: ${fallidos}`,
      '',
      `| ${encabezados.join(' | ')} |`,
      `|${encabezados.map(() => '---').join('|')}|`,
      ...filasMd,
      '',
    ];

    const outDir = path.resolve(__dirname, '..', 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    // Un archivo nuevo por corrida (no se sobrescribe la corrida anterior).
    const outPath = path.join(outDir, `resumen-registros_${timestampArchivo(fecha)}.md`);
    fs.writeFileSync(outPath, lineas.join('\n'), 'utf-8');

    console.log(`[REPORTE] Resumen Markdown generado en: ${outPath}\n`);
  }

  // Resumen de tests/casos-negativos/*: por cada campo mutado, compara el
  // HTTP real contra la línea base medida (src/testing/mutaciones.ts). No
  // asume que el API "debería" rechazar con un código dado — documenta si el
  // comportamiento se mantiene igual a la última medición o cambió
  // (regresión de contrato). Los bugConocido=true (500, crash del servidor)
  // se cuentan aparte: coincidir con la línea base ahí NO significa que el
  // comportamiento esté bien, solo que no empeoró.
  private reportarCasosValidacion(): void {
    const total = this.filasValidacion.length;
    const correctos = this.filasValidacion.filter((f) => f.correcto).length;
    const inesperados = total - correctos;
    const bugsConocidos = this.filasValidacion.filter((f) => f.bugConocido).length;

    console.log('\n[REPORTE] Resumen de casos de validación del endpoint:');
    console.table({
      Total: total,
      'Igual a línea base': correctos,
      'Cambió respecto a línea base': inesperados,
      'Bugs conocidos (500, servidor cae)': bugsConocidos,
    });
    if (inesperados > 0) {
      console.table(
        this.filasValidacion
          .filter((f) => !f.correcto)
          .map((f) => ({
            Tipo: f.documentType,
            Campo: f.campo,
            Caso: f.caso,
            'HTTP línea base': f.httpEsperado,
            'HTTP real': f.httpReal,
          }))
      );
    }

    const encabezados = ['Tipo', 'Campo', 'Caso', 'Descripción', 'HTTP línea base', 'HTTP real', '¿Bug conocido?', 'Resultado'];
    const filasMd = this.filasValidacion.map((f) =>
      `| ${[f.documentType, f.campo, f.caso, f.descripcion, f.httpEsperado, f.httpReal, f.bugConocido ? 'Sí (500, crash)' : 'No', f.correcto ? '✅ Igual a línea base' : '⚠️ Cambió'].map(celda).join(' | ')} |`
    );

    const fecha = new Date();
    const lineas = [
      '# Resumen de casos de validación del endpoint',
      '',
      `Generado: ${fecha.toISOString()}`,
      '',
      'Compara cada caso contra la línea base medida en `src/testing/mutaciones.ts` ' +
        '(comportamiento real observado del API, no el ideal). Un caso "Cambió" es una ' +
        'regresión de contrato a revisar; no implica que el comportamiento anterior fuera correcto.',
      '',
      `- Total de casos: ${total}`,
      `- Igual a línea base: ${correctos}`,
      `- Cambió respecto a línea base: ${inesperados}`,
      `- Bugs conocidos (500, el servidor cae en vez de rechazar limpiamente): ${bugsConocidos}`,
      '',
      `| ${encabezados.join(' | ')} |`,
      `|${encabezados.map(() => '---').join('|')}|`,
      ...filasMd,
      '',
    ];

    const outDir = path.resolve(__dirname, '..', 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `casos-validacion_${timestampArchivo(fecha)}.md`);
    fs.writeFileSync(outPath, lineas.join('\n'), 'utf-8');

    console.log(`[REPORTE] Resumen de casos de validación generado en: ${outPath}\n`);
  }
}
