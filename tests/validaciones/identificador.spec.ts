import { test, expect } from '@playwright/test';
import { validarCedula, validarNitConDv, validarIdentificador } from '../../src/validators/identificador';
import { calcularDvDian } from '../../src/utils/dian';

test.describe('validarCedula', () => {
  test('acepta una cédula numérica que no inicia en 0', () => {
    expect(validarCedula('1234567890').valido).toBe(true);
  });

  test('rechaza una cédula que inicia en 0', () => {
    expect(validarCedula('0123456789').valido).toBe(false);
  });

  test('rechaza una cédula con caracteres no numéricos', () => {
    expect(validarCedula('12345A6789').valido).toBe(false);
  });
});

test.describe('validarNitConDv', () => {
  test('acepta un NIT+DV cuyo dígito de verificación es correcto', () => {
    const nit = '900123456';
    const dv = calcularDvDian(nit);
    expect(validarNitConDv(`${nit}${dv}`).valido).toBe(true);
  });

  test('rechaza un NIT+DV cuyo dígito de verificación es incorrecto', () => {
    const nit = '900123456';
    const dvIncorrecto = (calcularDvDian(nit) + 1) % 11;
    const resultado = validarNitConDv(`${nit}${dvIncorrecto}`);
    expect(resultado.valido).toBe(false);
    expect(resultado.error).toContain('Dígito de verificación inválido');
  });

  test('rechaza un valor que inicia en 0', () => {
    expect(validarNitConDv('0123456789').valido).toBe(false);
  });
});

test.describe('validarIdentificador', () => {
  test('despacha a validarCedula para documentType CC', () => {
    expect(validarIdentificador('CC', '1234567890').valido).toBe(true);
  });

  test('despacha a validarNitConDv para documentType NIT', () => {
    const nit = '900123456';
    const dv = calcularDvDian(nit);
    expect(validarIdentificador('NIT', `${nit}${dv}`).valido).toBe(true);
  });
});
