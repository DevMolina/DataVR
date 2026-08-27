// Suite de casos positivos de valores límite / clases de equivalencia para
// el body de POST /settings-users/api/v1/usersCl. Complementa a
// tests/crear-usuarios.spec.ts (que ya cubre el caso general con datos
// aleatorios) probando explícitamente los bordes de reglas conocidas por el
// código del generador (ver src/testing/mutaciones.ts → CASOS_POSITIVOS_LIMITE):
// category en 1 y 7 (límites del rango generado), y optionalPhone con un
// valor real en vez de null (confirma que el campo acepta dato, no solo null).
//
// A diferencia de la suite de casos negativos, estos SÍ crean registros
// reales, así que reutiliza los mismos helpers de unicidad contra Oracle que
// tests/crear-usuarios.spec.ts.
import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';
import * as fs from 'fs';
import * as path from 'path';
import { generarPersonaNatural, generarPersonaJuridica } from '../../src/generators/userGenerator';
import { CASOS_POSITIVOS_LIMITE } from '../../src/testing/mutaciones';
import { esResultadoAceptable, etiquetaResultado } from '../../src/testing/httpCodes';
import { validarFormatoRegistro, asegurarPlacaUnica, asegurarContactoUnico, AttachFn } from '../../src/testing/registroHelpers';
import { cerrarPoolOracle } from '../../src/db/oracle';
import { CONFIG } from '../../config';

const epcPath = path.resolve(__dirname, '..', '..', CONFIG.EPC_FILE);
const epcs: string[] = fs.existsSync(epcPath)
  ? fs.readFileSync(epcPath, 'utf-8').split('\n').map((e) => e.trim()).filter(Boolean)
  : [];

for (const caso of CASOS_POSITIVOS_LIMITE) {
  const label = `[POS-LIMITE] ${caso.aplicaA} — ${caso.nombre}`;

  test(label, async ({ request }, testInfo) => {
    const attach: AttachFn = (name, opts) => testInfo.attach(name, opts);
    const epc = epcs.length > 0 ? faker.helpers.arrayElement(epcs) : '';
    const base = caso.aplicaA === 'NIT' ? generarPersonaJuridica(epc) : generarPersonaNatural(epc);
    const registro = caso.aplicar(base);

    validarFormatoRegistro(registro);
    await asegurarPlacaUnica(registro, attach);
    await asegurarContactoUnico(registro, attach);

    const response = await request.post('/settings-users/api/v1/usersCl', { data: registro });
    const responseBody = await response.json().catch(() => ({}));
    const responseText = JSON.stringify(responseBody, null, 2);
    const status = response.status();

    await testInfo.attach('Request', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify(registro, null, 2)),
    });
    await testInfo.attach(`Response HTTP ${status}`, {
      contentType: 'application/json',
      body: Buffer.from(responseText),
    });

    testInfo.annotations.push({ type: etiquetaResultado(status), description: `HTTP ${status} — ${caso.nombre}` });

    expect(esResultadoAceptable(status), `HTTP ${status} → ${responseText}`).toBe(true);
  });
}

test.afterAll(async () => {
  await cerrarPoolOracle();
});
