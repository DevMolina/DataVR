// Suite de validación negativa del body de POST /settings-users/api/v1/usersCl.
// Por cada campo relevante se envía una variante inválida (ausente, vacía,
// con formato incorrecto, fuera de rango o inconsistente con otro campo) y
// se compara contra el HTTP que el API realmente devuelve hoy (línea base
// medida en src/testing/mutaciones.ts → CASOS_NEGATIVOS). Esta suite existe
// para detectar REGRESIONES de contrato (que un caso empiece a responder
// distinto a lo documentado), no para exigir que el API valide "bien" —
// la mayoría de campos hoy NO se validan (ver README → "Validación del
// endpoint"). Los casos con `bugConocido: true` esperan un 500 (crash del
// servidor) y se marcan aparte en el reporte.
//
// No depende de Oracle: los registros base se generan frescos en cada test
// (nunca se reutiliza uno fijo entre casos) para que una eventual aceptación
// inesperada de un caso no contamine con datos duplicados a los siguientes.
import { test, expect } from '@playwright/test';
import { generarPersonaNatural, generarPersonaJuridica } from '../../src/generators/userGenerator';
import { CASOS_NEGATIVOS, TipoDocumentoAplicable, httpEsperadoPara } from '../../src/testing/mutaciones';

const EPC_PLACEHOLDER = 'EPC-CASO-NEGATIVO';

interface CasoEjecutable {
  documentType: 'CC' | 'NIT';
  caso: (typeof CASOS_NEGATIVOS)[number];
}

function aplicaA(aplicaA: TipoDocumentoAplicable, documentType: 'CC' | 'NIT'): boolean {
  return aplicaA === 'AMBOS' || aplicaA === documentType;
}

const casosEjecutables: CasoEjecutable[] = [];
for (const caso of CASOS_NEGATIVOS) {
  (['CC', 'NIT'] as const).forEach((documentType) => {
    if (aplicaA(caso.aplicaA, documentType)) {
      casosEjecutables.push({ documentType, caso });
    }
  });
}

for (const { documentType, caso } of casosEjecutables) {
  const httpEsperado = httpEsperadoPara(caso, documentType);
  const prefijo = caso.bugConocido ? '[NEG][BUG CONOCIDO]' : '[NEG]';
  const label = `${prefijo} ${documentType} ${caso.campo}/${caso.caso} — ${caso.descripcion}`;

  test(label, async ({ request }, testInfo) => {
    const base = documentType === 'NIT' ? generarPersonaJuridica(EPC_PLACEHOLDER) : generarPersonaNatural(EPC_PLACEHOLDER);
    const body = caso.aplicar(base);

    const response = await request.post('/settings-users/api/v1/usersCl', { data: body });
    const responseBody = await response.json().catch(() => ({}));
    const status = response.status();

    await testInfo.attach('Request', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify(body, null, 2)),
    });
    await testInfo.attach(`Response HTTP ${status}`, {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify(responseBody, null, 2)),
    });

    const coincideConLineaBase = status === httpEsperado;
    testInfo.annotations.push({
      type: coincideConLineaBase
        ? (caso.bugConocido ? '🐞 Bug conocido (sin cambios)' : '✅ Igual a línea base')
        : `⚠️ Cambió respecto a línea base (HTTP ${status})`,
      description: `${caso.campo}/${caso.caso} — esperado ${httpEsperado}`,
    });

    // Fila para el resumen Markdown de casos de validación (reporters/resumen-reporter.ts)
    await testInfo.attach('ResumenCasoValidacion', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({
        documentType,
        campo: caso.campo,
        caso: caso.caso,
        descripcion: caso.descripcion,
        httpEsperado,
        httpReal: status,
        correcto: coincideConLineaBase,
        bugConocido: caso.bugConocido ?? false,
      })),
    });

    expect(
      status,
      `[${caso.campo}/${caso.caso}] línea base = HTTP ${httpEsperado}, pero llegó HTTP ${status} → ${JSON.stringify(responseBody)}. ` +
      'Si el API cambió a propósito, actualiza httpEsperado en src/testing/mutaciones.ts.'
    ).toBe(httpEsperado);
  });
}
