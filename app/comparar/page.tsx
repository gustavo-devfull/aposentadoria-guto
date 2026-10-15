import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listScenarios } from "@/db/queries/scenarios";
import { CompareView } from "@/components/compare-view";

export const dynamic = "force-dynamic";

export default async function CompararPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <CompareView scenarios={await listScenarios(session.user.id)} />;
}
