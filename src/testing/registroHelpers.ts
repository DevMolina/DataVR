// Helpers compartidos entre suites que SÍ crean registros reales
// (tests/crear-usuarios.spec.ts, tests/casos-positivos/*): validación de
// formato antes de enviar y aseguramiento de unicidad contra Oracle
// (placa en TAG, identificador/email en CONTACTS).
import {
  generarPlaca,
  generarIdentificadorNatural,
  generarIdentificadorJuridico,
  generarEmailNatural,
  generarEmailJuridico,
  RegistroUsuario,
} from '../generators/userGenerator';
import { placaExiste, identificadorExiste, emailExiste } from '../db/oracle';
import { validarIdentificador } from '../validators/identificador';
import { validarEmail } from '../validators/email';
import { CONFIG } from '../../config';

export const MAX_INTENTOS_PLACA = 50;
export const MAX_INTENTOS_CONTACTO = 50;

export type AttachFn = (name: string, opts: { contentType: string; body: Buffer }) => Promise<void>;

// Valida el FORMATO del identificador y del email generados antes de enviar
// la petición (defensivo: el generador ya debería producir datos válidos,
// pero esto detecta regresiones sin necesidad de llegar hasta el API).
export function validarFormatoRegistro(registro: RegistroUsuario): void {
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
export async function asegurarPlacaUnica(registro: RegistroUsuario, attach: AttachFn): Promise<void> {
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
    await attach('Placas descartadas por duplicado', {
      contentType: 'text/plain',
      body: Buffer.from(`${intentos} intento(s) hasta obtener una placa libre: ${registro.plate}`),
    });
  }
}

// Regenera el identificador y/o el email del registro mientras ya existan en
// CONTACTS (campos USER_ID y EMAIL respectivamente). Evita enviar al API
// datos de prueba que colisionarían con contactos ya existentes.
export async function asegurarContactoUnico(registro: RegistroUsuario, attach: AttachFn): Promise<void> {
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
    await attach('Contacto regenerado por duplicado', {
      contentType: 'text/plain',
      body: Buffer.from(
        `Identificador: ${intentosId} intento(s) → ${registro.identifier}\nEmail: ${intentosEmail} intento(s) → ${registro.email}`
      ),
    });
  }
}
