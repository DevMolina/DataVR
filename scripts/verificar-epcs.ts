// Script de diagnóstico manual: consulta a Oracle cuántos EPCs disponibles
// hay hoy (los mismos que usarán runner/ y tests/casos-positivos/) sin
// tener que correr una suite completa.
// Uso:  npx ts-node scripts/verificar-epcs.ts
// Requiere .env con ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING.

import { obtenerEpcsDisponibles, cerrarPoolOracle } from '../src/db/oracle';

async function main() {
  console.log('Consultando EPCs disponibles en OFFICEVR.TB_TAG_EPC_INVENTARIO...');
  const epcs = await obtenerEpcsDisponibles();
  console.log(`${epcs.length} EPC(s) disponibles.`);
  if (epcs.length > 0) {
    console.log('Primeros 10:', epcs.slice(0, 10));
  }
  await cerrarPoolOracle();
}

main().catch((err) => {
  console.error('Error al consultar Oracle:', err);
  process.exit(1);
});
