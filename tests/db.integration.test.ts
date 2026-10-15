import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { runSimulation } from "@/lib/engine";
import { planToInput } from "@/lib/plan";
import { defaultPlanForm } from "@/lib/plan";

// Postgres real (WASM) com as migrations do projeto — substitui o cliente do Supabase nos testes.
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("@/db", () => ({ getDb: () => db }));

const plan = await import("@/db/queries/plan");
const manage = await import("@/db/queries/manage");
const sims = await import("@/db/queries/simulations");
const tracking = await import("@/db/queries/tracking");

const A = "user-a";
const B = "user-b";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
  await db.insert(schema.users).values([{ id: A, email: "a@x.com" }, { id: B, email: "b@x.com" }]);
});

describe("migrations", () => {
  it("criam as 16 tabelas com RLS ativado", async () => {
    const r = await client.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and relname not like '\\_\\_%'",
    );
    const app = r.rows.filter((x) => !x.relname.startsWith("drizzle"));
    expect(app).toHaveLength(16);
    expect(app.every((x) => x.relrowsecurity)).toBe(true);
  });
});

describe("onboarding → plano", () => {
  it("salva e recarrega o plano (ida e volta)", async () => {
    const classes = await plan.ensureAssetClasses(A);
    expect(classes.length).toBe(6);
    const ipca = classes.find((c) => c.name.startsWith("IPCA"))!;
    const form = {
      ...defaultPlanForm(),
      accounts: [{ name: "Tesouro", classId: ipca.id, institution: null, balance: 400000.55, costBasis: 250000, included: true }],
      contribution: { monthly: 4000, realGrowth: 0.01 },
    };
    await plan.savePlanForm(A, form);
    const loaded = (await plan.loadPlan(A))!;
    expect(loaded.birthDate).toBe(form.birthDate);
    expect(loaded.accounts[0]!.balance).toBeCloseTo(400000.55, 2);
    expect(loaded.contribution).toEqual({ monthly: 4000, realGrowth: 0.01 });
    expect(loaded.expenses).toHaveLength(2);
    expect(loaded.inss.benefit).toBe(1621);
    expect(loaded.classes.find((c) => c.id === ipca.id)!.contractedRealRate).toBeCloseTo(0.05, 6);
    // o plano carregado roda no motor
    expect(runSimulation(planToInput(loaded, 65), { solve: false }).patrimonioProjetado).toBeGreaterThan(400000);
  });
  it("rejeita classe de ativo de outro usuário", async () => {
    const other = await plan.ensureAssetClasses(B);
    await expect(
      plan.savePlanForm(A, { ...defaultPlanForm(), accounts: [{ name: "x", classId: other[0]!.id, balance: 1, costBasis: 1, included: true }] }),
    ).rejects.toThrow(/Classe/);
  });
  it("usuário sem onboarding não tem plano", async () => {
    expect(await plan.loadPlan(B)).toBeNull();
  });
});

