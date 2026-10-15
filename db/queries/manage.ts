import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  accounts, assetClasses, assumptionSets, contributionPauses, expenseGoals, extraContributions, incomeSources, inssSettings,
} from "@/db/schema";
import { assumptionInputSchema, type AssumptionInput, type AssumptionVersion } from "@/lib/assumptions";
import { ensureAssetClasses, saveContributionPlan } from "@/db/queries/plan";
import { fromDbMoney, toDbMoney } from "@/lib/money";
import {
  allocationSchema, extraFormSchema, incomeFormSchema, inssIncreaseSchema, pauseFormSchema, planFormSchema,
} from "@/lib/plan";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = (ym: string) => `${ym}-01`;
const monthEnd = (ym: string) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

// ---- Contas: upsert por id (preserva vínculos com os lançamentos mensais) ----
export const accountsListSchema = planFormSchema.shape.accounts;

export async function saveAccounts(userId: string, raw: unknown) {
  const list = accountsListSchema.parse(raw);
  const db = getDb();
  const owned = new Set((await ensureAssetClasses(userId)).map((c) => c.id));
  for (const a of list) if (!owned.has(a.classId)) throw new Error("Classe de ativo inválida");

  const existing = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.userId, userId));
  const existingIds = new Set(existing.map((e) => e.id));
  const keepIds = list.filter((a) => a.id && existingIds.has(a.id)).map((a) => a.id!);

  if (keepIds.length) await db.delete(accounts).where(and(eq(accounts.userId, userId), notInArray(accounts.id, keepIds)));
  else await db.delete(accounts).where(eq(accounts.userId, userId));

  for (const a of list) {
    const values = {
      nome: a.name, assetClassId: a.classId, instituicao: a.institution ?? null, saldoAtual: toDbMoney(a.balance),
      custoBase: toDbMoney(a.costBasis), dataReferencia: today(), incluirNaAposentadoria: a.included,
    };
    if (a.id && existingIds.has(a.id)) await db.update(accounts).set(values).where(and(eq(accounts.id, a.id), eq(accounts.userId, userId)));
    else await db.insert(accounts).values({ userId, ...values });
  }
}

// ---- Aportes: plano, alocação alvo, extras, pausas ----
export const contributionSettingsSchema = z.object({
  monthly: z.number().min(0),
  realGrowth: z.number().min(-0.5).max(1),
  allocation: allocationSchema,
});

export async function saveContributionSettings(userId: string, raw: unknown) {
  const v = contributionSettingsSchema.parse(raw);
  const owned = new Set((await ensureAssetClasses(userId)).map((c) => c.id));
  for (const id of Object.keys(v.allocation)) if (!owned.has(id)) throw new Error("Classe de ativo inválida");
  await saveContributionPlan(userId, { monthly: v.monthly, realGrowth: v.realGrowth }, v.allocation);
}

export const extrasListSchema = z.array(extraFormSchema);
export async function saveExtras(userId: string, raw: unknown) {
  const list = extrasListSchema.parse(raw);
  const db = getDb();
  await db.delete(extraContributions).where(eq(extraContributions.userId, userId));
  if (list.length)
    await db.insert(extraContributions).values(
      list.map((e) => ({
        userId, descricao: e.description, valor: toDbMoney(e.amount), mes: e.month, ano: e.yearly ? null : e.year, recorrenteAnual: e.yearly,
      })),
    );
}

export const pausesListSchema = z.array(pauseFormSchema);
export async function savePauses(userId: string, raw: unknown) {
  const list = pausesListSchema.parse(raw);
  const db = getDb();
  await db.delete(contributionPauses).where(eq(contributionPauses.userId, userId));
  if (list.length)
    await db.insert(contributionPauses).values(
      list.map((p) => ({ userId, dataInicio: monthStart(p.from), dataFim: monthEnd(p.to), motivo: p.reason })),
    );
}

// ---- Renda e gastos ----
export const incomesListSchema = z.array(incomeFormSchema);
export async function saveIncomes(userId: string, raw: unknown) {
  const list = incomesListSchema.parse(raw);
  const db = getDb();
  // O INSS vive em inss_settings; aqui só as demais fontes.
  await db.delete(incomeSources).where(eq(incomeSources.userId, userId));
  if (list.length)
    await db.insert(incomeSources).values(
      list.map((i) => ({
        userId, tipo: i.type, descricao: i.description, valorMensalHoje: toDbMoney(i.monthly), idadeInicio: i.startAge,
        idadeFim: i.endAge, crescimentoReal: String(i.realGrowth), tributavel: i.taxable,
      })),
    );
}

