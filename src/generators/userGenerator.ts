import { faker } from '@faker-js/faker';
import RandExp from 'randexp';
import { calcularDvDian } from '../utils/dian';
import { munDep } from '../data/locations';
import { CONFIG } from '../../config';

export interface RegistroUsuario {
  address: string;
  country: number;
  department: string;
  documentType: string;
  email: string;
  firstName: string;
  identifier: string;
  lastName: string;
  legalRepresentativeId: string | null;
  legalRepresentativeName: string | null;
  locationId: string;
  optionalPhone: null;
  password: string;
  passwordConfirm: string;
  advisorId: string;
  fiscalRespons: string;
  naturalnessCompany: number;
  personType: number;
  phone: string;
  validEmail: string;
  plate: string;
  category: number;
  epc: string;
}

export interface RangoLetraInicial {
  desde: string;
  hasta: string;
}

// Cada formato es una expresión regular que describe una forma válida de placa.
// Por defecto: 3 letras + 3 números (ABC123) y 1 letra + 5 números (A12345).
export type FormatoPlaca = RegExp;

const FORMATOS_POR_DEFECTO: FormatoPlaca[] = [
  /^[A-Z]{3}[0-9]{3}$/,
  /^[A-Z][0-9]{5}$/,
];

const MAX_INTENTOS_FORMATO = 500;

// ---- Helpers de generación ----

function generarDesdeRegex(regex: RegExp): string {
  return new RandExp(regex).gen();
}

function primeraLetraEnRango(placa: string, { desde, hasta }: RangoLetraInicial): boolean {
  const codigo = placa.charAt(0).toUpperCase().charCodeAt(0);
  return codigo >= desde.toUpperCase().charCodeAt(0) && codigo <= hasta.toUpperCase().charCodeAt(0);
}

export function generarPlaca(
  rangoLetraInicial?: RangoLetraInicial | null,
  formatos: FormatoPlaca[] = FORMATOS_POR_DEFECTO
): string {
  if (formatos.length === 0) {
    throw new Error('FORMATOS_PLACA no puede ser una lista vacía');
  }
  if (rangoLetraInicial) {
    const { desde, hasta } = rangoLetraInicial;
    if (!/^[A-Za-z]$/.test(desde) || !/^[A-Za-z]$/.test(hasta)) {
      throw new Error('RANGO_LETRA_INICIAL_PLACA debe tener "desde" y "hasta" como una sola letra cada uno');
    }
    if (desde.toUpperCase().charCodeAt(0) > hasta.toUpperCase().charCodeAt(0)) {
      throw new Error('RANGO_LETRA_INICIAL_PLACA: "desde" debe ser alfabéticamente menor o igual que "hasta"');
    }
  }

  let placa: string;
  let intentos = 0;
  do {
    intentos++;
    if (intentos > MAX_INTENTOS_FORMATO) {
      throw new Error(
        `No fue posible generar una placa que cumpla FORMATOS_PLACA y RANGO_LETRA_INICIAL_PLACA tras ${MAX_INTENTOS_FORMATO} intentos. ` +
        'Verifica que al menos un formato admita una letra en la primera posición dentro del rango configurado.'
      );
    }
    const formato = faker.helpers.arrayElement(formatos);
    placa = generarDesdeRegex(formato);
  } while (rangoLetraInicial && !primeraLetraEnRango(placa, rangoLetraInicial));

  return placa;
}

function generarDocumento(length: number): string {
  const primerDigito = faker.number.int({ min: 1, max: 9 }).toString();
  return primerDigito + faker.string.numeric({ length: length - 1 });
}

function generarTelefono(): string {
  return '3' + faker.string.numeric({ length: 9 });
}

function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function elegirDepMun(): { dep: string; mun: string } {
  const deps = Object.keys(munDep);
  const dep = faker.helpers.arrayElement(deps);
  const mun = faker.helpers.arrayElement(munDep[dep]);
  return { dep, mun };
}

