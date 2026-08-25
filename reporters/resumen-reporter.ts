import * as fs from 'fs';
import * as path from 'path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

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

  onTestEnd(_test: TestCase, result: TestResult): void {
    const attachment = result.attachments.find((a) => a.name === 'ResumenFila');
    if (!attachment?.body) return;
    try {
      this.filas.push(JSON.parse(attachment.body.toString('utf-8')) as FilaResumen);
    } catch {
      // Adjunto malformado: se ignora esa fila en el resumen.
    }
  }

  onEnd(): void {
    if (this.filas.length === 0) {
      console.warn('\n[REPORTE] No se capturó ninguna fila de resumen (¿se canceló la corrida antes de terminar?)\n');
      return;
    }

    this.filas.sort((a, b) => a.index - b.index);

    const total = this.filas.length;
    const exitosos = this.filas.filter((f) => f.http === 200).length;
    const parciales = this.filas.filter((f) => f.http === 205).length;
    const fallidos = total - exitosos - parciales;

    // ── Resumen de consola en formato tabla ──
    console.log('\n[REPORTE] Resumen de ejecución:');
    console.table({
      Total: total,
      'Exitosos (200)': exitosos,
      'Parciales (205, enrolamiento fallido)': parciales,
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
      `- Parciales (205, enrolamiento fallido): ${parciales}`,
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
}
