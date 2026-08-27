// Catálogo de casos de prueba a nivel de campo para el body de
// POST /settings-users/api/v1/usersCl. Módulo puro (sin I/O): las funciones
// de "aplicar" reciben un registro válido ya generado y devuelven una
// variante (inválida o límite) del body a enviar.
//
// httpEsperado documenta el comportamiento REAL medido contra el ambiente de
// pruebas (ver reports/casos-validacion_*.md de la corrida de referencia), no
// el comportamiento "ideal" de un API bien validado. La mayoría de campos no
// se validan: ausentes/vacíos/fuera de rango terminan en 204 (a veces incluso
// 200), y solo locationId con formato inválido produjo un verdadero 400. Los
// casos marcados `bugConocido: true` devuelven 500 (error interno del
// servidor, no un rechazo controlado) — se documentan como línea base para
// detectar regresiones, no como comportamiento deseable.
import type { RegistroUsuario } from '../generators/userGenerator';

export type TipoDocumentoAplicable = 'CC' | 'NIT' | 'AMBOS';

export interface CasoMutacion {
  campo: string;
  caso: string;
  descripcion: string;
  aplicaA: TipoDocumentoAplicable;
  aplicar: (base: RegistroUsuario) => Record<string, unknown>;
  // Único valor si el HTTP real es igual para CC y NIT; objeto si difiere.
  httpEsperado: number | Partial<Record<'CC' | 'NIT', number>>;
  // true cuando httpEsperado es un 5xx: el servidor no rechaza limpiamente,
  // se cae. Se documenta como línea base pero se marca aparte en el reporte.
  bugConocido?: boolean;
}

export function httpEsperadoPara(caso: CasoMutacion, documentType: 'CC' | 'NIT'): number {
  return typeof caso.httpEsperado === 'number' ? caso.httpEsperado : (caso.httpEsperado[documentType] as number);
}

function omitir(base: RegistroUsuario, campo: keyof RegistroUsuario): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...base };
  delete copia[campo];
  return copia;
}

function con(base: RegistroUsuario, campo: keyof RegistroUsuario, valor: unknown): Record<string, unknown> {
  return { ...base, [campo]: valor };
}

