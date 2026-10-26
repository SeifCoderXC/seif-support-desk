import { existsSync, readFileSync } from "fs";
import path from "path";
import { customerResponds, type CustomerTurn, type Simulation } from "../knowledge/simulate";

export type VoiceInput = {
  scenarioKey: string;
  current: Simulation;
  agentMessage: string;
  customerName: string;
  recent: { authorName: string; body: string }[];
  mode?: "paraphrase" | "interpret";
  truth?: string[];
};

export type SpokenTurn = CustomerTurn & { voice: "ai" | "rules" };

type ProviderName = "xai" | "anthropic" | "pollinations";

export type AiProvider = {
  name: ProviderName;
  model: string;
};

type Env = Record<string, string | undefined>;

const briefs: Record<string, string> = {
  "kill-switch-split-tunnel":
    "You are on Windows 11. Chrome is excluded by split tunneling. Internet Kill Switch starts on. Protocol starts as NordLynx. A normal site loads only after split tunneling is off, Kill Switch stays on, and you disconnect and connect once. If Kill Switch is turned off, say you do not want to leave it off. Switching protocol while Chrome is still excluded does not restore internet.",
  "login-429-mfa":
    "You are on Android. Nord Account shows Error 429 until you wait 30 minutes. Your phone clock is manual until you turn on automatic date and time. You sign in only after the wait, the automatic clock, and one new authenticator code. You refuse to turn MFA off. Trying again right now keeps Error 429.",
  "website-will-not-load":
    "You are on macOS. The bank site loads while the VPN is paused and fails when connected. Custom DNS and Real-time protection start on. The site loads on the VPN only after Real-time protection is turned off. Turning Custom DNS off, or changing country or protocol, does not fix it by itself.",
  "session-limit":
    "You are on iPhone. Three devices are signed in, under the 10-device limit. You tapped Quick Connect too many times. You connect only after waiting 10 minutes without tapping Quick Connect, then connecting once. More taps reset the wait. Do not sign out of a device unless asked.",
  "refund-boundary":
    "Your first purchase was 1 Sep 2025 on the NordVPN website. The plan renewed on 11 Oct 2026. There is no Refund button. The 30-day guarantee does not cover this renewal. You accept that only when it is explained, and you want auto-renewal cancelled. If a refund of this renewal is promised, say you still do not see a Refund button.",
};

/** Phrases the rule engine already understands. The model may only pick these ids. */
export const actionScripts: Record<string, Record<string, string>> = {
  "kill-switch-split-tunnel": {
    ask_status: "What operating system are you on, is Kill Switch on, and which apps are excluded?",
    split_off: "Turn split tunneling off.",
    reconnect: "Disconnect and connect once.",
    kill_off: "Turn the Internet Kill Switch off.",
    kill_on: "Turn the Internet Kill Switch back on.",
    openvpn: "Switch to OpenVPN.",
  },
  "login-429-mfa": {
    wait: "Wait 30 minutes before the next sign-in.",
    clock: "Turn on automatic date and time.",
    code: "Enter a new authenticator code.",
    disable_mfa: "Turn off MFA.",
    keep_retrying: "Keep trying right now.",
  },
  "website-will-not-load": {
    pause: "Pause the VPN and tell me if the site loads while it is paused.",
    dns_off: "Turn off Custom DNS.",
    protection_off: "Turn off Real-time protection.",
    restore_protection: "Turn protection back on.",
    protocol: "Try a different country.",
  },
  "session-limit": {
    wait: "Wait 10 minutes without Quick Connect.",
    connect_once: "Then connect once.",
    disconnect: "Sign out of an unused device.",
    spam: "Keep tapping Quick Connect again and again.",
  },
  "refund-boundary": {
    explain: "The 30-day guarantee is first purchase only. A renewal is outside that window.",
    cancel: "I can cancel auto-renewal.",
    false_promise: "I will refund this renewal.",
  },
};

