import Link from "next/link";
import { auth, signIn } from "@/auth";
import { Button, Input } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth().catch(() => null);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Simulador de Aposentadoria</h1>
      {session?.user ? (
        <div className="flex gap-3">
          <Link className="underline" href="/dashboard">Dashboard</Link>
          <Link className="underline" href="/onboarding">Editar plano</Link>
        </div>
      ) : (
        <div className="max-w-sm space-y-3">
          <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
            <Button type="submit" className="w-full">Entrar com Google</Button>
          </form>
          <form action={async (fd: FormData) => { "use server"; await signIn("resend", { email: String(fd.get("email")), redirectTo: "/dashboard" }); }} className="space-y-2">
            <Input name="email" type="email" required placeholder="seu@email.com" />
            <Button type="submit" variant="ghost" className="w-full">Receber link por e-mail</Button>
          </form>
        </div>
      )}
    </div>
  );
}
