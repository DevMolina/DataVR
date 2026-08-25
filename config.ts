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
  RANGO_LETRA_INICIAL_PLACA: null as { desde: string; hasta: string } | null,

  // --- Campos fijos del API ---
  ADVISOR_ID: '1049625159',
  PASSWORD: 'Thoma$2025',
  FISCAL_RESPONS: '2',

  // --- EPC: ruta al archivo con un EPC por línea ---
  EPC_FILE: './data/epc-list.txt',

  // --- Código DIAN de Colombia (país) ---
  COLOMBIA_CODE: 169,
};
