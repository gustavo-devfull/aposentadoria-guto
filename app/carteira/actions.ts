"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { saveAccounts, saveContributionSettings, saveExtras, savePauses } from "@/db/queries/manage";
import { guarded } from "@/lib/action-result";

export async function saveAccountsAction(rows: unknown) {
  return guarded(async () => { await saveAccounts(await requireUserId(), rows); revalidatePath("/carteira"); });
}
export async function saveContributionAction(v: unknown) {
  return guarded(async () => { await saveContributionSettings(await requireUserId(), v); revalidatePath("/carteira"); });
}
export async function saveExtrasAction(rows: unknown) {
  return guarded(async () => { await saveExtras(await requireUserId(), rows); revalidatePath("/carteira"); });
}
export async function savePausesAction(rows: unknown) {
  return guarded(async () => { await savePauses(await requireUserId(), rows); revalidatePath("/carteira"); });
}
