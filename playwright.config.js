// Configuração dos testes automáticos (Playwright).
// Rodam em dois tamanhos de tela: computador e celular.
import { defineConfig } from '@playwright/test';

// Em ambientes sem o Chromium do Playwright, aponte CHROME_PATH para um Chrome instalado.
const launchOptions = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};

// O navegador dos testes roda no fuso do Diobert. Os testes também calculam datas (prazos, "ontem"),
// então o processo dos testes usa o mesmo fuso; senão, perto da meia-noite, os dois discordam do dia.
const FUSO = 'America/Sao_Paulo';
process.env.TZ = FUSO;

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'pt-BR',
    timezoneId: FUSO,
    screenshot: 'only-on-failure',
    launchOptions,
  },
  projects: [
    { name: 'computador', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'celular', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: 'node scripts/servidor.mjs',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