// ---- Casos NEGATIVOS: httpEsperado = comportamiento real medido (línea base) ----
export const CASOS_NEGATIVOS: CasoMutacion[] = [
  // address — no se valida: se crea igual, pero el enrolamiento falla (204)
  { campo: 'address', caso: 'ausente', descripcion: 'address no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'address'), httpEsperado: 204 },
  { campo: 'address', caso: 'vacio', descripcion: 'address como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'address', ''), httpEsperado: 204 },

  // country — no se valida
  { campo: 'country', caso: 'ausente', descripcion: 'country no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'country'), httpEsperado: 204 },
  { campo: 'country', caso: 'tipo_incorrecto', descripcion: 'country como texto en vez de número', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'country', String(b.country)), httpEsperado: 204 },
  { campo: 'country', caso: 'valor_no_existente', descripcion: 'country con código de país inexistente', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'country', 999999), httpEsperado: 204 },

  // documentType — su ausencia hace caer al servidor (500): bug conocido
  { campo: 'documentType', caso: 'ausente', descripcion: 'documentType no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'documentType'), httpEsperado: 500, bugConocido: true },
  { campo: 'documentType', caso: 'vacio', descripcion: 'documentType como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'documentType', ''), httpEsperado: 500, bugConocido: true },
  { campo: 'documentType', caso: 'valor_no_soportado', descripcion: 'documentType con valor no soportado (XX)', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'documentType', 'XX'), httpEsperado: 500, bugConocido: true },

  // email — ausente hace caer al servidor; vacío/formato inválido no se valida
  { campo: 'email', caso: 'ausente', descripcion: 'email no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'email'), httpEsperado: 500, bugConocido: true },
  { campo: 'email', caso: 'vacio', descripcion: 'email como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'email', ''), httpEsperado: 204 },
  { campo: 'email', caso: 'formato_invalido', descripcion: 'email sin arroba', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'email', b.email.replace('@', '-')), httpEsperado: 204 },

  // validEmail — no se valida
  { campo: 'validEmail', caso: 'ausente', descripcion: 'validEmail no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'validEmail'), httpEsperado: 204 },
  { campo: 'validEmail', caso: 'no_coincide', descripcion: 'validEmail distinto de email', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'validEmail', `distinto.${b.email}`), httpEsperado: 204 },

  // firstName — ausente/vacío hacen caer al servidor
  { campo: 'firstName', caso: 'ausente', descripcion: 'firstName no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'firstName'), httpEsperado: 500, bugConocido: true },
  { campo: 'firstName', caso: 'vacio', descripcion: 'firstName como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'firstName', ''), httpEsperado: 500, bugConocido: true },

  // lastName: solo se prueba como requerido en persona natural; en jurídica
  // ya se envía vacío por diseño (ver generarPersonaJuridica). No se valida.
  { campo: 'lastName', caso: 'ausente', descripcion: 'lastName no enviado (persona natural)', aplicaA: 'CC', aplicar: (b) => omitir(b, 'lastName'), httpEsperado: 204 },

  // identifier — comportamiento distinto entre CC y NIT: CC cae con 500;
  // NIT responde 451 (código no estándar, no confirmado si es intencional).
  { campo: 'identifier', caso: 'ausente', descripcion: 'identifier no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'identifier'), httpEsperado: { CC: 500, NIT: 451 }, bugConocido: true },
  { campo: 'identifier', caso: 'vacio', descripcion: 'identifier como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'identifier', ''), httpEsperado: 500, bugConocido: true },
  { campo: 'identifier', caso: 'formato_invalido', descripcion: 'identifier con letras', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'identifier', 'ABC123XYZ0'), httpEsperado: { CC: 500, NIT: 451 }, bugConocido: true },
  {
    campo: 'identifier',
    caso: 'dv_incorrecto',
    descripcion: 'NIT con dígito de verificación incorrecto',
    aplicaA: 'NIT',
    aplicar: (b) => {
      const nit = b.identifier.slice(0, -1);
      const dvActual = parseInt(b.identifier.slice(-1), 10);
      const dvIncorrecto = (dvActual + 1) % 10;
      return con(b, 'identifier', `${nit}${dvIncorrecto}`);
    },
    httpEsperado: 451,
  },

  // legalRepresentativeId / legalRepresentativeName — no se validan como requeridos
  { campo: 'legalRepresentativeId', caso: 'ausente', descripcion: 'legalRepresentativeId no enviado (persona jurídica)', aplicaA: 'NIT', aplicar: (b) => omitir(b, 'legalRepresentativeId'), httpEsperado: 204 },
  { campo: 'legalRepresentativeName', caso: 'ausente', descripcion: 'legalRepresentativeName no enviado (persona jurídica)', aplicaA: 'NIT', aplicar: (b) => omitir(b, 'legalRepresentativeName'), httpEsperado: 204 },

  // department / locationId
  { campo: 'department', caso: 'ausente', descripcion: 'department no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'department'), httpEsperado: 204 },
  { campo: 'department', caso: 'vacio', descripcion: 'department como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'department', ''), httpEsperado: 204 },
  { campo: 'locationId', caso: 'ausente', descripcion: 'locationId no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'locationId'), httpEsperado: 204 },
  { campo: 'locationId', caso: 'vacio', descripcion: 'locationId como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'locationId', ''), httpEsperado: 204 },
  // Único caso donde el API sí valida el formato del body → 400 real.
  { campo: 'locationId', caso: 'formato_invalido', descripcion: 'locationId con letras', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'locationId', 'ABCDE'), httpEsperado: 400 },
  {
    campo: 'locationId',
    caso: 'departamento_no_corresponde',
    descripcion: 'locationId de un departamento distinto al de department',
    aplicaA: 'AMBOS',
    aplicar: (b) => con(b, 'locationId', b.department === '05' ? '11001' : '05001'),
    httpEsperado: 204,
  },

  // password / passwordConfirm — no se validan
  { campo: 'password', caso: 'ausente', descripcion: 'password no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'password'), httpEsperado: 204 },
  { campo: 'password', caso: 'vacio', descripcion: 'password como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'password', ''), httpEsperado: 204 },
  { campo: 'passwordConfirm', caso: 'ausente', descripcion: 'passwordConfirm no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'passwordConfirm'), httpEsperado: 204 },
  { campo: 'passwordConfirm', caso: 'no_coincide', descripcion: 'passwordConfirm distinto de password', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'passwordConfirm', `${b.password}X`), httpEsperado: 204 },

  // advisorId / fiscalRespons — no se validan
  { campo: 'advisorId', caso: 'ausente', descripcion: 'advisorId no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'advisorId'), httpEsperado: 204 },
  { campo: 'fiscalRespons', caso: 'ausente', descripcion: 'fiscalRespons no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'fiscalRespons'), httpEsperado: 204 },

  // naturalnessCompany — no se valida; personType ausente hace caer al servidor
  { campo: 'naturalnessCompany', caso: 'ausente', descripcion: 'naturalnessCompany no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'naturalnessCompany'), httpEsperado: 204 },
  { campo: 'naturalnessCompany', caso: 'fuera_de_rango', descripcion: 'naturalnessCompany con valor fuera de {0,1}', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'naturalnessCompany', 5), httpEsperado: 204 },
  { campo: 'personType', caso: 'ausente', descripcion: 'personType no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'personType'), httpEsperado: 500, bugConocido: true },
  { campo: 'personType', caso: 'fuera_de_rango', descripcion: 'personType con valor fuera de {1,2}', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'personType', 9), httpEsperado: 204 },

  // phone — no se valida
  { campo: 'phone', caso: 'ausente', descripcion: 'phone no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'phone'), httpEsperado: 204 },
  { campo: 'phone', caso: 'vacio', descripcion: 'phone como cadena vacía', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'phone', ''), httpEsperado: 204 },
  { campo: 'phone', caso: 'formato_invalido', descripcion: 'phone que no inicia en 3', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'phone', `1${b.phone.slice(1)}`), httpEsperado: 204 },
  { campo: 'phone', caso: 'longitud_corta', descripcion: 'phone con menos dígitos de los esperados', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'phone', b.phone.slice(0, 5)), httpEsperado: 204 },

  // plate — ausente ni siquiera afecta el enrolamiento (200 completo)
  { campo: 'plate', caso: 'ausente', descripcion: 'plate no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'plate'), httpEsperado: 200 },
  { campo: 'plate', caso: 'formato_invalido', descripcion: 'plate que no cumple ningún formato válido', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'plate', '1234'), httpEsperado: 204 },

  // category — ausente no afecta el enrolamiento (200); fuera de rango sí (204)
  { campo: 'category', caso: 'ausente', descripcion: 'category no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'category'), httpEsperado: 200 },
  { campo: 'category', caso: 'fuera_de_rango_bajo', descripcion: 'category por debajo del mínimo válido (0)', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'category', 0), httpEsperado: 204 },
  { campo: 'category', caso: 'fuera_de_rango_alto', descripcion: 'category por encima del máximo válido (8)', aplicaA: 'AMBOS', aplicar: (b) => con(b, 'category', 8), httpEsperado: 204 },

  // epc — ausente no afecta el enrolamiento (200)
  { campo: 'epc', caso: 'ausente', descripcion: 'epc no enviado', aplicaA: 'AMBOS', aplicar: (b) => omitir(b, 'epc'), httpEsperado: 200 },
];

// ---- Casos POSITIVOS de límite/equivalencia: se espera que el API los acepte ----
export interface CasoPositivo {
  nombre: string;
  aplicaA: 'CC' | 'NIT';
  aplicar: (base: RegistroUsuario) => RegistroUsuario;
}

export const CASOS_POSITIVOS_LIMITE: CasoPositivo[] = [
  { nombre: 'category en el límite inferior válido (1)', aplicaA: 'CC', aplicar: (b) => ({ ...b, category: 1 }) },
  { nombre: 'category en el límite superior válido (7)', aplicaA: 'NIT', aplicar: (b) => ({ ...b, category: 7 }) },
  { nombre: 'optionalPhone con un valor real en vez de null', aplicaA: 'CC', aplicar: (b) => ({ ...b, optionalPhone: b.phone }) },
];
