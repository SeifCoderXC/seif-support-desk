import assert from "node:assert/strict";
import test from "node:test";
import { scenarios } from "../products/nordvpn/scenarios";
import { buildSuggestedReply } from "./suggest";
import { customerResponds, initialSimulation } from "./simulate";

test("the suggested reply resolves each live scenario", () => {
  for (const scenario of scenarios) {
    const draft = buildSuggestedReply({
      customerName: "Test User",
      agentName: "Seif",
      scenario,
    }).draft;
    const turn = customerResponds(scenario.key, initialSimulation(scenario.key), draft);
    assert.equal(turn.simulation.resolved, true, `${scenario.key}: ${turn.replies.join(" ")}`);
  }
});

test("Kill Switch can be turned back on after the wrong shortcut", () => {
  const broken = customerResponds(
    "kill-switch-split-tunnel",
    initialSimulation("kill-switch-split-tunnel"),
    "Turn the Internet Kill Switch off. Disconnect and connect once."
  );
  assert.equal(broken.simulation.facts.killSwitch, false);
  assert.equal(broken.simulation.resolved, false);
  const restored = customerResponds(
    "kill-switch-split-tunnel",
    broken.simulation,
    "Turn the Internet Kill Switch back on."
  );
  assert.equal(restored.simulation.facts.killSwitch, true);
  assert.equal(restored.simulation.resolved, false);
  assert.match(restored.replies.join(" "), /back on/i);
});

test("saying it is fixed does not close a case that is still broken", () => {
  const turn = customerResponds(
    "kill-switch-split-tunnel",
    initialSimulation("kill-switch-split-tunnel"),
    "I have fixed it."
  );
  assert.equal(turn.simulation.resolved, false);
  assert.match(turn.replies.join(" "), /chrome is still excluded/i);
  assert.doesNotMatch(turn.replies.join(" "), /thank you/i);
});

test("a solved case answers with what is actually on the screen", () => {
  const fixed = customerResponds(
    "kill-switch-split-tunnel",
    initialSimulation("kill-switch-split-tunnel"),
    "Turn split tunneling off. Take Chrome out of the exclusion list. Disconnect and connect once."
  );
  const again = customerResponds("kill-switch-split-tunnel", fixed.simulation, "I have fixed it.");
  assert.equal(again.simulation.resolved, true);
  assert.match(again.replies.join(" "), /kill switch is still on/i);
  assert.doesNotMatch(again.replies.join(" "), /still working on my side/i);
});

test("cancelling the plan does not repair the tunnel", () => {
  const turn = customerResponds(
    "kill-switch-split-tunnel",
    initialSimulation("kill-switch-split-tunnel"),
    "Cancel the plan."
  );
  assert.equal(turn.simulation.resolved, false);
  assert.equal(turn.simulation.facts.planCancelled, true);
  assert.match(turn.replies.join(" "), /cancelled the plan/i);
  assert.match(turn.replies.join(" "), /still excluded/i);
});

test("activating an account that is already active changes nothing", () => {
  const turn = customerResponds(
    "session-limit",
    initialSimulation("session-limit"),
    "Activate the account."
  );
  assert.equal(turn.simulation.resolved, false);
  assert.match(turn.replies.join(" "), /already active/i);
  assert.match(turn.replies.join(" "), /not connected/i);
});

test("turning Kill Switch off is not the fix", () => {
  const turn = customerResponds(
    "kill-switch-split-tunnel",
    initialSimulation("kill-switch-split-tunnel"),
    "Turn Kill Switch off and reconnect."
  );
  assert.equal(turn.simulation.resolved, false);
  assert.match(turn.replies.join(" "), /don't want to leave it/i);
});

test("a login code does nothing while Error 429 is still active", () => {
  const first = customerResponds(
    "login-429-mfa",
    initialSimulation("login-429-mfa"),
    "Enter a new authenticator code."
  );
  assert.equal(first.simulation.resolved, false);
  assert.match(first.replies.join(" "), /429/);

  const second = customerResponds(
    "login-429-mfa",
    first.simulation,
    "Wait 30 minutes, turn on automatic date and time, then enter a new authenticator code once."
  );
  assert.equal(second.simulation.resolved, true);
});

test("real-time protection is the website fix, not a protocol change", () => {
  const protocol = customerResponds(
    "website-will-not-load",
    initialSimulation("website-will-not-load"),
    "Switch to OpenVPN and try another country."
  );
  assert.equal(protocol.simulation.resolved, false);

  const protection = customerResponds(
    "website-will-not-load",
    protocol.simulation,
    "Turn off Real-time protection and reload the bank site."
  );
  assert.equal(protection.simulation.resolved, true);
});

test("tapping Quick Connect again does not clear the session limit", () => {
  const turn = customerResponds(
    "session-limit",
    initialSimulation("session-limit"),
    "Keep pressing Quick Connect until it connects."
  );
  assert.equal(turn.simulation.resolved, false);
  assert.match(turn.replies.join(" "), /wait/i);
});

test("a renewal is not refunded", () => {
  const promised = customerResponds(
    "refund-boundary",
    initialSimulation("refund-boundary"),
    "I will refund this renewal today."
  );
  assert.equal(promised.simulation.resolved, false);
  assert.match(promised.replies.join(" "), /Refund button/);

  const handled = customerResponds(
    "refund-boundary",
    initialSimulation("refund-boundary"),
    "A renewal is outside the 30-day guarantee. I can cancel auto-renewal."
  );
  assert.equal(handled.simulation.resolved, true);
  assert.match(handled.replies.join(" "), /cancel auto-renewal/i);
});
