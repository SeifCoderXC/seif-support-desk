import assert from "node:assert/strict";
import test from "node:test";
import { findScenario } from "../products/registry";
import { buildSuggestedReply } from "./suggest";

const refund = findScenario("nordvpn", "refund-boundary");

test("suggested reply is a rule over that scenario's knowledge", () => {
  assert.ok(refund);
  const result = buildSuggestedReply({
    customerName: "Chris Nguyen",
    agentName: "Seif",
    scenario: refund,
  });

  assert.equal(result.source, "rules");
  assert.equal(result.scenarioKey, refund.key);
  assert.match(result.draft, /^Hi Chris,/);
  assert.ok(result.draft.includes(refund.summary));
  refund.replySteps.forEach((step, index) => {
    assert.ok(result.draft.includes(`${index + 1}. ${step}`));
  });
  assert.equal(result.draft.endsWith("Seif"), true);
  assert.match(result.draft, /unhappy about it/);
  assert.doesNotMatch(result.draft, /CyberCare uses/i);
  assert.doesNotMatch(result.draft, /I have issued your refund/i);
  assert.match(result.approach.framing, /does not claim CyberCare uses it/);
  assert.match(result.approach.basis, /Tax, Brown and Chandrashekaran, 1998/);
  assert.match(result.approach.basis, /Smith, Bolton and Wagner, 1999/);
});

test("a blank customer name still produces a greeting", () => {
  assert.ok(refund);
  const result = buildSuggestedReply({
    customerName: "   ",
    agentName: "Seif",
    scenario: refund,
  });
  assert.match(result.draft, /^Hi there,/);
});
