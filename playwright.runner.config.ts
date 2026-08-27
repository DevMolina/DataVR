import { defineConfig } from '@playwright/test';
import { usoCompartido } from './playwright.use.shared';

// Herramienta de creación masiva de usuarios/vehículos de prueba
// (runner/crear-usuarios.spec.ts). No es una suite de validación del API:
// es un runner que consume el endpoint para poblar datos de prueba. Se
// ejecuta con `npm run test:masivo`, separado de `npm test` (que corre los
// casos de prueba reales en tests/) para que poblar datos masivamente sea
// siempre una acción explícita.
export default defineConfig({
  testDir: './runner',
  timeout: 30000,
  workers: 3,
  reporter: [
    ['html', { outputFolder: 'playwright-report-runner', open: 'never' }],
    ['list'],
    ['./reporters/resumen-reporter.ts'],
  ],
  use: usoCompartido,
});
