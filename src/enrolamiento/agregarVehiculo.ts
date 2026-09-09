// Orquesta el flujo completo de "agregar un vehículo a un usuario ya
// creado": resuelve la cuenta del usuario, hace login como ese usuario,
// genera placa(s) únicas reutilizando los parámetros de placa existentes
// (CONFIG.FORMATOS_PLACA / RANGO_LETRA_INICIAL_PLACA), toma EPC(s)
// disponibles desde Oracle y llama a vehicles-manager por cada vehículo.
//
// Lógica separada de runner/crear-usuarios.spec.ts a propósito: ese runner
// crea usuarios nuevos (POST usersCl); esto agrega vehículos a una cuenta
// que YA existe (login + POST vehicles-manager/add), un flujo distinto.
import { request } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { generarPlaca } from '../generators/userGenerator';
import { placaExiste, obtenerEpcsDisponibles, obtenerCuentaPorIdentificador } from '../db/oracle';
import { loginUsuario, enrolarVehiculo } from './apiClient';
import { usoCompartido } from '../../playwright.use.shared';
import { CONFIG } from '../../config';

const MAX_INTENTOS_PLACA = 50;

export interface ResultadoIntentoEnrolamiento {
  intento: number;
  plate: string;
  epc: string;
  category: number;
  account: string;
  http: number;
  ok: boolean;
  responseBody: unknown;
}

export interface ResultadoAgregarVehiculos {
  identifier: string;
  account: string;
  intentos: ResultadoIntentoEnrolamiento[];
}

async function resolverPlacaUnica(placasYaUsadasEnEstaCorrida: Set<string>): Promise<string> {
  for (let intento = 1; intento <= MAX_INTENTOS_PLACA; intento++) {
    const candidata = generarPlaca(CONFIG.RANGO_LETRA_INICIAL_PLACA, CONFIG.FORMATOS_PLACA);
    if (placasYaUsadasEnEstaCorrida.has(candidata)) continue;
    if (!(await placaExiste(candidata))) {
      return candidata;
    }
    console.warn(`  ↻ Placa duplicada en BD (${candidata}), regenerando...`);
  }
  throw new Error(`No se pudo generar una placa única tras ${MAX_INTENTOS_PLACA} intentos`);
}

// identifier: CC o NIT+DV de un usuario YA CREADO (por runner/crear-usuarios.spec.ts
// u otro medio). password: fija (CONFIG.PASSWORD), ya que todos los usuarios
// creados por este proyecto comparten esa contraseña de prueba.
export async function agregarVehiculos(identifier: string, cantidad: number): Promise<ResultadoAgregarVehiculos> {
  const account = await obtenerCuentaPorIdentificador(identifier);
  if (!account) {
    throw new Error(`No se encontró ninguna cuenta (TB_ACCOUNT) para el usuario "${identifier}"`);
  }
  console.log(`Cuenta encontrada para ${identifier}: ${account}`);

  const requestContext = await request.newContext(usoCompartido);
  try {
    console.log(`Login como ${identifier}...`);
    const token = await loginUsuario(requestContext, identifier, CONFIG.PASSWORD);
    console.log('Token obtenido.');

    const epcsDisponibles = await obtenerEpcsDisponibles();
    const epcsUsadosEnEstaCorrida = new Set<string>();
    const placasUsadasEnEstaCorrida = new Set<string>();

    const intentos: ResultadoIntentoEnrolamiento[] = [];
    for (let i = 1; i <= cantidad; i++) {
      console.log(`\n[${i}/${cantidad}] Generando placa...`);
      const plate = await resolverPlacaUnica(placasUsadasEnEstaCorrida);
      placasUsadasEnEstaCorrida.add(plate);

      const epc = epcsDisponibles.find((candidato) => !epcsUsadosEnEstaCorrida.has(candidato));
      if (!epc) {
        throw new Error('No hay EPC disponibles (todos usados en esta corrida o sin inventario libre)');
      }
      epcsUsadosEnEstaCorrida.add(epc);

      const category = faker.number.int({ min: 1, max: 7 });

      console.log(`  Placa: ${plate} | EPC: ${epc} | Categoría: ${category} | Cuenta: ${account}`);
      const response = await enrolarVehiculo(requestContext, token, { plate, category, account, epc });
      const responseBody = await response.json().catch(() => ({}));
      const ok = response.ok();
      console.log(`  Resultado: HTTP ${response.status()} ${ok ? 'OK' : 'ERROR'}`);

      intentos.push({
        intento: i,
        plate,
        epc,
        category,
        account,
        http: response.status(),
        ok,
        responseBody,
      });
    }

    return { identifier, account, intentos };
  } finally {
    await requestContext.dispose();
  }
}
