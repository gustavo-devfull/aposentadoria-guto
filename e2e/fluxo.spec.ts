import { expect, test } from "@playwright/test";

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

test("comparar destaca as premissas que diferem", async ({ page }) => {
  await page.goto("/demo?view=comparar");
  const premises = page.getByTestId("compare-premises");
  await expect(premises.locator("tr.bg-warn-soft")).toContainText(["Aporte mensal", "Taxa de juros"]);
  await expect(page.getByTestId("compare-results")).toContainText("Patrimônio aos 65");
  await expect(page.getByTestId("compare-results").locator(".bg-good-soft").first()).toBeVisible();
});
