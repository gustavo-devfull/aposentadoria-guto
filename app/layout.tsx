import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auth, signOut } from "@/auth";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aposentadoria",
  description: "Quanto você terá de renda aos 60 ou 65 anos",
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-fg">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" />
        </svg>
      </span>
      Aposentadoria
    </Link>
  );
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().catch(() => null);
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <header className="border-b border-line bg-surface/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Logo />
            <Suspense><AppNav /></Suspense>
            {session?.user && (
              <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
                <button type="submit" className="text-sm text-muted hover:text-fg">Sair</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">
          Simulação educativa baseada em premissas. Não constitui recomendação de investimento.
          Confira o benefício oficial no Meu INSS.
        </footer>
      </body>
    </html>
  );
}
