// Única fuente de verdad de los parámetros que dependen de CUÁL servidor
// (Vía Rápida) se está probando: URL base del API, archivo .env con las
// credenciales Oracle de ese servidor, y rango de letra inicial de placa
// asignado a ese servidor. Un solo cambio (la variable de entorno SERVIDOR)
// cascada a los tres — no hay que tocar baseURL, .env ni RANGO_LETRA_INICIAL_PLACA
// por separado. Ver README → "Múltiples servidores (Vía Rápida)".
export type ServidorId = 'vr1' | 'vr2' | 'vr3';

export interface RangoLetraInicial {
  desde: string;
  hasta: string;
}

export interface ServidorConfig {
  id: ServidorId;
  nombre: string;
  baseURL: string;
  // Ruta relativa a la raíz del repo del .env con las credenciales Oracle
  // de este servidor (ORACLE_USER/ORACLE_PASSWORD/ORACLE_CONNECT_STRING).
  envFile: string;
  rangoLetraInicialPlaca: RangoLetraInicial;
}

export const SERVIDORES: Record<ServidorId, ServidorConfig> = {
  vr1: {
    id: 'vr1',
    nombre: 'Vía Rápida 1',
    baseURL: 'https://192.168.80.32:8760',
    envFile: '.env.vr1',
    rangoLetraInicialPlaca: { desde: 'A', hasta: 'F' },
  },
  vr2: {
    id: 'vr2',
    nombre: 'Vía Rápida 2',
    baseURL: 'https://192.168.110.3:8760',
    envFile: '.env.vr2',
    rangoLetraInicialPlaca: { desde: 'G', hasta: 'L' },
  },
  vr3: {
    id: 'vr3',
    nombre: 'Vía Rápida 3',
    baseURL: 'https://tstviarapida.co:8760',
    envFile: '.env.vr3',
    rangoLetraInicialPlaca: { desde: 'M', hasta: 'Z' },
  },
};

// Servidor usado cuando no se define SERVIDOR (ej. `npm test` a secas):
// el que ya estaba hardcodeado antes de esta mejora, para no cambiar el
// comportamiento por defecto de nadie que no adopte el flag nuevo.
const SERVIDOR_POR_DEFECTO: ServidorId = 'vr3';

let yaLogueado = false;

export function servidorActivo(): ServidorConfig {
  const idSolicitado = process.env.SERVIDOR;
  let cfg: ServidorConfig;
  if (!idSolicitado) {
    cfg = SERVIDORES[SERVIDOR_POR_DEFECTO];
  } else {
    const encontrado = (SERVIDORES as Record<string, ServidorConfig | undefined>)[idSolicitado];
    if (!encontrado) {
      throw new Error(
        `SERVIDOR="${idSolicitado}" no reconocido. Valores válidos: ${Object.keys(SERVIDORES).join(', ')} (ver src/config/servidores.ts)`
      );
    }
    cfg = encontrado;
  }
  if (!yaLogueado) {
    // Se loguea una sola vez por proceso (no una vez por test) para confirmar
    // contra qué servidor se está corriendo antes de disparar peticiones reales.
    console.log(`[SERVIDOR] ${cfg.nombre} → ${cfg.baseURL} (rango placa ${cfg.rangoLetraInicialPlaca.desde}-${cfg.rangoLetraInicialPlaca.hasta})`);
    yaLogueado = true;
  }
  return cfg;
}
