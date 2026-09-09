// CLI para agregar uno o más vehículos a un usuario YA CREADO (login como
// ese usuario + enrolamiento vía vehicles-manager). Portado y adaptado desde
// github.com/DevMolina/RunnerEnrolamiento — ver src/enrolamiento/.
//
// Uso:
//   npx ts-node scripts/agregar-vehiculo.ts --user 1049625159 [--count 3]
//   npm run agregar-vehiculo -- --user 1049625159 [--count 3]
//   npm run agregar-vehiculo:vr1 -- --user 1049625159   (fija el servidor)
//
// Requiere el .env.vrN del servidor activo (ver src/config/servidores.ts) con
// credenciales Oracle: se usa para resolver la cuenta del usuario, verificar
// unicidad de placa y traer EPCs disponibles.
import * as fs from 'fs';
import * as path from 'path';
import { agregarVehiculos, ResultadoIntentoEnrolamiento } from '../src/enrolamiento/agregarVehiculo';
import { cerrarPoolOracle } from '../src/db/oracle';

function timestampArchivo(fecha: Date): string {
  return fecha.toISOString().replace(/:/g, '-').replace(/\..+/, '').replace('T', '_');
}

function celda(valor: unknown): string {
  return String(valor ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function escribirReporte(identifier: string, account: string, intentos: ResultadoIntentoEnrolamiento[]): string {
  const exitosos = intentos.filter((i) => i.ok).length;
  const encabezados = ['#', 'Placa', 'EPC', 'Categoría', 'Cuenta', 'HTTP', 'Resultado'];
  const filas = intentos.map((i) =>
    `| ${[i.intento, i.plate, i.epc, i.category, i.account, i.http, i.ok ? '✅ OK' : '❌ Error'].map(celda).join(' | ')} |`
  );

  const fecha = new Date();
  const lineas = [
    '# Reporte de enrolamiento de vehículos',
    '',
    `Generado: ${fecha.toISOString()}`,
    '',
    `- Usuario: ${identifier}`,
    `- Cuenta: ${account}`,
    `- Total intentos: ${intentos.length}`,
    `- Exitosos: ${exitosos}`,
    `- Fallidos: ${intentos.length - exitosos}`,
    '',
    `| ${encabezados.join(' | ')} |`,
    `|${encabezados.map(() => '---').join('|')}|`,
    ...filas,
    '',
  ];

  const outDir = path.resolve(__dirname, '..', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `enrolamiento-vehiculos_${timestampArchivo(fecha)}.md`);
  fs.writeFileSync(outPath, lineas.join('\n'), 'utf-8');
  return outPath;
}

function parseArgs(argv: string[]): { user?: string; count: number } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return { user: args.user, count: args.count ? parseInt(args.count, 10) : 1 };
}

async function main() {
  const { user, count } = parseArgs(process.argv.slice(2));
  if (!user) {
    console.error('Uso: npx ts-node scripts/agregar-vehiculo.ts --user <IDENTIFICADOR> [--count <N>]');
    process.exit(1);
  }
  if (!Number.isInteger(count) || count < 1) {
    console.error(`--count debe ser un entero positivo (recibido: ${count})`);
    process.exit(1);
  }

  const { account, intentos } = await agregarVehiculos(user, count);

  const exitosos = intentos.filter((i) => i.ok).length;
  console.log(`\nCompletado: ${exitosos}/${intentos.length} exitosos.`);

  const reportPath = escribirReporte(user, account, intentos);
  console.log(`Reporte generado en: ${reportPath}`);

  await cerrarPoolOracle();

  if (exitosos < intentos.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
