export type KnowledgeSection = {
  heading: string;
  bullets: string[];
};

export type Scenario = {
  key: string;
  title: string;
  summary: string;
  sourceUrls: string[];
  sections: KnowledgeSection[];
  replySteps: string[];
};

export type SampleMessage = {
  id: string;
  authorType: "customer" | "agent";
  authorEmail?: string;
  body: string;
  createdAt: string;
};

export type SampleDraft = {
  agentEmail: string;
  body: string;
};

export type SampleCustomer = {
  id: string;
  name: string;
  email: string;
  plan: string;
  platform: string;
  appVersion: string;
  country: string;
  notes: string;
};

export type SampleTicket = {
  id: string;
  scenarioKey: string;
  subject: string;
  status: "open" | "pending" | "resolved";
  priority: "low" | "normal" | "high" | "urgent";
  channelId: string;
  assigneeEmail: string | null;
  customer: SampleCustomer;
  messages: SampleMessage[];
  drafts: SampleDraft[];
};

export type ProductModule = {
  id: string;
  label: string;
  scenarios: Scenario[];
  samples: SampleTicket[];
};
