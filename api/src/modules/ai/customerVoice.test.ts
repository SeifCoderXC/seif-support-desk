import assert from "node:assert/strict";
import test from "node:test";
import { customerResponds, initialSimulation } from "../knowledge/simulate";
import { scenarios } from "../products/nordvpn/scenarios";
import { buildSuggestedReply } from "../knowledge/suggest";
import { groundedActions, linesFit, parseCustomerJson, respondAsCustomer, scriptFor, selectProvider } from "./customerVoice";

test("provider prefers SpaceXAI, then a pasted Claude key, then the free endpoint", () => {
  assert.equal(selectProvider({}).name, "pollinations");
  assert.equal(selectProvider({ XAI_API_KEY: " x " }).model, "grok-4.7");
  assert.equal(selectProvider({ XAI_API_KEY: "x", ANTHROPIC_API_KEY: "a" }).name, "xai");
  assert.equal(selectProvider({ ANTHROPIC_API_KEY: "a" }).name, "anthropic");
  assert.equal(selectProvider({ ANTHROPIC_API_KEY: "a" }).model, "claude-opus-5-5");
  assert.equal(selectProvider({ CUSTOMER_AI: "off", XAI_API_KEY: "x" }), null);
  assert.equal(selectProvider({ XAI_API_KEY: " ", ANTHROPIC_API_KEY: "" }).name, "pollinations");
});

test("action scripts drive the same fixes as the case rules", () => {
  const paraphrase = "Please take Chrome out of the exclusion list and then disconnect and connect one time.";
  const kill = customerResponds("kill-switch-split-tunnel", initialSimulation("kill-switch-split-tunnel"), paraphrase);
  assert.equal(kill.simulation.resolved, true);
  assert.equal(kill.simulation.facts.killSwitch, true);
  assert.deepEqual(groundedActions("kill-switch-split-tunnel", paraphrase, ["split_off", "reconnect", "kill_off"]), [
    "split_off",
    "reconnect",
  ]);
  const restored = customerResponds(
    "kill-switch-split-tunnel",
    initialSimulation("kill-switch-split-tunnel"),
    scriptFor("kill-switch-split-tunnel", ["split_off", "reconnect"])
  );
  assert.equal(restored.simulation.resolved, true);
  assert.equal(restored.simulation.facts.killSwitch, true);

  const exposed = customerResponds(
    "kill-switch-split-tunnel",
    initialSimulation("kill-switch-split-tunnel"),
    scriptFor("kill-switch-split-tunnel", ["kill_off", "reconnect"])
  );
  assert.equal(exposed.simulation.resolved, false);

  const signedIn = customerResponds(
    "login-429-mfa",
    initialSimulation("login-429-mfa"),
    scriptFor("login-429-mfa", ["wait", "clock", "code"])
  );
  assert.equal(signedIn.simulation.resolved, true);

  const site = customerResponds(
    "website-will-not-load",
    initialSimulation("website-will-not-load"),
    scriptFor("website-will-not-load", ["protection_off"])
  );
  assert.equal(site.simulation.resolved, true);

  const session = customerResponds(
    "session-limit",
    initialSimulation("session-limit"),
    scriptFor("session-limit", ["wait", "connect_once"])
  );
  assert.equal(session.simulation.resolved, true);

  const refund = customerResponds(
    "refund-boundary",
    initialSimulation("refund-boundary"),
    scriptFor("refund-boundary", ["explain", "cancel"])
  );
  assert.equal(refund.simulation.resolved, true);
  const promised = customerResponds(
    "refund-boundary",
    initialSimulation("refund-boundary"),
    scriptFor("refund-boundary", ["false_promise"])
  );
  assert.equal(promised.simulation.resolved, false);
});

test("a paraphrase is spoken by the model only when it matches the case result", async () => {
  const turn = await respondAsCustomer(
    {
      scenarioKey: "kill-switch-split-tunnel",
      current: initialSimulation("kill-switch-split-tunnel"),
      agentMessage: "Hey, can you take Chrome out of the exclusion list and then disconnect and connect one time?",
      customerName: "Jonas",
      recent: [],
    },
    async () =>
      JSON.stringify({
        actions: ["split_off", "reconnect"],
        expectsResolved: true,
        lines: [
          "Took Chrome off the exclusion list.",
          "Disconnected and connected once. A normal site loads, and Kill Switch is still on.",
        ],
      })
  );
  assert.equal(turn.voice, "ai");
  assert.equal(turn.simulation.resolved, true);
  assert.match(turn.replies.join(" "), /exclusion list/);
});

