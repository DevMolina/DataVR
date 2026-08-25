import type { FormatoPlaca } from './src/generators/userGenerator';

export const CONFIG = {
  // --- Cantidad de usuarios a generar ---
  TOTAL_NATURAL: 5,   // Personas naturales (CC)
  TOTAL_JURIDICO: 5,   // Personas jurídicas (NIT)

  // --- Vehículos por usuario ---
  MIN_VEHICULOS: 1,
  MAX_VEHICULOS: 1,    // 1:1 usuario-vehículo por defecto

  // --- Rango de letras iniciales de la placa (null = cualquier letra A-Z) ---
  // Ejemplo: { desde: 'A', hasta: 'D' } genera placas que empiezan por A, B, C o D.
  // Para una letra fija, usar desde === hasta, ej. { desde: 'B', hasta: 'B' }.
  RANGO_LETRA_INICIAL_PLACA:  { desde: 'M', hasta: 'Z' } as { desde: string; hasta: string } | null,

  // --- Formatos de placa habilitados, como expresiones regulares (se elige una al azar por placa) ---
  // Por defecto: 3 letras + 3 números (ej. ABC123) y 1 letra + 5 números (ej. A12345).
  // Para forzar un solo formato, dejar un único elemento, ej. [/^[A-Z][0-9]{5}$/].
  FORMATOS_PLACA: [
    /^[A-Z]{3}[0-9]{3}$/,
    /^[A-Z][0-9]{7}$/,
  ] as FormatoPlaca[],

  // --- Campos fijos del API ---
  ADVISOR_ID: '1049625159',
  PASSWORD: 'Thoma$2025',
  FISCAL_RESPONS: '2',

  // --- EPC: ruta al archivo con un EPC por línea ---
  EPC_FILE: './data/epc-list.txt',

  // --- Código DIAN de Colombia (país) ---
  COLOMBIA_CODE: 169,
};