describe("gerenciamento (carteira, renda e gastos, premissas)", () => {
  it("contas: upsert preserva o id das existentes e remove as retiradas", async () => {
    const [first] = (await plan.loadPlan(A))!.accounts;
    const classId = first!.classId;
    await manage.saveAccounts(A, [{ ...first!, balance: 500000 }, { name: "Nova", classId, balance: 10, costBasis: 10, included: false }]);
    const after = (await plan.loadPlan(A))!.accounts;
    expect(after).toHaveLength(2);
    expect(after.find((a) => a.id === first!.id)!.balance).toBe(500000);
    await manage.saveAccounts(A, [{ ...first! }]);
    expect((await plan.loadPlan(A))!.accounts.map((a) => a.id)).toEqual([first!.id]);
  });
  it("extras, pausas, outras rendas, degraus e INSS com cenário", async () => {
    await manage.saveExtras(A, [{ description: "13º", amount: 8000, month: 12, year: null, yearly: true }]);
    await manage.savePauses(A, [{ from: "2027-03", to: "2027-05", reason: null }]);
    await manage.saveIncomes(A, [{ type: "aluguel", description: null, monthly: 2000, startAge: 60, endAge: null, realGrowth: 0, taxable: true }]);
    const p0 = (await plan.loadPlan(A))!;
    await manage.saveExpenses(A, [{ ...p0.expenses[0]!, ageSteps: [{ fromAge: 75, factor: 0.8 }] }]);
    await manage.saveInss(A, { ...p0.inss, increase: { enabled: true, newContributionSalary: 3242, from: "2027-01" } });
    const p = (await plan.loadPlan(A))!;
    expect(p.extras[0]).toMatchObject({ amount: 8000, month: 12, yearly: true, year: null });
    expect(p.pauses[0]).toEqual({ from: "2027-03", to: "2027-05", reason: null });
    expect(p.otherIncomes[0]!.monthly).toBe(2000);
    expect(p.expenses[0]!.ageSteps).toEqual([{ fromAge: 75, factor: 0.8 }]);
    expect(p.inssIncrease).toEqual({ enabled: true, newContributionSalary: 3242, from: "2027-01" });
  });
  it("alocação alvo sobrevive a salvar o plano de aportes pelo onboarding", async () => {
    const p = (await plan.loadPlan(A))!;
    const cls = p.classes[0]!.id;
    await manage.saveContributionSettings(A, { monthly: 4000, realGrowth: 0, allocation: { [cls]: 1 } });
    await plan.savePlanForm(A, { ...defaultPlanForm(), accounts: p.accounts, contribution: { monthly: 5000, realGrowth: 0 } });
    const after = (await plan.loadPlan(A))!;
    expect(after.contribution.monthly).toBe(5000);
    expect(after.targetAllocation).toEqual({ [cls]: 1 });
  });
  it("premissas: cada alteração cria nova versão e sincroniza as classes", async () => {
    const v1 = (await manage.listAssumptionVersions(A))[0]!;
    expect(v1.versao).toBe(1);
    const classes = v1.classes.map((c) => (c.name.startsWith("Ações") ? { ...c, base: 0.05 } : c));
    const n = await manage.createAssumptionVersion(A, { ...v1, inflation: 0.04, classes });
    expect(n).toBe(2);
    const [v2, old] = await manage.listAssumptionVersions(A);
    expect(v2!.inflation).toBe(0.04);
    expect(old!.inflation).toBe(0.035); // versão anterior intacta
    expect((await plan.loadPlan(A))!.inflation).toBe(0.04);
    expect((await plan.loadPlan(A))!.classes.find((c) => c.name.startsWith("Ações"))!.returns.base).toBe(0.05);
  });
  it("não aplica premissas a classes de outro usuário", async () => {
    const v = (await manage.listAssumptionVersions(A))[0]!;
    const foreign = (await plan.ensureAssetClasses(B))[0]!;
    await expect(manage.createAssumptionVersion(A, { ...v, classes: [{ ...v.classes[0]!, id: foreign.id }] })).rejects.toThrow(/Classe/);
  });
});

describe("simulações e acompanhamento", () => {
  it("salva simulação com resumo recalculado no servidor e isola por usuário", async () => {
    const p = (await plan.loadPlan(A))!;
    const id = await sims.saveSimulation(A, "Aos 65", planToInput(p, 65));
    const mine = await sims.listSimulations(A);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.resumo.retirementAge).toBe(65);
    expect(await sims.listSimulations(B)).toHaveLength(0);
    await sims.deleteSimulation(B, id); // outro usuário não apaga
    expect(await sims.listSimulations(A)).toHaveLength(1);
    await expect(sims.saveSimulation(A, "ruim", { foo: 1 })).rejects.toThrow();
  });
  it("lançamentos mensais: upsert por mês e referência", async () => {
    const p = (await plan.loadPlan(A))!;
    const acc = p.accounts[0]!.id!;
    await tracking.upsertSnapshot(A, { year: 2027, month: 1, balances: { [acc]: 100 }, contribution: 10, note: null });
    await tracking.upsertSnapshot(A, { year: 2027, month: 1, balances: { [acc]: 200 }, contribution: 20, note: "ajuste" });
    const list = await tracking.listSnapshots(A);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ contribution: 20, note: "ajuste", balances: { [acc]: 200 } });
    await expect(tracking.upsertSnapshot(B, { year: 2027, month: 1, balances: { [acc]: 1 }, contribution: 0, note: null })).rejects.toThrow(/Conta/);

    const [sim] = await sims.listSimulations(A);
    await tracking.setReference(A, sim!.id);
    expect((await tracking.getReference(A))!.nome).toBe("Aos 65");
    await expect(tracking.setReference(B, sim!.id)).rejects.toThrow();
    await sims.deleteSimulation(A, sim!.id); // FK on delete set null
    expect(await tracking.getReference(A)).toBeNull();
    await tracking.deleteSnapshot(A, 2027, 1);
    expect(await tracking.listSnapshots(A)).toHaveLength(0);
  });
  it("dados de um usuário não vazam para outro", async () => {
    const rows = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, B));
    expect(rows).toHaveLength(0);
  });
});
