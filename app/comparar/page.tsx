import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listSimulationsWithInput } from "@/db/queries/tracking";
import { CompareView } from "@/components/compare-view";

export const dynamic = "force-dynamic";

export default async function CompararPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const sims = (await listSimulationsWithInput(session.user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <CompareView sims={sims} />;
}
