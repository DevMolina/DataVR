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

// ---- Contadores globales para el resumen final ----
let exitosos = 0;   // HTTP 200: registro + enrolamiento OK
let parciales = 0;  // HTTP 205: registro OK, enrolamiento FALLIDO
let fallidos = 0;

const MAX_INTENTOS_PLACA = 50;

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

    // ── Adjuntos visibles en el reporte HTML ──
    await testInfo.attach('Request', {
      contentType: 'application/json',
      body: Buffer.from(requestBody),
    });
    await testInfo.attach(`Response HTTP ${status}`, {
      contentType: 'application/json',
      body: Buffer.from(responseText),
    });

    // ── Log en consola ──
    if (status === 205) {
      parciales++;
      testInfo.annotations.push({
        type: 'enrolamiento-fallido',
        description: `Usuario ${registro.identifier} registrado, pero el enrolamiento falló (HTTP 205)`,
      });
      console.warn(`⚠ ${registro.identifier} | ${registro.email} | placa: ${registro.plate} | HTTP 205 (registro OK, enrolamiento FALLIDO)`);
      console.warn(`  REQUEST : ${requestBody}`);
      console.warn(`  RESPONSE: ${responseText}`);
    } else if (response.ok()) {
      exitosos++;
      console.log(`✓ ${registro.identifier} | ${registro.email} | placa: ${registro.plate}`);
      console.log(`  REQUEST : ${requestBody}`);
      console.log(`  RESPONSE: ${responseText}`);
    } else {
      fallidos++;
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

// ---- Test de resumen: siempre corre al final ----
test.afterAll(() => {
  const total = registros.length;
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║            RESUMEN EJECUCIÓN              ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║ Total                    : ${String(total).padEnd(15)}║`);
  console.log(`║ Exitosos (200)           : ${String(exitosos).padEnd(15)}║`);
  console.log(`║ Parciales (205, enrol. X): ${String(parciales).padEnd(15)}║`);
  console.log(`║ Fallidos                 : ${String(fallidos).padEnd(15)}║`);
  console.log('╚══════════════════════════════════════════╝\n');
});

// ---- Cierre del pool de conexiones Oracle ----
test.afterAll(async () => {
  await cerrarPoolOracle();
});
