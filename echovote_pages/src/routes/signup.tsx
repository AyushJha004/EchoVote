import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthShell, Field } from "@/components/site";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — EchoVote" },
      { name: "description", content: "Create a EchoVote account and start analyzing ECGs." },
      { property: "og:title", content: "Sign up — EchoVote" },
      { property: "og:description", content: "Create a EchoVote account and start analyzing ECGs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

function Signup() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start reading ECGs with AI in minutes."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link></>}
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <Field label="Full name" placeholder="Dr. Asha Rao" required />
        <Field label="Email" type="email" placeholder="you@hospital.org" required />
        <Field label="Organisation (optional)" placeholder="Hospital or lab" />
        <Field label="Password" type="password" placeholder="At least 8 characters" minLength={8} required />
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-1 accent-primary" required />
          I understand EchoVote is for decision support, not diagnosis.
        </label>
        <button className="glow w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5">
          Create account
        </button>
      </form>
    </AuthShell>
  );
}