const actionHints: Record<string, Record<string, RegExp>> = {
  "kill-switch-split-tunnel": {
    ask_status: /operating system|which apps|what is on|tell me/,
    split_off: /split|exclud|bypass|allowlist|chrome/,
    reconnect: /reconnect|disconnect|connect once|connect one|connect again/,
    kill_off: /kill switch off|disable (?:the )?(?:internet )?kill switch|turn (?:the )?(?:internet )?kill switch off|switch the kill switch off|turn off kill switch/,
    kill_on: /turn (?:the )?(?:internet )?kill switch back on/,
    openvpn: /openvpn|change the protocol|switch protocol/,
  },
  "login-429-mfa": {
    wait: /wait 30|wait thirty|half an hour|30 minutes/,
    clock: /date and time|clock|automatic time|phone time/,
    code: /authenticator|backup code|verification code|new code|mfa code/,
    disable_mfa: /turn off mfa|disable mfa|turn off the authenticator|disable the authenticator/,
    keep_retrying: /keep trying|keep tapping|try again right now|right now/,
  },
  "website-will-not-load": {
    pause: /pause|while it is paused|vpn is off|with the vpn off/,
    dns_off: /custom dns|dns off/,
    protection_off: /real-time protection|threat protection|protection off/,
    restore_protection: /turn protection back on|turn it back on|enable protection/,
    protocol: /different country|another country|switch to openvpn|try openvpn|try nordlynx|change the protocol/,
  },
  "session-limit": {
    wait: /wait 10|wait ten|10 minutes|ten minutes/,
    connect_once: /connect once|one quick connect|single quick connect|then connect/,
    disconnect: /sign out|log out|disconnect/,
    spam: /again and again|keep tapping|keep pressing|a few more times/,
  },
  "refund-boundary": {
    explain: /30-day|first purchase|guarantee|outside that/,
    cancel: /cancel auto-renew|auto-renewal|stop the renewal/,
    false_promise: /refund this renewal|refund your renewal|i will refund|i'll refund|issue a refund|process the refund/,
  },
};

export function groundedActions(scenarioKey: string, message: string, actions: string[]): string[] {
  const hints = actionHints[scenarioKey];
  if (!hints) return [];
  const text = message.toLowerCase();
  return actions.filter((action) => {
    if (scenarioKey === "refund-boundary" && action === "false_promise" && /if the first purchase is still inside 30 days/.test(text)) {
      return false;
    }
    return hints[action]?.test(text) ?? false;
  });
}

export function scriptFor(scenarioKey: string, actions: string[]): string {
  const table = actionScripts[scenarioKey];
  if (!table) return "";
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const action of actions) {
    if (seen.has(action)) continue;
    seen.add(action);
    const line = table[action];
    if (line) parts.push(line);
  }
  return parts.join(" ");
}

function filled(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function selectProvider(env: Env = process.env): AiProvider | null {
  if (filled(env.CUSTOMER_AI)?.toLowerCase() === "off") return null;
  const xaiKey = filled(env.XAI_API_KEY);
  if (xaiKey) return { name: "xai", model: filled(env.XAI_MODEL) ?? "grok-4.7" };
  const anthropicKey = filled(env.ANTHROPIC_API_KEY);
  if (anthropicKey) return { name: "anthropic", model: filled(env.ANTHROPIC_MODEL) ?? "claude-opus-5-5" };
  return { name: "pollinations", model: filled(env.CUSTOMER_AI_MODEL) ?? "openai-fast" };
}

export function parseCustomerJson(raw: string): { actions: string[]; expectsResolved: boolean; lines: string[] } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    const actions = Array.isArray(value.actions)
      ? value.actions.filter((item): item is string => typeof item === "string")
      : [];
    const lines = Array.isArray(value.lines)
      ? value.lines
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 2)
      : [];
    const flag = value.expectsResolved;
    const expectsResolved = flag === true || flag === "true" ? true : flag === false || flag === "false" ? false : null;
    if (expectsResolved === null) return null;
    return { actions, expectsResolved, lines };
  } catch {
    return null;
  }
}

