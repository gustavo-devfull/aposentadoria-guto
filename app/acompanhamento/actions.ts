"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { deleteSnapshot, setReference, upsertSnapshot } from "@/db/queries/tracking";
import { guarded } from "@/lib/action-result";

export async function saveSnapshotAction(v: unknown) {
  return guarded(async () => { await upsertSnapshot(await requireUserId(), v); revalidatePath("/acompanhamento"); });
}
export async function deleteSnapshotAction(year: number, month: number) {
  return guarded(async () => { await deleteSnapshot(await requireUserId(), year, month); revalidatePath("/acompanhamento"); });
}
export async function setReferenceAction(simulationId: string | null) {
  return guarded(async () => { await setReference(await requireUserId(), simulationId); revalidatePath("/acompanhamento"); });
}
