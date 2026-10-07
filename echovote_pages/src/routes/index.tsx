import { createFileRoute, Link } from "@tanstack/react-router";
import { EcgLine, SiteHeader, Logo } from "@/components/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EchoVote — Read every heartbeat with AI" },
      { name: "description", content: "Upload an ECG and get beat-level arrhythmia classification from deep learning and machine learning models side by side." },
      { property: "og:title", content: "EchoVote — Read every heartbeat with AI" },
      { property: "og:description", content: "Beat-level ECG arrhythmia classification with DL + ML consensus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  { k: "01", t: "Dual-model consensus", d: "A deep CNN and a classical ML model read the same signal. You see where they agree — and where they don't." },
  { k: "02", t: "Beat-level classes", d: "Every beat sorted into N, S, V, F and Q classes with confidence scores you can inspect." },
  { k: "03", t: "Explainable heatmaps", d: "See which part of the waveform drove each prediction, overlaid directly on the trace." },
];

const stats = [
  { v: "98.4%", l: "Test accuracy" },
  { v: "5", l: "Beat classes" },
  { v: "<2s", l: "Per recording" },
  { v: "2", l: "Independent models" },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <div className="ecg-grid relative overflow-hidden">
        <SiteHeader />
        <section className="relative mx-auto max-w-6xl px-6 pb-16 pt-12 md:pt-20">
          <p className="font-mono-ui inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-accent">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> ECG arrhythmia analysis
          </p>
          <h1 className="font-display mt-6 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            Read every heartbeat, <em className="text-primary">not just the rhythm.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Upload an ECG and EchoVote classifies each beat with two independent AI models, then shows you exactly why.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="glow rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
              Create free account
            </Link>
            <Link to="/login" className="rounded-md border border-border bg-card/60 px-6 py-3 font-semibold transition-colors hover:bg-card">
              I already have one
            </Link>
          </div>
          <div className="mt-14 rounded-xl border border-border bg-card/70 p-4 backdrop-blur">
            <div className="font-mono-ui mb-2 flex justify-between text-xs text-muted-foreground">
              <span>LEAD II · 360 Hz</span>
              <span className="text-accent">● N · Normal beat · 0.97</span>
            </div>
            <EcgLine className="h-28 w-full md:h-36" />
          </div>
        </section>
      </div>

      <section className="border-y border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="border-border px-6 py-8 odd:border-r md:border-r md:last:border-r-0">
              <div className="font-display text-4xl font-semibold">{s.v}</div>
              <div className="font-mono-ui mt-1 text-xs uppercase tracking-widest text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="font-display max-w-xl text-4xl font-semibold tracking-tight">Built for people who read waveforms for a living.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {features.map((f) => (
            <div key={f.k} className="bg-background p-8 transition-colors hover:bg-card">
              <span className="font-mono-ui text-sm text-primary">{f.k}</span>
              <h3 className="mt-4 text-xl font-semibold">{f.t}</h3>
              <p className="mt-2 text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="ecg-grid flex flex-col items-start justify-between gap-6 rounded-2xl border border-border bg-card p-10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold">Your first analysis takes a minute.</h2>
            <p className="mt-2 text-muted-foreground">Sign up, upload a recording, read the result.</p>
          </div>
          <Link to="/signup" className="glow rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground">Get started</Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 md:flex-row">
          <Logo />
          <p className="font-mono-ui text-xs text-muted-foreground">Decision support only — not a substitute for clinical judgement.</p>
        </div>
      </footer>
    </div>
  );
}