export const expensesListSchema = planFormSchema.shape.expenses;
export async function saveExpenses(userId: string, raw: unknown) {
  const list = expensesListSchema.parse(raw);
  const db = getDb();
  await db.delete(expenseGoals).where(eq(expenseGoals.userId, userId));
  await db.insert(expenseGoals).values(
    list.map((e) => ({
      userId, categoria: e.category, valorMensal: toDbMoney(e.monthly), idadeInicio: e.startAge, idadeFim: e.endAge,
      inflacaoExtraAnual: String(e.extraInflation), degraus: e.ageSteps,
    })),
  );
}

export const inssSettingsSchema = planFormSchema.shape.inss.extend({ increase: inssIncreaseSchema.nullable() });
export async function saveInss(userId: string, raw: unknown) {
  const v = inssSettingsSchema.parse(raw);
  const set = {
    anosContribuicaoAtual: String(v.contributionYears),
    salarioContribuicaoAtual: toDbMoney(v.contributionSalary),
    beneficioEstimado: toDbMoney(v.benefit),
    idadeInicioBeneficio: v.startAge,
    crescimentoRealMinimo: String(v.realGrowth),
    dataReferencia: today(),
    cenarioAumentoContribuicao: v.increase,
  };
  const updated = await getDb().update(inssSettings).set(set).where(eq(inssSettings.userId, userId)).returning({ id: inssSettings.userId });
  if (updated.length === 0) throw new Error("Conclua o onboarding antes de editar o INSS");
}

// ---- Premissas versionadas ----
function rowToVersion(r: typeof assumptionSets.$inferSelect): AssumptionVersion {
  const n = (v: string | null) => (v == null ? null : Number(v));
  return {
    versao: r.versao,
    createdAt: r.createdAt.toISOString(),
    nome: r.nome,
    inflation: Number(r.inflacaoLongoPrazo),
    scenario: r.cenario,
    method: r.metodoRetirada,
    redemptionOrder: r.ordemResgate,
    fixedWithdrawalRate: n(r.taxaRetirada),
    minimumWage: fromDbMoney(r.salarioMinimo),
    ceiling: fromDbMoney(r.tetoInss),
    notes: r.observacoes,
    classes: r.classes ?? [],
  };
}

export async function listAssumptionVersions(userId: string): Promise<AssumptionVersion[]> {
  const rows = await getDb().select().from(assumptionSets).where(eq(assumptionSets.userId, userId)).orderBy(desc(assumptionSets.versao));
  return rows.map(rowToVersion);
}

/**
 * Cria uma NOVA versão (nunca sobrescreve) e sincroniza as classes de ativos com o snapshot,
 * para que o motor passe a usar os novos retornos.
 */
export async function createAssumptionVersion(userId: string, raw: unknown): Promise<number> {
  const v: AssumptionInput = assumptionInputSchema.parse(raw);
  const db = getDb();
  const owned = await ensureAssetClasses(userId);
  const ownedIds = new Set(owned.map((c) => c.id));
  for (const c of v.classes) if (!ownedIds.has(c.id)) throw new Error("Classe de ativo inválida");

  const [last] = await db.select({ versao: assumptionSets.versao }).from(assumptionSets)
    .where(eq(assumptionSets.userId, userId)).orderBy(desc(assumptionSets.versao)).limit(1);
  const versao = (last?.versao ?? 0) + 1;

  await db.insert(assumptionSets).values({
    userId, nome: v.nome, versao,
    inflacaoLongoPrazo: String(v.inflation), cenario: v.scenario, metodoRetirada: v.method, ordemResgate: v.redemptionOrder,
    taxaRetirada: v.fixedWithdrawalRate === null ? null : String(v.fixedWithdrawalRate),
    observacoes: v.notes, salarioMinimo: toDbMoney(v.minimumWage), tetoInss: toDbMoney(v.ceiling), classes: v.classes,
  });
  for (const c of v.classes)
    await db.update(assetClasses).set({
      retornoRealPessimista: String(c.pessimista), retornoRealBase: String(c.base), retornoRealOtimista: String(c.otimista),
      taxaRealContratada: c.contracted === null ? null : String(c.contracted), custoAnual: String(c.annualCost),
    }).where(and(eq(assetClasses.id, c.id), eq(assetClasses.userId, userId), inArray(assetClasses.id, [...ownedIds])));
  return versao;
}
