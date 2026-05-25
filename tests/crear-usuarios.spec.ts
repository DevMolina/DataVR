import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';
import { generarRegistros, RegistroUsuario } from '../src/generators/userGenerator';
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
let exitosos = 0;
let fallidos = 0;

// ---- Un test por registro → aparece individualmente en el reporte HTML ----
for (const [index, registro] of registros.entries()) {
  const label = `[${index + 1}/${registros.length}] ${registro.documentType} ${registro.identifier} — ${registro.firstName} ${registro.lastName}`.trim();

  test(label, async ({ request }, testInfo) => {
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
    if (response.ok()) {
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
  console.log('\n╔══════════════════════════════╗');
  console.log(`║       RESUMEN EJECUCIÓN      ║`);
  console.log(`╠══════════════════════════════╣`);
  console.log(`║ Total    : ${String(total).padEnd(19)}║`);
  console.log(`║ Exitosos : ${String(exitosos).padEnd(19)}║`);
  console.log(`║ Fallidos : ${String(fallidos).padEnd(19)}║`);
  console.log('╚══════════════════════════════╝\n');
});
