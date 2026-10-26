import type { Scenario } from "../products/types";
import { serviceApproach } from "./approach";

export function customerFirstName(name: string): string {
  const first = name.trim().split(/\s+/)[0];
  return first || "there";
}

export function buildSuggestedReply(input: {
  customerName: string;
  agentName: string;
  scenario: Scenario;
}): { source: "rules"; scenarioKey: string; draft: string; approach: typeof serviceApproach } {
  const steps = input.scenario.replySteps
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");
  const draft = [
    `Hi ${customerFirstName(input.customerName)},`,
    "",
    input.scenario.summary,
    "",
    "You have been dealing with this for a while, and it makes sense to be unhappy about it. I will go through the checks in order, and I will be straight about what this case can change and what it cannot.",
    "",
    "Please try these steps:",
    steps,
    "",
    "Reply with what changed after each step and I will keep going from there.",
    "",
    input.agentName,
  ].join("\n");

  return {
    source: "rules",
    scenarioKey: input.scenario.key,
    draft,
    approach: serviceApproach,
  };
}
