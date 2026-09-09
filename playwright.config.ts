import { defineConfig } from '@playwright/test';
import { usoCompartido } from './playwright.use.shared';

// Casos de prueba reales del endpoint (formato, límites, positivos/negativos).
// Para la herramienta de creación masiva de datos de prueba, ver
// playwright.runner.config.ts (testDir: ./runner).
//
// Se declara un proyecto por suite (en vez de un único testDir: './tests')
// para poder marcar de cuáles depende Oracle: solo 'casos-positivos'
// necesita el paso de setup que cachea los EPCs (ver tests/_setup/epc.setup.ts);
// 'validaciones' y 'casos-negativos' siguen corriendo sin .env/Oracle. Al
// agregar una suite nueva bajo tests/, se agrega también su project aquí
// (ver README → "Escalar a más endpoints").
export default defineConfig({
  timeout: 30000,
  workers: 3,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['./reporters/resumen-reporter.ts'],
  ],
  use: usoCompartido,
  projects: [
    {
      name: 'epc-setup',
      testDir: './tests/_setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'validaciones',
      testDir: './tests/validaciones',
    },
    {
      name: 'casos-negativos',
      testDir: './tests/casos-negativos',
    },
    {
      name: 'casos-positivos',
      testDir: './tests/casos-positivos',
      dependencies: ['epc-setup'],
    },
  ],
});
