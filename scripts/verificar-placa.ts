// Script de diagnóstico manual: verifica contra Oracle si una placa existe.
// Uso:  npx ts-node scripts/verificar-placa.ts ABC123
// Requiere .env con ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING.

import { placaExiste, cerrarPoolOracle } from '../src/db/oracle';

async function main() {
  const placa = process.argv[2];
  if (!placa) {
    console.error('Uso: npx ts-node scripts/verificar-placa.ts <PLACA>');
    process.exit(1);
  }

  console.log(`Consultando TAG.VEHICLELICENCEPLATENUMBER para "${placa}"...`);
  const existe = await placaExiste(placa);
  console.log(existe ? `✗ La placa "${placa}" YA EXISTE en la base de datos.` : `✓ La placa "${placa}" está libre.`);

  await cerrarPoolOracle();
}

main().catch((err) => {
  console.error('Error al consultar Oracle:', err);
  process.exit(1);
});
