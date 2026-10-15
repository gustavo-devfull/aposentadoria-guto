import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { fromDbMoney, toDbMoney } from "@/lib/money";
import { planInputSchema, type PlanInput } from "@/lib/plan";

export async function loadPlan(userId: string): Promise<PlanInput | null> {
  const [row] = await getDb().select().from(plans).where(eq(plans.userId, userId));
  if (!row) return null;
  return {
    birthDate: row.dataNascimento,
    invested: fromDbMoney(row.investido),
    monthly: fromDbMoney(row.aporteMensal),
    annualRate: Number(row.taxaAnual),
    inflation: Number(row.inflacao),
    inssBenefit: fromDbMoney(row.inssBeneficio),
    inssStartAge: row.inssIdade,
    horizonAge: row.horizonteIdade,
  };
}

/** Valida no servidor e grava (cria ou substitui) o plano do usuário. */
export async function savePlan(userId: string, raw: unknown) {
  const p = planInputSchema.parse(raw);
  const values = {
    dataNascimento: p.birthDate,
    investido: toDbMoney(p.invested),
    aporteMensal: toDbMoney(p.monthly),
    taxaAnual: String(p.annualRate),
    inflacao: String(p.inflation),
    inssBeneficio: toDbMoney(p.inssBenefit),
    inssIdade: p.inssStartAge,
    horizonteIdade: p.horizonAge,
    updatedAt: new Date(),
  };
  await getDb().insert(plans).values({ userId, ...values }).onConflictDoUpdate({ target: plans.userId, set: values });
}
