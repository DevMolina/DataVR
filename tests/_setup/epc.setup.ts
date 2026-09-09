// Proyecto de setup de Playwright (ver playwright.config.ts → projects):
// solo tests/casos-positivos declara `dependencies: ['epc-setup']`, así que
// esto corre únicamente cuando esa suite (o `npm test` completo) se ejecuta
// — tests/casos-negativos y tests/validaciones NO requieren Oracle y siguen
// corriendo sin necesitar .env, como antes.
import { test as setup } from '@playwright/test';
import { refrescarCacheEpcs } from '../../src/testing/epcCache';
import { cerrarPoolOracle } from '../../src/db/oracle';

setup('refrescar caché de EPCs desde Oracle', async () => {
  const epcs = await refrescarCacheEpcs();
  console.log(`[EPC-SETUP] ${epcs.length} EPC(s) disponibles cacheados desde Oracle`);
  await cerrarPoolOracle();
});