test("the model cannot declare a Kill Switch shortcut fixed", async () => {
  const turn = await respondAsCustomer(
    {
      scenarioKey: "kill-switch-split-tunnel",
      current: initialSimulation("kill-switch-split-tunnel"),
      agentMessage: "Just switch the kill switch off and reconnect, that is faster.",
      customerName: "Jonas",
      recent: [],
    },
    async () =>
      JSON.stringify({
        actions: ["kill_off", "reconnect"],
        expectsResolved: true,
        lines: ["That fixed it."],
      })
  );
  assert.equal(turn.simulation.resolved, false);
  assert.match(turn.replies.join(" "), /don't want to leave it/i);
  assert.equal(linesFit("kill-switch-split-tunnel", turn.simulation, ["That fixed it."]), false);
});

test("the case guide still wins when the model adds a shortcut", async () => {
  const scenario = scenarios.find((item) => item.key === "kill-switch-split-tunnel");
  assert.ok(scenario);
  const draft = buildSuggestedReply({ customerName: "Jonas Klein", agentName: "Seif", scenario }).draft;
  const turn = await respondAsCustomer(
    {
      scenarioKey: scenario.key,
      current: initialSimulation(scenario.key),
      agentMessage: draft,
      customerName: "Jonas Klein",
      recent: [],
    },
    async () =>
      JSON.stringify({
        actions: ["split_off", "reconnect", "kill_off", "openvpn"],
        expectsResolved: true,
        lines: ["I turned Kill Switch off and switched to OpenVPN. That fixed it."],
      })
  );
  assert.equal(turn.simulation.resolved, true);
  assert.equal(turn.simulation.facts.killSwitch, true);
  assert.equal(turn.simulation.facts.protocol, "NordLynx");
  assert.doesNotMatch(turn.replies.join(" "), /openvpn/i);
});

test("a hedged model can still speak when the lines match the fix", async () => {
  const turn = await respondAsCustomer(
    {
      scenarioKey: "login-429-mfa",
      current: initialSimulation("login-429-mfa"),
      agentMessage: "Wait 30 minutes, turn on automatic date and time, and enter a new authenticator code.",
      customerName: "Elena",
      recent: [],
    },
    async () =>
      JSON.stringify({
        actions: ["wait", "clock", "code"],
        expectsResolved: false,
        lines: ["I waited 30 minutes, set the clock to automatic, and the new code let me in."],
      })
  );
  assert.equal(turn.simulation.resolved, true);
  assert.equal(turn.voice, "ai");
  assert.match(turn.replies[0], /let me in/);
});

test("a customer line cannot deny a fix the case already confirmed", () => {
  const turn = customerResponds(
    "website-will-not-load",
    initialSimulation("website-will-not-load"),
    scriptFor("website-will-not-load", ["protection_off"])
  );
  assert.equal(
    linesFit("website-will-not-load", turn.simulation, [
      "I turned off threat protection, but the bank site still didn’t load while the VPN was on.",
    ]),
    false
  );
  assert.equal(
    linesFit("website-will-not-load", turn.simulation, ["I turned threat protection off and the bank site loads with the VPN on."]),
    true
  );
});

test("a narrator line is not used as the customer", () => {
  const turn = customerResponds(
    "refund-boundary",
    initialSimulation("refund-boundary"),
    scriptFor("refund-boundary", ["explain", "cancel"])
  );
  assert.equal(linesFit("refund-boundary", turn.simulation, ["They explained the guarantee was only for the first purchase."]), false);
  assert.equal(
    linesFit("refund-boundary", turn.simulation, ["Thanks for checking. Please cancel auto-renewal. I get that the renewal is not covered."]),
    true
  );
});

test("JSON wrapped in extra text still parses", () => {
  const parsed = parseCustomerJson('Sure\n```json\n{"actions":["wait"],"expectsResolved":false,"lines":["Waiting now."]}\n```');
  assert.deepEqual(parsed, { actions: ["wait"], expectsResolved: false, lines: ["Waiting now."] });
  assert.equal(parseCustomerJson("no json here"), null);
});
