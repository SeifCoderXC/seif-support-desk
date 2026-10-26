import bcrypt from "bcryptjs";
import { Prisma, PrismaClient, type AuthorType } from "@prisma/client";
import { findChannel } from "../src/modules/channels";
import { initialSimulation } from "../src/modules/knowledge/simulate";
import { findScenario, products } from "../src/modules/products/registry";
import type { SampleTicket } from "../src/modules/products/types";
import { staffList } from "../src/modules/staff";

const prisma = new PrismaClient();

function requiredPassword(): string {
  const password = process.env.SEED_AGENT_PASSWORD || "support-local";
  if (password.length < 8) {
    throw new Error("SEED_AGENT_PASSWORD must be at least 8 characters");
  }
  return password;
}

function activityBounds(sample: SampleTicket): { createdAt: Date; lastActivityAt: Date } {
  const times = sample.messages.map((message) => new Date(message.createdAt).getTime());
  return {
    createdAt: new Date(Math.min(...times)),
    lastActivityAt: new Date(Math.max(...times)),
  };
}

async function main() {
  const passwordHash = await bcrypt.hash(requiredPassword(), 10);
  const agents = new Map<string, { id: string; name: string }>();

  for (const agent of staffList) {
    const saved = await prisma.agent.upsert({
      where: { email: agent.email },
      create: { id: agent.id, email: agent.email, name: agent.name, passwordHash },
      update: { name: agent.name, passwordHash },
    });
    agents.set(saved.email, { id: saved.id, name: saved.name });
  }

  for (const product of products) {
    for (const sample of product.samples) {
      if (!findScenario(product.id, sample.scenarioKey)) {
        throw new Error(`Ticket ${sample.id} uses unknown scenario ${sample.scenarioKey}`);
      }
      if (!findChannel(sample.channelId)) {
        throw new Error(`Ticket ${sample.id} uses unknown channel ${sample.channelId}`);
      }
      const assignee = sample.assigneeEmail ? agents.get(sample.assigneeEmail) : null;
      if (sample.assigneeEmail && !assignee) {
        throw new Error(`Ticket ${sample.id} assigns unknown agent ${sample.assigneeEmail}`);
      }
      const bounds = activityBounds(sample);

      const { id: customerId, ...customerData } = sample.customer;
      await prisma.customer.upsert({
        where: { id: customerId },
        create: sample.customer,
        update: customerData,
      });

      await prisma.ticket.upsert({
        where: { id: sample.id },
        create: {
          id: sample.id,
          subject: sample.subject,
          status: sample.status,
          priority: sample.priority,
          channelId: sample.channelId,
          productId: product.id,
          scenarioKey: sample.scenarioKey,
          customerId: sample.customer.id,
          assigneeId: assignee?.id ?? null,
          simulation: initialSimulation(sample.scenarioKey) as Prisma.InputJsonValue,
          createdAt: bounds.createdAt,
          lastActivityAt: bounds.lastActivityAt,
        },
        update: {
          subject: sample.subject,
          status: sample.status,
          priority: sample.priority,
          channelId: sample.channelId,
          productId: product.id,
          scenarioKey: sample.scenarioKey,
          customerId: sample.customer.id,
          assigneeId: assignee?.id ?? null,
          simulation: initialSimulation(sample.scenarioKey) as Prisma.InputJsonValue,
          createdAt: bounds.createdAt,
          lastActivityAt: bounds.lastActivityAt,
        },
      });

      await prisma.message.deleteMany({ where: { ticketId: sample.id } });
      await prisma.message.createMany({
        data: sample.messages.map((message) => {
          const author = message.authorEmail ? agents.get(message.authorEmail) : undefined;
          if (message.authorType === "agent" && !author) {
            throw new Error(`Message ${message.id} uses unknown agent ${message.authorEmail}`);
          }
          return {
            id: message.id,
            ticketId: sample.id,
            authorType: message.authorType as AuthorType,
            authorName: author?.name ?? sample.customer.name,
            agentId: author?.id ?? null,
            body: message.body,
            createdAt: new Date(message.createdAt),
          };
        }),
      });

      await prisma.draft.deleteMany({ where: { ticketId: sample.id } });
      if (sample.drafts.length > 0) {
        await prisma.draft.createMany({
          data: sample.drafts.map((draft) => {
            const agent = agents.get(draft.agentEmail);
            if (!agent) throw new Error(`Draft on ${sample.id} uses unknown agent ${draft.agentEmail}`);
            return {
              id: `draft_${sample.id}_${agent.id}`,
              ticketId: sample.id,
              agentId: agent.id,
              body: draft.body,
            };
          }),
        });
      }
    }
  }

  console.log(`Seeded ${staffList.length} agents and the product sample tickets.`);
  for (const agent of staffList) console.log(`  ${agent.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
