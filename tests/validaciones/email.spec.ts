import { test, expect } from '@playwright/test';
import { validarEmail } from '../../src/validators/email';

test.describe('validarEmail', () => {
  test('acepta un email con formato válido', () => {
    expect(validarEmail('juan.perez@yopmail.com').valido).toBe(true);
  });

  test('rechaza un email sin arroba', () => {
    expect(validarEmail('juan.perez-yopmail.com').valido).toBe(false);
  });

  test('rechaza un email sin dominio', () => {
    expect(validarEmail('juan.perez@yopmail').valido).toBe(false);
  });

  test('rechaza un email con espacios', () => {
    expect(validarEmail('juan perez@yopmail.com').valido).toBe(false);
  });
});
