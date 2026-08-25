import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';
import { generarRegistros, generarPlaca, RegistroUsuario } from '../src/generators/userGenerator';
import { placaExiste, cerrarPoolOracle } from '../src/db/oracle';
import { CONFIG } from '../config';

// Semilla fija: garantiza que faker genere los mismos datos en el proceso
// de colección de tests y en el worker de ejecución (evita "Test not found").
faker.seed(42);

// ---- Lectura de EPCs ----
const epcPath = path.resolve(__dirname, '..', CONFIG.EPC_FILE);
const epcs: string[] = fs.existsSync(epcPath)
  ? fs.readFileSync(epcPath, 'utf-8')
      .split('\n')
      .map((e) => e.trim())
      .filter(Boolean)
  : [];

if (epcs.length === 0) {
  console.warn('[ADVERTENCIA] No se encontraron EPCs en', epcPath);
}

// ---- Generación de datos (en tiempo de carga del módulo) ----
const registros: RegistroUsuario[] = generarRegistros(epcs);

console.log(`\n[INICIO] Registros a crear: ${registros.length}`);
console.log(`[INICIO] EPCs disponibles : ${epcs.length}`);

const MAX_INTENTOS_PLACA = 50;

function etiquetaResultado(status: number): string {
  if (status === 200) return '✅ Exitoso';
  if (status === 205) return '⚠️ Parcial (enrolamiento fallido)';
  return `❌ Fallido (HTTP ${status})`;
}

// Regenera la placa del registro mientras ya exista en la base de datos Oracle.
async function asegurarPlacaUnica(registro: RegistroUsuario, testInfo: { attach: (name: string, opts: { contentType: string; body: Buffer }) => Promise<void> }): Promise<void> {
  let intentos = 0;
  while (await placaExiste(registro.plate)) {
    intentos++;
    if (intentos > MAX_INTENTOS_PLACA) {
      throw new Error(
        `No se pudo generar una placa única para ${registro.identifier} tras ${MAX_INTENTOS_PLACA} intentos (¿rango de letras agotado?)`
      );
    }
    const placaAnterior = registro.plate;
    registro.plate = generarPlaca(CONFIG.RANGO_LETRA_INICIAL_PLACA);
    console.warn(`↻ Placa duplicada en BD (${placaAnterior}), regenerando → ${registro.plate}`);
  }
  if (intentos > 0) {
    await testInfo.attach('Placas descartadas por duplicado', {
      contentType: 'text/plain',
      body: Buffer.from(`${intentos} intento(s) hasta obtener una placa libre: ${registro.plate}`),
    });
  }
}

// ---- Un test por registro → aparece individualmente en el reporte HTML ----
for (const [index, registro] of registros.entries()) {
  const label = `[${index + 1}/${registros.length}] ${registro.documentType} ${registro.identifier} — ${registro.firstName} ${registro.lastName}`.trim();

  test(label, async ({ request }, testInfo) => {
    await asegurarPlacaUnica(registro, testInfo);

    const requestBody = JSON.stringify(registro, null, 2);

    const response = await request.post('/settings-users/api/v1/usersCl', {
      data: registro,
    });

    const responseBody = await response.json().catch(() => ({}));
    const responseText = JSON.stringify(responseBody, null, 2);
    const status = response.status();
    const resultado = etiquetaResultado(status);

    // ── Adjuntos visibles en el reporte HTML ──
    await testInfo.attach('Request', {
      contentType: 'application/json',
      body: Buffer.from(requestBody),
    });
    await testInfo.attach(`Response HTTP ${status}`, {
      contentType: 'application/json',
      body: Buffer.from(responseText),
    });

    // Fila de datos para el resumen Markdown final (leída por reporters/resumen-reporter.ts)
    await testInfo.attach('ResumenFila', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({
        index,
        tipoDoc: registro.documentType,
        documento: registro.identifier,
        nombre: registro.firstName,
        apellido: registro.lastName,
        representante: registro.legalRepresentativeName ?? '',
        email: registro.email,
        telefono: registro.phone,
        departamento: registro.department,
        municipio: registro.locationId,
        placa: registro.plate,
        categoria: registro.category,
        epc: registro.epc,
        http: status,
        resultado,
      })),
    });

    // ── Anotación visible junto al título en el listado del reporte ──
    testInfo.annotations.push({ type: 'Resultado', description: resultado });

    // ── Log en consola ──
    if (status === 205) {
      console.warn(`⚠ ${registro.identifier} | ${registro.email} | placa: ${registro.plate} | HTTP 205 (registro OK, enrolamiento FALLIDO)`);
      console.warn(`  REQUEST : ${requestBody}`);
      console.warn(`  RESPONSE: ${responseText}`);
    } else if (response.ok()) {
      console.log(`✓ ${registro.identifier} | ${registro.email} | placa: ${registro.plate}`);
      console.log(`  REQUEST : ${requestBody}`);
      console.log(`  RESPONSE: ${responseText}`);
    } else {
      console.error(`✗ ${registro.identifier} | HTTP ${status}`);
      console.error(`  REQUEST : ${requestBody}`);
      console.error(`  RESPONSE: ${responseText}`);
    }

    expect(
      response.ok(),
      `HTTP ${status} → ${responseText}`
    ).toBe(true);
  });
}

// El resumen agregado (Exitosos/Parciales/Fallidos + tabla Markdown) lo genera
// reporters/resumen-reporter.ts en onEnd(), ya que se ejecuta una sola vez en el
// proceso principal con los resultados de TODOS los workers (aquí, con
// `workers: 3`, un afterAll por worker solo vería un subconjunto de registros).

// ---- Cierre del pool de conexiones Oracle ----
test.afterAll(async () => {
  await cerrarPoolOracle();
});
