import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { faker } from '@faker-js/faker';
import {
  generarRegistros,
  generarPlaca,
  generarIdentificadorNatural,
  generarIdentificadorJuridico,
  generarEmailNatural,
  generarEmailJuridico,
  RegistroUsuario,
} from '../src/generators/userGenerator';
import { placaExiste, identificadorExiste, emailExiste, cerrarPoolOracle } from '../src/db/oracle';
import { validarIdentificador } from '../src/validators/identificador';
import { validarEmail } from '../src/validators/email';
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
const MAX_INTENTOS_CONTACTO = 50;

// Códigos de respuesta del servicio de registro de usuarios:
//   200 → registro y enrolamiento exitosos
//   204 → registro exitoso, pero el enrolamiento falló (resultado parcial, no bloqueante)
//   205 → falló la creación del usuario
const HTTP_EXITOSO = 200;
const HTTP_PARCIAL_ENROLAMIENTO_FALLIDO = 204;

function etiquetaResultado(status: number): string {
  if (status === HTTP_EXITOSO) return '✅ Exitoso';
  if (status === HTTP_PARCIAL_ENROLAMIENTO_FALLIDO) return '⚠️ Parcial (enrolamiento fallido)';
  return `❌ Fallido (HTTP ${status})`;
}

// Un resultado se considera aceptable para el test (no lo hace fallar) cuando
// el registro del usuario se creó, sin importar si el enrolamiento falló.
function esResultadoAceptable(status: number): boolean {
  return status === HTTP_EXITOSO || status === HTTP_PARCIAL_ENROLAMIENTO_FALLIDO;
}

// Valida el FORMATO del identificador y del email generados antes de enviar
// la petición (defensivo: el generador ya debería producir datos válidos,
// pero esto detecta regresiones sin necesidad de llegar hasta el API).
function validarFormatoRegistro(registro: RegistroUsuario): void {
  const resultadoId = validarIdentificador(registro.documentType, registro.identifier);
  if (!resultadoId.valido) {
    throw new Error(`Identificador generado inválido: ${resultadoId.error}`);
  }
  const resultadoEmail = validarEmail(registro.email);
  if (!resultadoEmail.valido) {
    throw new Error(`Email generado inválido: ${resultadoEmail.error}`);
  }
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
    registro.plate = generarPlaca(CONFIG.RANGO_LETRA_INICIAL_PLACA, CONFIG.FORMATOS_PLACA);
    console.warn(`↻ Placa duplicada en BD (${placaAnterior}), regenerando → ${registro.plate}`);
  }
  if (intentos > 0) {
    await testInfo.attach('Placas descartadas por duplicado', {
      contentType: 'text/plain',
      body: Buffer.from(`${intentos} intento(s) hasta obtener una placa libre: ${registro.plate}`),
    });
  }
}

// Regenera el identificador y/o el email del registro mientras ya existan en
// CONTACTS (campos USER_ID y EMAIL respectivamente). Evita enviar al API
// datos de prueba que colisionarían con contactos ya existentes.
async function asegurarContactoUnico(registro: RegistroUsuario, testInfo: { attach: (name: string, opts: { contentType: string; body: Buffer }) => Promise<void> }): Promise<void> {
  let intentosId = 0;
  while (await identificadorExiste(registro.identifier)) {
    intentosId++;
    if (intentosId > MAX_INTENTOS_CONTACTO) {
      throw new Error(
        `No se pudo generar un identificador único para ${registro.documentType} tras ${MAX_INTENTOS_CONTACTO} intentos`
      );
    }
    const anterior = registro.identifier;
    registro.identifier = registro.documentType === 'NIT' ? generarIdentificadorJuridico() : generarIdentificadorNatural();
    console.warn(`↻ Identificador duplicado en CONTACTS (${anterior}), regenerando → ${registro.identifier}`);
  }

  let intentosEmail = 0;
  while (await emailExiste(registro.email)) {
    intentosEmail++;
    if (intentosEmail > MAX_INTENTOS_CONTACTO) {
      throw new Error(
        `No se pudo generar un email único para ${registro.identifier} tras ${MAX_INTENTOS_CONTACTO} intentos`
      );
    }
    const anterior = registro.email;
    const nuevoEmail = registro.documentType === 'NIT'
      ? generarEmailJuridico(registro.firstName)
      : generarEmailNatural(registro.firstName, registro.lastName);
    registro.email = nuevoEmail;
    registro.validEmail = nuevoEmail;
    console.warn(`↻ Email duplicado en CONTACTS (${anterior}), regenerando → ${registro.email}`);
  }

  if (intentosId > 0 || intentosEmail > 0) {
    await testInfo.attach('Contacto regenerado por duplicado', {
      contentType: 'text/plain',
      body: Buffer.from(
        `Identificador: ${intentosId} intento(s) → ${registro.identifier}\nEmail: ${intentosEmail} intento(s) → ${registro.email}`
      ),
    });
  }
}

// ---- Un test por registro → aparece individualmente en el reporte HTML ----
for (const [index, registro] of registros.entries()) {
  const label = `[${index + 1}/${registros.length}] ${registro.documentType} ${registro.identifier} — ${registro.firstName} ${registro.lastName}`.trim();

  test(label, async ({ request }, testInfo) => {
    validarFormatoRegistro(registro);
    await asegurarPlacaUnica(registro, testInfo);
    await asegurarContactoUnico(registro, testInfo);

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
    // El texto del resultado va en "type" (no solo en "description") porque el
    // reporte HTML de Playwright muestra el "type" como badge directamente en la
    // fila de la lista; la "description" solo se ve al entrar al detalle.
    testInfo.annotations.push({ type: resultado, description: `HTTP ${status} — ${registro.identifier}` });

    // ── Log en consola ──
    if (status === HTTP_PARCIAL_ENROLAMIENTO_FALLIDO) {
      console.warn(`⚠ ${registro.identifier} | ${registro.email} | placa: ${registro.plate} | HTTP 204 (registro OK, enrolamiento FALLIDO)`);
      console.warn(`  REQUEST : ${requestBody}`);
      console.warn(`  RESPONSE: ${responseText}`);
    } else if (status === HTTP_EXITOSO) {
      console.log(`✓ ${registro.identifier} | ${registro.email} | placa: ${registro.plate}`);
      console.log(`  REQUEST : ${requestBody}`);
      console.log(`  RESPONSE: ${responseText}`);
    } else {
      console.error(`✗ ${registro.identifier} | HTTP ${status}`);
      console.error(`  REQUEST : ${requestBody}`);
      console.error(`  RESPONSE: ${responseText}`);
    }

    expect(
      esResultadoAceptable(status),
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
