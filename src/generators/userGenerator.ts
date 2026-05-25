import { faker } from '@faker-js/faker';
import { calcularDvDian } from '../utils/dian';
import { munDep } from '../data/locations';
import { CONFIG } from '../../config';

// Regex portada del script Python original (formato colombiano más común: ABC123)
const PLATE_REGEX = /^([A-Za-z]{3}\d{3}|[A-Za-z]\d{4}|[A-Za-z]{2}\d{4}|[A-Za-z]\d{5}|[A-Za-z]{2}\d{5}|[A-Za-z0-9]{7})$/;

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

// ---- Helpers de generación ----

function generarPlaca(): string {
  // Genera siempre formato ABC123 (el más común en Colombia) que cumple el regex
  let placa: string;
  do {
    placa =
      faker.string.alpha({ length: 3, casing: 'upper' }) +
      faker.string.numeric({ length: 3 });
  } while (!PLATE_REGEX.test(placa));
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
    plate: generarPlaca(),
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
    plate: generarPlaca(),
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
