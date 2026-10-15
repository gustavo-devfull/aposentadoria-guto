import { expect, test } from "@playwright/test";

test("dashboard 60 vs 65: cards, ponte e alternância nominal", async ({ page }) => {
  await page.goto("/demo");
  const cards = page.getByTestId("cards");
  await expect(cards).toContainText("Aposentar aos 60");
  await expect(cards).toContainText("Aposentar aos 65");
  await expect(cards).toContainText("Ponte sem INSS: 60 → 65 anos (60 meses)");
  const before = await cards.innerText();
  await page.getByRole("button", { name: "Nominal" }).click();
  await expect(cards).not.toHaveText(before);
  await expect(page.getByRole("contentinfo")).toContainText("Não constitui recomendação de investimento");
});

test("simulador recalcula em tempo real ao mudar idade e aporte", async ({ page }) => {
  await page.goto("/demo?view=simulador");
  const kpis = page.getByTestId("kpis");
  const before = await kpis.innerText();
  await page.getByLabel("Aporte mensal").fill("9000");
  await page.getByLabel("Idade de aposentadoria").fill("65");
  await expect(kpis).not.toHaveText(before);
  await expect(page.getByText("Resultado — aposentando aos 65")).toBeVisible();
});

test("tabela anual exporta CSV em pt-BR", async ({ page }) => {
  await page.goto("/demo?view=tabela");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^tabela-anual-aposentadoria-60-/);
});

test("acompanhamento alerta quando o realizado fica >10% abaixo do plano", async ({ page }) => {
  await page.goto("/demo?view=acompanhamento");
  await expect(page.getByTestId("tracking-banner")).toContainText("abaixo do plano");
  await expect(page.getByTestId("tracking-banner")).toHaveAttribute("role", "alert");
});

test("Monte Carlo roda em worker, mostra probabilidade e é reprodutível", async ({ page }) => {
  await page.goto("/demo?view=montecarlo");
  await page.getByLabel("Trajetórias").selectOption("1000");
  await page.getByRole("button", { name: "Rodar simulação" }).click();
  await expect(page.getByTestId("mc-kpis")).toBeVisible({ timeout: 30_000 });
  const first = await page.getByTestId("mc-prob").innerText();
  expect(first).toMatch(/\d+,\d+%/);
  await page.getByRole("button", { name: "Rodar simulação" }).click();
  await expect(page.getByTestId("mc-prob")).toHaveText(first, { timeout: 30_000 });
});
