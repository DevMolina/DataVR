// Validación de FORMATO de números de identificación (no consulta la BD).
// Complementa a identificadorExiste() (src/db/oracle.ts), que valida unicidad.
import { calcularDvDian } from '../utils/dian';

export interface ResultadoValidacion {
  valido: boolean;
  error?: string;
}

// Cédula de ciudadanía (CC): solo dígitos, no puede iniciar en 0.
export function validarCedula(identifier: string): ResultadoValidacion {
  if (!/^[1-9][0-9]*$/.test(identifier)) {
    return { valido: false, error: `Cédula "${identifier}" debe contener solo dígitos y no iniciar en 0` };
  }
  return { valido: true };
}

// NIT + dígito de verificación DIAN concatenados (ej. "900123456" + "7" =
// "9001234567"): el último dígito debe corresponder al DV calculado sobre el
// resto del número.
export function validarNitConDv(identifier: string): ResultadoValidacion {
  if (!/^[1-9][0-9]+$/.test(identifier)) {
    return { valido: false, error: `NIT+DV "${identifier}" debe contener solo dígitos, no iniciar en 0 y tener al menos 2 dígitos` };
  }
  const nit = identifier.slice(0, -1);
  const dvRecibido = parseInt(identifier.slice(-1), 10);
  const dvEsperado = calcularDvDian(nit);
  if (dvEsperado !== dvRecibido) {
    return {
      valido: false,
      error: `Dígito de verificación inválido para NIT ${nit}: esperado ${dvEsperado}, recibido ${dvRecibido}`,
    };
  }
  return { valido: true };
}

// Despacha según el tipo de documento tal como lo espera el API (CC | NIT).
export function validarIdentificador(documentType: string, identifier: string): ResultadoValidacion {
  if (documentType === 'NIT') {
    return validarNitConDv(identifier);
  }
  return validarCedula(identifier);
}
