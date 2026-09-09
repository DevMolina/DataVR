// Bloque `use` compartido entre playwright.config.ts (casos de prueba, en
// tests/) y playwright.runner.config.ts (herramienta de creación masiva, en
// runner/) para no duplicar baseURL/headers en dos archivos.
//
// baseURL cascada desde el servidor activo (variable de entorno SERVIDOR,
// ver src/config/servidores.ts) — no se edita a mano por servidor.
import type { PlaywrightTestConfig } from '@playwright/test';
import { servidorActivo } from './src/config/servidores';

export const usoCompartido: PlaywrightTestConfig['use'] = {
  baseURL: servidorActivo().baseURL,
  ignoreHTTPSErrors: true,
  extraHTTPHeaders: {
    'captchakeystring': '',
    'Content-Type': 'application/json',
  },
};
