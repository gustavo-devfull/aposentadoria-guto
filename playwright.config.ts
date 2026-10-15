import { defineConfig } from "@playwright/test";

/**
 * E2E do fluxo principal sobre as rotas /demo (sem login nem banco).
 * O fluxo autenticado exige DATABASE_URL e credenciais de teste do Auth.js.
 * Em ambientes com Chromium pré-instalado: PW_CHROMIUM=/opt/pw-browsers/chromium
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3111",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ["--no-sandbox"] } : {},
  },
  webServer: {
    command: "next build && next start -p 3111",
    url: "http://localhost:3111/demo",
    reuseExistingServer: true,
    timeout: 240_000,
    env: { ENABLE_DEMO: "1", AUTH_SECRET: "e2e-secret" },
  },
});
