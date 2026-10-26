import { FormEvent, useState } from "react";
import { api, messageFrom } from "../api";
import type { Agent } from "../types";

export function LoginPage({ onSuccess }: { onSuccess: (token: string, agent: Agent) => void }) {
  const [email, setEmail] = useState("agent@support-console.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await api.login(email, password);
      onSuccess(result.token, result.agent);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login">
      <section className="login-intro">
        <p className="mark">Seif</p>
        <h1>Agent desk</h1>
        <p>
          A local desk for five NordVPN scenarios. Change the customer’s settings, then wait while
          they try the step and write back.
        </p>
      </section>
      <form className="login-card" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
        <p className="hint">
          You sign in as Seif. The password is <code>support-local</code> unless{" "}
          <code>SEED_AGENT_PASSWORD</code> was changed. Mina Kovacs uses the same password.
        </p>
      </form>
    </main>
  );
}
