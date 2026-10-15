"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { saveExpenses, saveIncomes, saveInss } from "@/db/queries/manage";
import { guarded } from "@/lib/action-result";

export async function saveIncomesAction(rows: unknown) {
  return guarded(async () => { await saveIncomes(await requireUserId(), rows); revalidatePath("/renda-gastos"); });
}
export async function saveExpensesAction(rows: unknown) {
  return guarded(async () => { await saveExpenses(await requireUserId(), rows); revalidatePath("/renda-gastos"); });
}
export async function saveInssAction(v: unknown) {
  return guarded(async () => { await saveInss(await requireUserId(), v); revalidatePath("/renda-gastos"); });
}
