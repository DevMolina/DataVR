// Script de diagnóstico manual: verifica contra Oracle si un identificador o
// un email ya existen en CONTACTS.
// Uso:  npx ts-node scripts/verificar-contacto.ts --id 1234567890
//       npx ts-node scripts/verificar-contacto.ts --email nombre@yopmail.com
// Requiere .env con ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING.

import { identificadorExiste, emailExiste, cerrarPoolOracle } from '../src/db/oracle';

async function main() {
  const args = process.argv.slice(2);
  const idIndex = args.indexOf('--id');
  const emailIndex = args.indexOf('--email');
  const identifier = idIndex >= 0 ? args[idIndex + 1] : undefined;
  const email = emailIndex >= 0 ? args[emailIndex + 1] : undefined;

  if (!identifier && !email) {
    console.error('Uso: npx ts-node scripts/verificar-contacto.ts [--id <IDENTIFICADOR>] [--email <EMAIL>]');
    process.exit(1);
  }

  if (identifier) {
    console.log(`Consultando CONTACTS.USER_ID para "${identifier}"...`);
    const existe = await identificadorExiste(identifier);
    console.log(existe ? `✗ El identificador "${identifier}" YA EXISTE en CONTACTS.` : `✓ El identificador "${identifier}" está libre.`);
  }

  if (email) {
    console.log(`Consultando CONTACTS.EMAIL para "${email}"...`);
    const existe = await emailExiste(email);
    console.log(existe ? `✗ El email "${email}" YA EXISTE en CONTACTS.` : `✓ El email "${email}" está libre.`);
  }

  await cerrarPoolOracle();
}

main().catch((err) => {
  console.error('Error al consultar Oracle:', err);
  process.exit(1);
});
