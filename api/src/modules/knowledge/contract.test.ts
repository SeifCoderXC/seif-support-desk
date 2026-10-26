import assert from "node:assert/strict";
import test from "node:test";
import { findChannel } from "../channels";
import { products } from "../products/registry";
import { staffList } from "../staff";

test("each scenario is one seeded ticket plus its knowledge", () => {
  const staffEmails = new Set<string>(staffList.map((agent) => agent.email));
  const ticketIds = new Set<string>();
  const customerIds = new Set<string>();

  assert.ok(products.length > 0);

  for (const product of products) {
    const scenarioKeys = new Set(product.scenarios.map((scenario) => scenario.key));
    assert.equal(scenarioKeys.size, product.scenarios.length);

    for (const scenario of product.scenarios) {
      assert.ok(scenario.summary.length > 0);
      assert.ok(scenario.sections.length > 0);
      assert.ok(scenario.replySteps.length > 0);
      assert.ok(scenario.sourceUrls.length > 0);
      for (const url of scenario.sourceUrls) {
        assert.match(url, /^https:\/\/support\.nordvpn\.com\//);
      }
      for (const section of scenario.sections) {
        assert.ok(section.heading.length > 0);
        assert.ok(section.bullets.length > 0);
      }
      assert.equal(
        product.samples.filter((sample) => sample.scenarioKey === scenario.key).length,
        1
      );
    }

    for (const sample of product.samples) {
      assert.equal(ticketIds.has(sample.id), false);
      ticketIds.add(sample.id);
      assert.equal(customerIds.has(sample.customer.id), false);
      customerIds.add(sample.customer.id);
      assert.ok(scenarioKeys.has(sample.scenarioKey));
      assert.ok(findChannel(sample.channelId));
      assert.ok(sample.messages.length > 0);
      if (sample.assigneeEmail) assert.ok(staffEmails.has(sample.assigneeEmail));
      for (const draft of sample.drafts) assert.ok(staffEmails.has(draft.agentEmail));
      for (const message of sample.messages) {
        assert.ok(message.body.length > 0);
        if (message.authorType === "agent") {
          assert.ok(message.authorEmail && staffEmails.has(message.authorEmail));
        }
      }
    }
  }
});
