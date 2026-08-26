// Validación de FORMATO de correo electrónico (no consulta la BD).
// Complementa a emailExiste() (src/db/oracle.ts), que valida unicidad.
import type { ResultadoValidacion } from './identificador';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validarEmail(email: string): ResultadoValidacion {
  if (!EMAIL_REGEX.test(email)) {
    return { valido: false, error: `Email "${email}" no tiene un formato válido` };
  }
  return { valido: true };
}
