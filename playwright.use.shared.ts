// Bloque `use` compartido entre playwright.config.ts (casos de prueba, en
// tests/) y playwright.runner.config.ts (herramienta de creación masiva, en
// runner/) para no duplicar baseURL/headers en dos archivos.
import type { PlaywrightTestConfig } from '@playwright/test';

export const usoCompartido: PlaywrightTestConfig['use'] = {
  baseURL: 'https://tstviarapida.co:8760',
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    'captchakeystring': '',
    'Content-Type': 'application/json',
  },
};