export function linesFit(scenarioKey: string, simulation: Simulation, lines: string[]): boolean {
  if (lines.length < 1 || lines.length > 2) return false;
  if (lines.some((line) => line.trim().length < 2 || line.trim().length > 420)) return false;
  const text = lines.join(" ").toLowerCase().replace(/[’‘]/g, "'");
  if (/as an ai|i cannot|i can't help|please try these steps|you should turn|they explained|the agent said|i thanked them/.test(text)) return false;
  if (/\bthank you\b|\bthanks\b/.test(text) && !/loads|kill switch|signed in|connected|cancel|renewal|429|protection|dns|excluded|internet|refund|clock|waiting|authenticator/.test(text)) {
    return false;
  }
  const facts = simulation.facts;
  if (scenarioKey === "kill-switch-split-tunnel") {
    if (facts.splitTunnel !== false && /split tunneling off|exclusion list|no longer excluded|took chrome off/.test(text)) return false;
    if (facts.killSwitch !== false && /kill switch off|turned kill switch off|turned the internet kill switch off/.test(text)) return false;
    if (facts.protocol !== "OpenVPN" && /openvpn/.test(text)) return false;
    if (facts.reconnected !== true && /disconnected and connected|reconnected/.test(text)) return false;
  }
  if (scenarioKey === "login-429-mfa") {
    if (facts.signedIn !== true && /signed in/.test(text)) return false;
    if (facts.error429 === true && /429 is gone/.test(text)) return false;
  }
  if (scenarioKey === "website-will-not-load") {
    if (facts.siteLoads !== true && /loads with the vpn|bank site loads|site loads/.test(text)) return false;
    if (facts.siteLoads === true && /did not load|didn't load|still fails|still blocked|still won't load/.test(text)) return false;
    if (facts.protection !== false && /protection off|turned real-time protection off|turned off threat protection|threat protection off/.test(text)) return false;
  }
  if (scenarioKey === "session-limit") {
    if (facts.connected !== true && /phone is connected|i'm connected|vpn is connected/.test(text)) return false;
    if (facts.connected === true && /not connected|still waiting|hasn't connected|has not connected/.test(text)) return false;
  }
  if (scenarioKey === "refund-boundary") {
    if (!simulation.resolved && /please cancel auto-renewal|i understand the 30-day/.test(text)) return false;
    if (facts.falsePromise === true && /refund is on the way|thank you for the refund/.test(text)) return false;
  }
  if (!simulation.resolved && /that fixed it|it's fixed|this is fixed/.test(text)) return false;
  if (simulation.resolved && /still no internet|still says error 429|still fails|still blocked|still shows|didn't load|did not load|not connected/.test(text)) {
    return false;
  }
  if (
    simulation.resolved &&
    /\b(i will|i'll|going to|will wait|will try)\b/.test(text) &&
    !/signed in|loads|fixed|connected|still on|cancelled|canceled/.test(text)
  ) {
    return false;
  }
  return true;
}

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  let text = "";
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z0-9_]+$/.test(key) || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  loadEnvFile(path.resolve(process.cwd(), "../.env"));
}

export function parseSpokenLines(raw: string): string[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    if (!Array.isArray(value.lines)) return null;
    const lines = value.lines
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 2);
    return lines.length > 0 ? lines : null;
  } catch {
    return null;
  }
}

function promptFor(input: VoiceInput): { system: string; user: string } {
  if (input.mode === "paraphrase") {
    return {
      system: [
        `You are ${input.customerName}, the customer. You are not the agent.`,
        "Rewrite the truth as 1 or 2 short chat messages in your own words, as someone who just looked at their own screen.",
        "Give the reason you see, not a bare thank-you. Keep every fact. Do not say the problem remains if the truth says it is fixed. Do not say it is fixed if the truth says it is not. Do not add a refund, a setting change, or a result that is not in the truth.",
        'Reply with one JSON object and nothing else: {"lines":["..."]}',
      ].join(" "),
      user: `Truth:\n${(input.truth ?? []).join("\n")}\n\nThe agent said:\n${input.agentMessage.slice(0, 2000)}`,
    };
  }
  const actions = Object.keys(actionScripts[input.scenarioKey] ?? {});
  const history = input.recent
    .slice(-6)
    .map((message) => `${message.authorName}: ${message.body.slice(0, 500)}`)
    .join("\n");
  const system = [
    `You are ${input.customerName}, the customer in a live support chat. You are not the agent.`,
    briefs[input.scenarioKey] ?? "Follow only the instruction you were just given and report what changed.",
    `Allowed action ids: ${actions.join(", ") || "none"}.`,
    "Choose only ids the agent actually asked for. Paraphrases count. Do not invent a refund or a fix.",
    "expectsResolved is true only when those actions fully fix the case.",
    "lines is 1 or 2 short first-person messages in the past tense, as if you already did it. Say what you see now. If the case is fixed, say so. If it is not, say what is still wrong. Contractions are fine. No markdown.",
    'Reply with one JSON object and nothing else: {"actions":[],"expectsResolved":false,"lines":["..."]}',
  ].join(" ");
  const user = [
    `Facts: ${JSON.stringify(input.current.facts)}`,
    history ? `Recent chat:\n${history}` : "",
    `Agent just said:\n${input.agentMessage.slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { system, user };
}

async function postJson(url: string, init: RequestInit): Promise<Response> {
  const send = () => fetch(url, { ...init, signal: AbortSignal.timeout(35000) });
  let response = await send();
  if (response.status === 402 || response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 16000));
    response = await send();
  }
  return response;
}

function readText(provider: ProviderName, data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as {
    output_text?: unknown;
    output?: unknown;
    content?: unknown;
    choices?: { message?: { content?: unknown } }[];
  };
  if (provider === "xai") {
    if (typeof record.output_text === "string") return record.output_text;
    if (!Array.isArray(record.output)) return "";
    const parts: string[] = [];
    for (const item of record.output) {
      if (!item || typeof item !== "object") continue;
      const block = item as { text?: unknown; content?: unknown };
      if (typeof block.text === "string") parts.push(block.text);
      if (!Array.isArray(block.content)) continue;
      for (const part of block.content) {
        if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
          parts.push((part as { text: string }).text);
        }
      }
    }
    return parts.join("\n");
  }
  if (provider === "anthropic") {
    if (!Array.isArray(record.content)) return "";
    return record.content
      .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : ""))
      .join("\n");
  }
  const content = record.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function defaultComplete(input: VoiceInput): Promise<string | null> {
  loadLocalEnv();
  const provider = selectProvider();
  if (!provider) return null;
  const { system, user } = promptFor(input);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let url = "https://text.pollinations.ai/openai";
  let body: unknown = { model: provider.model, messages: [{ role: "system", content: system }, { role: "user", content: user }] };
  if (provider.name === "xai") {
    url = "https://api.x.ai/v1/responses";
    headers.Authorization = `Bearer ${process.env.XAI_API_KEY}`;
    body = { model: provider.model, input: `${system}\n\n${user}` };
  } else if (provider.name === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = process.env.ANTHROPIC_API_KEY ?? "";
    headers["anthropic-version"] = filled(process.env.ANTHROPIC_VERSION) ?? "2026-10-21";
    body = { model: provider.model, max_tokens: 500, system, messages: [{ role: "user", content: user }] };
  }
  const response = await postJson(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) {
    console.warn(`[customer-ai] ${provider.name} HTTP ${response.status}`);
    return null;
  }
  const data = (await response.json()) as unknown;
  const text = readText(provider.name, data).trim();
  return text || null;
}

export async function respondAsCustomer(
  input: VoiceInput,
  complete: (input: VoiceInput) => Promise<string | null> = defaultComplete
): Promise<SpokenTurn> {
  const direct = customerResponds(input.scenarioKey, input.current, input.agentMessage);
  const request: VoiceInput = direct.matched
    ? { ...input, mode: "paraphrase", truth: direct.replies }
    : { ...input, mode: "interpret" };
  let raw: string | null = null;
  try {
    raw = await complete(request);
  } catch (error) {
    console.warn(`[customer-ai] ${error instanceof Error ? error.message : "request failed"}`);
    return { ...direct, voice: "rules" };
  }
  if (!raw) return { ...direct, voice: "rules" };

  if (direct.matched) {
    const lines = parseSpokenLines(raw);
    if (!lines || !linesFit(input.scenarioKey, direct.simulation, lines)) return { ...direct, voice: "rules" };
    return { ...direct, replies: lines, voice: "ai" };
  }

  const parsed = parseCustomerJson(raw);
  if (!parsed) return { ...direct, voice: "rules" };
  const script = scriptFor(input.scenarioKey, groundedActions(input.scenarioKey, input.agentMessage, parsed.actions));
  const turn = script ? customerResponds(input.scenarioKey, input.current, `${input.agentMessage}\n${script}`) : direct;
  const changed = JSON.stringify(turn.simulation) !== JSON.stringify(direct.simulation);
  if (!linesFit(input.scenarioKey, turn.simulation, parsed.lines)) return { ...turn, voice: changed ? "ai" : "rules" };
  return { ...turn, replies: parsed.lines, voice: "ai" };
}
