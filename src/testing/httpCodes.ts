// Códigos de respuesta del servicio de registro de usuarios
// (POST /settings-users/api/v1/usersCl). Única fuente de verdad: todo el
// código de tests/reporters debe importar de aquí en vez de repetir números
// mágicos.
export const HTTP_EXITOSO = 200; // registro y enrolamiento exitosos
export const HTTP_PARCIAL_ENROLAMIENTO_FALLIDO = 204; // registro exitoso, enrolamiento fallido
export const HTTP_VALIDACION = 400; // el body no pasó la validación del API

// Un resultado se considera aceptable para el flujo de creación masiva
// (no lo hace fallar) cuando el registro del usuario se creó, sin importar
// si el enrolamiento falló.
export function esResultadoAceptable(status: number): boolean {
  return status === HTTP_EXITOSO || status === HTTP_PARCIAL_ENROLAMIENTO_FALLIDO;
}

export function etiquetaResultado(status: number): string {
  if (status === HTTP_EXITOSO) return '✅ Exitoso';
  if (status === HTTP_PARCIAL_ENROLAMIENTO_FALLIDO) return '⚠️ Parcial (enrolamiento fallido)';
  if (status === HTTP_VALIDACION) return '🚫 Rechazado (validación)';
  return `❌ Fallido (HTTP ${status})`;
}
