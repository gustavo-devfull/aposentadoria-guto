import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button, Input } from "@/components/ui";

export const dynamic = "force-dynamic";

const POINTS = [
  ["Quanto você tem hoje", "e quanto consegue aportar por mês."],
  ["Rendendo a uma taxa", "Poupança, CDI, pré-fixado ou IPCA+."],
  ["Renda aos 60 ou 65", "somada ao INSS de um salário mínimo, em R$ de hoje e projetado."],
] as const;

export default async function Home() {
  const session = await auth().catch(() => null);
  if (session?.user) redirect("/dashboard");
  return (
    <div className="grid items-center gap-10 py-6 lg:grid-cols-[1.1fr_1fr] lg:py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Quanto você vai ter de renda quando se aposentar?</h1>
        <p className="mt-3 text-muted">Um simulador direto ao ponto.</p>
        <ol className="mt-8 space-y-4">
          {POINTS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
              <span><strong className="font-medium">{t}</strong> <span className="text-muted">{d}</span></span>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Entrar</h2>
        <p className="mt-1 text-sm text-muted">Seu plano fica salvo na sua conta.</p>
        <form className="mt-6" action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
          <Button type="submit" variant="ghost" className="w-full py-2.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.55 10.55 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
            </svg>
            Entrar com Google
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />ou<span className="h-px flex-1 bg-line" /></div>
        <form action={async (fd: FormData) => { "use server"; await signIn("resend", { email: String(fd.get("email")), redirectTo: "/dashboard" }); }} className="space-y-2">
          <Input name="email" type="email" required placeholder="seu@email.com" aria-label="E-mail" />
          <Button type="submit" className="w-full py-2.5">Receber link por e-mail</Button>
        </form>
      </div>
    </div>
  );
}
