// Global setup del runner (ver playwright.runner.config.ts): refresca la
// caché de EPCs desde Oracle antes de que runner/crear-usuarios.spec.ts la
// lea de forma síncrona. El runner ya requiere Oracle para todo lo demás
// (unicidad de placa/identificador/email), así que esto no agrega una
// dependencia nueva, solo reemplaza la fuente de los EPCs.
import { refrescarCacheEpcs } from '../src/testing/epcCache';
import { cerrarPoolOracle } from '../src/db/oracle';

export default async function globalSetup(): Promise<void> {
  const epcs = await refrescarCacheEpcs();
  console.log(`[GLOBAL-SETUP] ${epcs.length} EPC(s) disponibles cacheados desde Oracle`);
  await cerrarPoolOracle();
}
