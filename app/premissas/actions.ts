"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { createAssumptionVersion } from "@/db/queries/manage";
import { guarded } from "@/lib/action-result";

export async function createVersionAction(v: unknown) {
  return guarded(async () => { await createAssumptionVersion(await requireUserId(), v); revalidatePath("/premissas"); });
}
