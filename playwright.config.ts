import { defineConfig } from '@playwright/test';
import { usoCompartido } from './playwright.use.shared';

// Casos de prueba reales del endpoint (formato, límites, positivos/negativos).
// Para la herramienta de creación masiva de datos de prueba, ver
// playwright.runner.config.ts (testDir: ./runner).
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 3,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['./reporters/resumen-reporter.ts'],
  ],
  use: usoCompartido,
});
