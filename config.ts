export const CONFIG = {
  // --- Cantidad de usuarios a generar ---
  TOTAL_NATURAL: 25,   // Personas naturales (CC)
  TOTAL_JURIDICO: 25,   // Personas jurídicas (NIT)

  // --- Vehículos por usuario ---
  MIN_VEHICULOS: 1,
  MAX_VEHICULOS: 1,    // 1:1 usuario-vehículo por defecto

  // --- Campos fijos del API ---
  ADVISOR_ID: '1049625159',
  PASSWORD: 'Thoma$2025',
  FISCAL_RESPONS: '2',

  // --- EPC: ruta al archivo con un EPC por línea ---
  EPC_FILE: './data/epc-list.txt',

  // --- Código DIAN de Colombia (país) ---
  COLOMBIA_CODE: 169,
};
