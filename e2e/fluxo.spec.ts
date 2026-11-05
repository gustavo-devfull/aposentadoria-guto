import { devices, expect, test } from "@playwright/test";

test("meu plano: resumo e cartões 60 × 65", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByTestId("plan-summary")).toContainText("51 anos");
  const kpis = page.getByTestId("kpis");
  await expect(kpis).toContainText("Aposentar aos 60");
  await expect(kpis).toContainText("Aposentar aos 65");
  await expect(kpis).toContainText("Renda mensal dos 60 aos 65");
  await expect(kpis).toContainText("R$ de hoje");
  await expect(kpis).toContainText("Projetado");
  await expect(kpis).toContainText(`em ${new Date().getFullYear() + 9}`); // 51 → 60 anos
  await expect(page.getByRole("contentinfo")).toContainText("Não constitui recomendação de investimento");
});

test("simulador recalcula em tempo real ao mudar aporte e taxa", async ({ page }) => {
  await page.goto("/demo?view=simulador");
  const kpis = page.getByTestId("kpis");
  const before = await kpis.innerText();
  await page.getByLabel("Aporte mensal").fill("9000");
  await expect(page.getByLabel("Aporte mensal")).toHaveValue("9.000");
  await expect(kpis).not.toHaveText(before);
  const after = await kpis.innerText();
  await page.getByRole("button", { name: /Poupança/ }).click();
  await expect(kpis).not.toHaveText(after);
  await expect(page.getByRole("button", { name: /Poupança/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Taxa de juros")).toHaveValue("6,17");
});

test("gráfico alterna entre R$ de hoje e projetado", async ({ page }) => {
  await page.goto("/demo");
  const btn = page.getByRole("button", { name: "Projetado" });
  await btn.click();
  await expect(btn).toHaveAttribute("aria-pressed", "true");
});

test("mês a mês: marcos, alternâncias e CSV", async ({ page }) => {
  await page.goto("/demo?view=mes");
  const table = page.getByTestId("monthly-table");
  await expect(table).toContainText("Aposentadoria e início do INSS aos 65");
  await page.getByRole("button", { name: "60 anos" }).click();
  await expect(table).toContainText("Aposentadoria aos 60");
  await expect(table).toContainText("Início do INSS aos 65");
  const before = await table.innerText();
  await page.getByRole("button", { name: "Projetado" }).click();
  await expect(table).not.toHaveText(before);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar CSV" }).click()]);
  expect(download.suggestedFilename()).toBe("mes-a-mes-aposentadoria-60-consumo-projetado.csv");
});

test("comparar destaca as premissas que diferem", async ({ page }) => {
  await page.goto("/demo?view=comparar");
  const premises = page.getByTestId("compare-premises");
  await expect(premises.locator("tr.bg-warn-soft")).toContainText(["Aporte mensal", "Taxa de juros"]);
  await expect(page.getByTestId("compare-results")).toContainText("Patrimônio aos 65");
  await expect(page.getByTestId("compare-results").locator(".bg-good-soft").first()).toBeVisible();
});

test("simulador: aporte pontual altera o resultado, avisa quando não conta e pode ser removido", async ({ page }) => {
  await page.goto("/demo?view=simulador");
  const kpis = page.getByTestId("kpis");
  const before = await kpis.innerText();
  await page.getByRole("button", { name: "+ Adicionar aporte pontual" }).click();
  await expect(page.getByTestId("lump-sum")).toHaveCount(1);
  await expect(kpis).not.toHaveText(before);
  const withTen = await kpis.innerText();
  await page.getByLabel("Aporte pontual 1", { exact: true }).fill("200000");
  await expect(kpis).not.toHaveText(withTen);
  await page.getByLabel("Mês do aporte pontual 1", { exact: true }).fill("2060-01");
  await expect(page.getByTestId("lump-sum")).toContainText("Depois da aposentadoria");
  await page.getByRole("button", { name: "Remover aporte pontual 1", exact: true }).click();
  await expect(page.getByTestId("lump-sum")).toHaveCount(0);
  await expect.poll(() => kpis.innerText()).toBe(before); // volta exatamente ao resultado sem o aporte
});

test.describe("PWA", () => {
  test("manifest, ícones e metadados de instalação", async ({ page, request }) => {
    await page.goto("/demo");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", /manifest\.webmanifest/);
    await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", /#/);
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBe(true);
    const m = await res.json();
    expect(m).toMatchObject({ display: "standalone", lang: "pt-BR", scope: "/" });
    for (const icon of m.icons) {
      const r = await request.get(icon.src);
      expect(r.ok(), icon.src).toBe(true);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
  });

  test("service worker ativa e, sem internet, mostra a página offline", async ({ page, context }) => {
    await page.goto("/demo");
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    expect(await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.active?.state))).toBe("activated");
    const sw = await page.request.get("/sw.js");
    expect(sw.headers()["cache-control"]).toContain("no-cache");
    await context.setOffline(true);
    await page.goto("/demo?view=simulador").catch(() => {});
    await expect(page.getByRole("heading", { name: "Você está sem conexão" })).toBeVisible();
    await context.setOffline(false);
  });
});

// Mesmo aparelho do Pixel 5 (tela, toque, user agent), sem o navegador padrão, que não pode mudar dentro de um describe.
const { defaultBrowserType: _browser, ...pixel5 } = devices["Pixel 5"];

test.describe("campos sem zoom no celular", () => {
  test.use(pixel5);
  test("inputs e selects têm 16px (o iOS só dá zoom abaixo disso)", async ({ page }) => {
    await page.goto("/demo?view=simulador");
    await page.getByRole("button", { name: "+ Adicionar aporte pontual" }).click();
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll("input, select, textarea")].map((e) => getComputedStyle(e).fontSize),
    );
    expect(sizes.length).toBeGreaterThan(6); // data, valores, taxa, inflação, mês do aporte…
    expect(new Set(sizes)).toEqual(new Set(["16px"]));
    // sem zoom por toque duplo
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe("manipulation");
  });
});
