import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function EcgLine({ className = "" }: { className?: string }) {
  const d =
    "M0 60 H120 L135 60 L145 50 L155 60 H200 L210 70 L222 8 L236 104 L248 60 H300 L320 44 L345 60 H460 L475 60 L485 50 L495 60 H540 L550 70 L562 8 L576 104 L588 60 H640 L660 44 L685 60 H800";
  return (
    <svg viewBox="0 0 800 120" preserveAspectRatio="none" className={className} aria-hidden>
      <path d={d} fill="none" stroke="var(--border)" strokeWidth="2" />
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth="2.5" className="ecg-trace" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M2 12h5l2-5 4 10 2-5h7" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </span>
      <span className="font-display text-xl font-semibold tracking-tight">EchoVote</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Logo />
      <nav className="flex items-center gap-2 text-sm">
        <Link to="/login" className="rounded-md px-4 py-2 text-muted-foreground transition-colors hover:text-foreground">
          Log in
        </Link>
        <Link to="/signup" className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          Sign up
        </Link>
      </nav>
    </header>
  );
}

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="ecg-grid relative hidden flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex">
        <Logo />
        <div>
          <p className="font-mono-ui text-xs uppercase tracking-[0.2em] text-accent">Lead II · 25 mm/s</p>
          <EcgLine className="my-6 h-32 w-full" />
          <blockquote className="font-display text-3xl leading-tight">
            “Two models, one reading. Every beat accounted for.”
          </blockquote>
        </div>
        <p className="font-mono-ui text-xs text-muted-foreground">For research & clinical decision support only.</p>
      </aside>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
        </div>
      </section>
    </main>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        {...props}
        className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}