function generarPersonaNatural(epc: string): RegistroUsuario {
  const firstName = removerAcentos(faker.person.firstName());
  const lastName = removerAcentos(faker.person.lastName());
  const identifier = generarDocumento(10);
  const email = faker.internet.email({
    firstName: firstName.toLowerCase(),
    lastName: lastName.toLowerCase(),
    provider: 'yopmail.com',
  });
  const { dep, mun } = elegirDepMun();

  return {
    address: faker.location.streetAddress(),
    country: CONFIG.COLOMBIA_CODE,
    department: dep,
    documentType: 'CC',
    email,
    firstName,
    identifier,
    lastName,
    legalRepresentativeId: null,
    legalRepresentativeName: null,
    locationId: dep + mun,   // Código DANE completo: ej. "05001"
    optionalPhone: null,
    password: CONFIG.PASSWORD,
    passwordConfirm: CONFIG.PASSWORD,
    advisorId: CONFIG.ADVISOR_ID,
    fiscalRespons: CONFIG.FISCAL_RESPONS,
    naturalnessCompany: 0,
    personType: 1,
    phone: generarTelefono(),
    validEmail: email,
    plate: generarPlaca(CONFIG.RANGO_LETRA_INICIAL_PLACA, CONFIG.FORMATOS_PLACA),
    category: faker.number.int({ min: 1, max: 7 }),
    epc,
  };
}

function generarPersonaJuridica(epc: string): RegistroUsuario {
  const razonSocial = removerAcentos(faker.company.name()).replace(/,/g, ' ');
  const representante = removerAcentos(faker.person.fullName());
  const nit = generarDocumento(9);
  const dv = calcularDvDian(nit);
  const identifier = `${nit}${dv}`;
  const email = faker.internet.email({
    firstName: razonSocial.toLowerCase().replace(/\s+/g, '.').substring(0, 20),
    provider: 'yopmail.com',
  });
  const { dep, mun } = elegirDepMun();

  return {
    address: faker.location.streetAddress(),
    country: CONFIG.COLOMBIA_CODE,
    department: dep,
    documentType: 'NIT',
    email,
    firstName: razonSocial,
    identifier,
    lastName: '',
    legalRepresentativeId: faker.string.numeric({ length: 10 }),
    legalRepresentativeName: representante,
    locationId: dep + mun,
    optionalPhone: null,
    password: CONFIG.PASSWORD,
    passwordConfirm: CONFIG.PASSWORD,
    advisorId: CONFIG.ADVISOR_ID,
    fiscalRespons: CONFIG.FISCAL_RESPONS,
    naturalnessCompany: 1,
    personType: 2,
    phone: generarTelefono(),
    validEmail: email,
    plate: generarPlaca(CONFIG.RANGO_LETRA_INICIAL_PLACA, CONFIG.FORMATOS_PLACA),
    category: faker.number.int({ min: 1, max: 7 }),
    epc,
  };
}

// ---- Función principal exportada ----

export function generarRegistros(epcs: string[]): RegistroUsuario[] {
  const registros: RegistroUsuario[] = [];

  const totalNatural = CONFIG.TOTAL_NATURAL;
  const totalJuridico = CONFIG.TOTAL_JURIDICO;

  for (let i = 0; i < totalNatural; i++) {
    const epc = epcs.length > 0 ? epcs[i % epcs.length] : '';
    for (let v = 0; v < faker.number.int({ min: CONFIG.MIN_VEHICULOS, max: CONFIG.MAX_VEHICULOS }); v++) {
      registros.push(generarPersonaNatural(epc));
    }
  }

  for (let i = 0; i < totalJuridico; i++) {
    const epcIdx = totalNatural + i;
    const epc = epcs.length > 0 ? epcs[epcIdx % epcs.length] : '';
    for (let v = 0; v < faker.number.int({ min: CONFIG.MIN_VEHICULOS, max: CONFIG.MAX_VEHICULOS }); v++) {
      registros.push(generarPersonaJuridica(epc));
    }
  }

  // Mezclar para que naturales y jurídicas no queden agrupadas
  return faker.helpers.shuffle(registros);
}
