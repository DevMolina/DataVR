// Cliente HTTP del flujo de enrolamiento de vehículos adicionales, portado
// desde el proyecto RunnerEnrolamiento (github.com/DevMolina/RunnerEnrolamiento)
// y adaptado a este repo: usa el APIRequestContext de Playwright (reutiliza
// baseURL/headers de playwright.use.shared.ts, ya cascadeados por servidor)
// en vez de axios, para no duplicar la resolución de baseURL por SERVIDOR.
//
// Es un flujo DISTINTO al de creación masiva (usersCl): aquí se loguea como
// el usuario ya creado y se le agrega un vehículo a una cuenta que ya tiene,
// vía vehicles-manager. Por eso vive separado en src/enrolamiento/ en vez de
// mezclarse con src/generators/ o src/testing/.
import type { APIRequestContext, APIResponse } from '@playwright/test';

const LOGIN_PATH = '/settings-users/api/v1/users/login';
const ENROLL_PATH = '/vehicles-manager/api/v1/vehiclesCl/add';

export interface DatosEnrolamiento {
  plate: string;
  category: number;
  account: string;
  epc: string;
}

// Hace login y devuelve el token TAL CUAL viene en el header "authorization"
// de la respuesta (no en el body). Validado contra el sistema real: el token
// llega como "Bearer  eyJ..." (con doble espacio incluido) y NO se debe tocar
// su contenido — enrolarVehiculo() antepone otro "Bearer " al llamar al
// endpoint de enrolamiento, reproduciendo el formato exacto
// "Bearer Bearer  eyJ..." que espera vehicles-manager. No "corregir" esto:
// es el comportamiento real observado, no un bug de este cliente.
export async function loginUsuario(request: APIRequestContext, user: string, password: string): Promise<string> {
  const response = await request.post(LOGIN_PATH, {
    data: { user, password },
  });

  if (!response.ok()) {
    const body = await response.text().catch(() => '');
    throw new Error(`Login falló para "${user}" con HTTP ${response.status()}: ${body}`);
  }

  const headers = response.headers();
  const token = headers['authorization'];
  if (!token) {
    throw new Error(
      `No se encontró el header "authorization" en la respuesta de login de "${user}". ` +
      `Headers disponibles: ${Object.keys(headers).join(', ')}`
    );
  }
  return token;
}

// Llama a vehicles-manager para agregar un vehículo (placa+EPC) a una cuenta
// ya existente, usando el token de loginUsuario().
export async function enrolarVehiculo(
  request: APIRequestContext,
  token: string,
  datos: DatosEnrolamiento
): Promise<APIResponse> {
  return request.post(ENROLL_PATH, {
    data: datos,
    headers: { Authorization: `Bearer ${token}` },
  });
}
