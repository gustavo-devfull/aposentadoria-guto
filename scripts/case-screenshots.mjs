// Capturas de tela da página de case (public/case/img). Usa as rotas /demo (dados fictícios, data de nascimento fictícia).
// Uso: ENABLE_DEMO=1 npx next start -p 3111 &  PW_CHROMIUM=/caminho/chromium node scripts/case-screenshots.mjs
import { chromium, devices } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3111";
const NASC = "1982-06-20"; // fictícia
const OUT = "public/case/img";
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ["--no-sandbox"] });
const shot = (page, name, extra = {}) => page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 86, ...extra });

const desktop = await browser.newContext({ viewport: { width: 1280, height: 960 }, deviceScaleFactor: 1.5, locale: "pt-BR", colorScheme: "light" });
let page = await desktop.newPage();

await page.goto(`${BASE}/demo?nasc=${NASC}`);
await page.getByTestId("kpis").waitFor();
await page.waitForTimeout(900); // gráfico terminar de desenhar
await shot(page, "meu-plano");

await page.goto(`${BASE}/demo?view=simulador&nasc=${NASC}`);
await page.getByTestId("kpis").waitFor();
await page.getByRole("button", { name: "+ Adicionar aporte pontual" }).click();
await page.getByLabel("Aporte pontual 1", { exact: true }).fill("150000");
await page.getByLabel("Mês do aporte pontual 1", { exact: true }).fill("2028-06");
await page.waitForTimeout(900);
await shot(page, "simulador");

await page.goto(`${BASE}/demo?view=mes&nasc=${NASC}`);
await page.getByTestId("monthly-table").waitFor();
await page.waitForTimeout(400);
await shot(page, "mes-a-mes");

await page.goto(`${BASE}/demo?view=comparar&nasc=${NASC}`);
await page.waitForTimeout(900);
await shot(page, "comparar");

const { defaultBrowserType: _b, ...pixel } = devices["Pixel 5"];
const mobile = await browser.newContext({ ...pixel, deviceScaleFactor: 2, locale: "pt-BR", colorScheme: "light" });
page = await mobile.newPage();
await page.goto(`${BASE}/demo?view=simulador&nasc=${NASC}`);
await page.getByTestId("kpis").waitFor();
await page.waitForTimeout(700);
await shot(page, "celular");

await browser.close();
console.log("capturas geradas em", OUT);
