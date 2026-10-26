import { useEffect, useState } from "react";
import { api } from "./api";
import { ConsolePage } from "./console/ConsolePage";
import { LoginPage } from "./auth/LoginPage";
import type { Agent } from "./types";

const TOKEN_KEY = "support-console.token";

export function App() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [agent, setAgent] = useState<Agent | null>(null);
  const [ready, setReady] = useState(token === null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api
      .me(token)
      .then((result) => {
        if (!cancelled) setAgent(result.agent);
      })
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY);
        if (!cancelled) {
          setToken(null);
          setAgent(null);
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function signIn(nextToken: string, nextAgent: Agent) {
    sessionStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setAgent(nextAgent);
    setReady(true);
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAgent(null);
  }

  if (!token) return <LoginPage onSuccess={signIn} />;
  if (!ready || !agent) return <p className="boot">Opening the console…</p>;
  return <ConsolePage token={token} agent={agent} onSignOut={signOut} onUnauthorized={signOut} />;
}
