export type Status = "open" | "pending" | "resolved";
export type Priority = "low" | "normal" | "high" | "urgent";

export type Agent = {
  id: string;
  name: string;
  email: string;
};

export type Customer = {
  id: string;
  name: string;
  email: string;
  plan: string;
  platform: string;
  appVersion: string;
  country: string;
  notes: string;
};

export type Ticket = {
  id: string;
  subject: string;
  status: Status;
  priority: Priority;
  channelLabel: string;
  productLabel: string;
  scenarioKey: string;
  preview: string;
  customer: Customer;
  assignee: Agent | null;
  simulation: {
    resolved: boolean;
    outcome: string | null;
    situation: string;
    facts: Record<string, boolean | string>;
  };
  createdAt: string;
  lastActivityAt: string;
};

export type Message = {
  id: string;
  authorType: "customer" | "agent";
  authorName: string;
  body: string;
  createdAt: string;
};

export type ScenarioView = {
  key: string;
  title: string;
  summary: string;
  sourceUrls: string[];
  sections: { heading: string; bullets: string[] }[];
};

export type ServiceApproach = {
  name: string;
  framing: string;
  basis: string;
  moves: { label: string; text: string }[];
};

export type Suggestion = {
  source: "rules";
  scenarioKey: string;
  draft: string;
  approach: ServiceApproach;
};

export type TicketDetail = {
  ticket: Ticket;
  messages: Message[];
  scenario: ScenarioView | null;
};
