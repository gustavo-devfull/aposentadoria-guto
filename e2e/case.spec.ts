import { devices, expect, test } from "@playwright/test";

test("a página de case abre sem login, carrega fontes e imagens e a régua aparece", async ({ page }) => {
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  await page.goto("/case");
  await expect(page).toHaveTitle(/case de produto e engenharia/i);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Quanto de renda eu tenho se parar de trabalhar aos 60?");
  await expect(page.getByRole("img", { name: /Linha do tempo de 50 a 90 anos/ })).toBeVisible();
  for (const h of ["O problema", "O que o app faz", "Decisões que moldaram o produto", "O que deu errado", "Próximos passos"]) {
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
  }
  // rola até o fim para as imagens `lazy` carregarem
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } });
  await expect.poll(() => page.evaluate(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family); }))
    .toEqual(expect.arrayContaining(["Bricolage Grotesque", "Source Serif 4"]));
  expect(failed).toEqual([]);
  await expect(page.getByRole("link", { name: "Abrir o app" }).first()).toHaveAttribute("href", "/");
});

const { defaultBrowserType: _browser, ...pixel5 } = devices["Pixel 5"];
test.describe("case no celular", () => {
  test.use(pixel5);
  test("sem rolagem horizontal", async ({ page }) => {
    await page.goto("/case");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
