import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell, Field } from "@/components/site";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — EchoVote" },
      { name: "description", content: "Log in to EchoVote to analyze ECG recordings." },
      { property: "og:title", content: "Log in — EchoVote" },
      { property: "og:description", content: "Log in to EchoVote to analyze ECG recordings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to continue your analyses."
      footer={<>New here? <Link to="/signup" className="font-semibold text-primary hover:underline">Create an account</Link></>}
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Email" type="email" placeholder="you@hospital.org" required />
        <Field label="Password" type="password" placeholder="••••••••" required />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <input type="checkbox" className="accent-primary" /> Remember me
          </label>
          <a href="#" className="text-primary hover:underline">Forgot password?</a>
        </div>
        <button className="glow w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          Log in
        </button>
      </form>
    </AuthShell>
  );
}
