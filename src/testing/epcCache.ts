// Los EPCs ya no se mantienen en un archivo estático (antiguo
// data/epc-list.txt) — se consultan en vivo desde Oracle (ver
// obtenerEpcsDisponibles en src/db/oracle.ts). El problema es que los specs
// que los usan (runner/crear-usuarios.spec.ts, tests/casos-positivos/) arman
// su lista de tests de forma SÍNCRONA al cargar el módulo (para que Playwright
// pueda listarlos antes de ejecutar), y una consulta a Oracle es asíncrona.
//
// Este módulo resuelve ese desfase con una caché en disco: un paso previo
// (tests/_setup/epc.setup.ts para la suite de tests/, runner/globalSetup.ts
// para el runner) consulta Oracle una vez y escribe el resultado en
// EPC_CACHE_PATH; los specs luego lo leen de forma síncrona, igual que antes
// leían el .txt. El archivo es efímero (está en .gitignore) y se
// sobrescribe en cada corrida — nunca se edita a mano.
import * as fs from 'fs';
import * as path from 'path';
import { obtenerEpcsDisponibles } from '../db/oracle';

export const EPC_CACHE_PATH = path.resolve(__dirname, '..', '..', '.cache', 'epcs.json');

// Consulta Oracle y (re)escribe la caché en disco. Se ejecuta una sola vez
// por corrida, en el paso de setup, nunca desde los specs.
export async function refrescarCacheEpcs(): Promise<string[]> {
  const epcs = await obtenerEpcsDisponibles();
  fs.mkdirSync(path.dirname(EPC_CACHE_PATH), { recursive: true });
  fs.writeFileSync(EPC_CACHE_PATH, JSON.stringify(epcs), 'utf-8');
  return epcs;
}

// Lectura síncrona de la caché, para usar desde specs. Si el paso de setup
// no corrió (ej. se ejecutó un spec suelto sin su dependencia), se devuelve
// una lista vacía con una advertencia — mismo comportamiento de fallback que
// tenía el antiguo epc-list.txt ausente o vacío (el campo epc queda '').
export function leerEpcsCacheados(): string[] {
  if (!fs.existsSync(EPC_CACHE_PATH)) {
    console.warn(`[ADVERTENCIA] No hay caché de EPCs en ${EPC_CACHE_PATH} (¿corrió el paso de setup?)`);
    return [];
  }
  try {
    const epcs = JSON.parse(fs.readFileSync(EPC_CACHE_PATH, 'utf-8'));
    return Array.isArray(epcs) ? epcs : [];
  } catch {
    console.warn(`[ADVERTENCIA] Caché de EPCs en ${EPC_CACHE_PATH} está corrupta, se ignora`);
    return [];
  }
}
