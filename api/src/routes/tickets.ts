import { Prisma, type Agent, type Customer, type Ticket } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import type { AuthAgent } from "../auth";
import { requireAgent } from "../auth";
import { findChannel } from "../modules/channels";
import { respondAsCustomer } from "../modules/ai/customerVoice";
import { readSimulation } from "../modules/knowledge/simulate";
import { buildSuggestedReply } from "../modules/knowledge/suggest";
import { findProduct, findScenario } from "../modules/products/registry";
import { prisma } from "../db";
import { HttpError, wrap } from "../errors";

export const ticketRouter = Router();

ticketRouter.use(requireAgent);

const statusSchema = z.enum(["open", "pending", "resolved"]);
const prioritySchema = z.enum(["low", "normal", "high", "urgent"]);

const listQuerySchema = z.object({
  status: statusSchema.optional(),
});

const patchSchema = z
  .object({
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    assigneeId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

const messageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

const draftSchema = z.object({
  body: z.string().max(5000),
});

type TicketWithPeople = Ticket & {
  customer: Customer;
  assignee: Agent | null;
};

function presentTicket(ticket: TicketWithPeople, preview = "") {
  const channel = findChannel(ticket.channelId);
  const product = findProduct(ticket.productId);
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    channelId: ticket.channelId,
    channelLabel: channel?.label ?? ticket.channelId,
    productId: ticket.productId,
    productLabel: product?.label ?? ticket.productId,
    scenarioKey: ticket.scenarioKey,
    preview,
    customer: {
      id: ticket.customer.id,
      name: ticket.customer.name,
      email: ticket.customer.email,
      plan: ticket.customer.plan,
      platform: ticket.customer.platform,
      appVersion: ticket.customer.appVersion,
      country: ticket.customer.country,
      notes: ticket.customer.notes,
    },
    assignee: ticket.assignee
      ? { id: ticket.assignee.id, name: ticket.assignee.name, email: ticket.assignee.email }
      : null,
    simulation: presentSimulation(ticket.scenarioKey, ticket.simulation),
    createdAt: ticket.createdAt.toISOString(),
    lastActivityAt: ticket.lastActivityAt.toISOString(),
  };
}

function presentSimulation(scenarioKey: string, raw: unknown) {
  const simulation = readSimulation(scenarioKey, raw);
  return {
    resolved: simulation.resolved,
    outcome: simulation.outcome,
    situation: simulation.situation,
    facts: simulation.facts,
  };
}

function presentScenario(productId: string, scenarioKey: string) {
  const scenario = findScenario(productId, scenarioKey);
  if (!scenario) return null;
  return {
    key: scenario.key,
    title: scenario.title,
    summary: scenario.summary,
    sourceUrls: scenario.sourceUrls,
    sections: scenario.sections,
  };
}

async function loadTicket(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { customer: true, assignee: true },
  });
  if (!ticket) {
    throw new HttpError(404, "not_found", "Ticket not found");
  }
  return ticket;
}

ticketRouter.get(
  "/",
  wrap(async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const tickets = await prisma.ticket.findMany({
      where: query.status ? { status: query.status } : undefined,
      include: {
        customer: true,
        assignee: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { lastActivityAt: "desc" },
    });
    res.json({
      tickets: tickets.map((ticket) => presentTicket(ticket, ticket.messages[0]?.body ?? "")),
    });
  })
);

ticketRouter.get(
  "/:id",
  wrap(async (req, res) => {
    const ticket = await loadTicket(req.params.id);
    const messages = await prisma.message.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({
      ticket: presentTicket(ticket),
      messages: messages.map((message) => ({
        id: message.id,
        authorType: message.authorType,
        authorName: message.authorName,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
      scenario: presentScenario(ticket.productId, ticket.scenarioKey),
    });
  })
);

ticketRouter.patch(
  "/:id",
  wrap(async (req, res) => {
    const body = patchSchema.parse(req.body);
    await loadTicket(req.params.id);
    if (body.assigneeId) {
      const agent = await prisma.agent.findUnique({ where: { id: body.assigneeId } });
      if (!agent) throw new HttpError(404, "not_found", "Assignee not found");
    }
    await prisma.ticket.update({
      where: { id: req.params.id },
      data: {
        status: body.status,
        priority: body.priority,
        assigneeId: body.assigneeId,
        lastActivityAt: new Date(),
      },
    });
    const updated = await loadTicket(req.params.id);
    res.json({ ticket: presentTicket(updated) });
  })
);

ticketRouter.post(
  "/:id/messages",
  wrap(async (req, res) => {
    const body = messageSchema.parse(req.body);
    const agent = res.locals.agent as AuthAgent;
    const ticket = await loadTicket(req.params.id);
    const createdAt = new Date();
    const recent = await prisma.message.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    });
    const turn = await respondAsCustomer({
      scenarioKey: ticket.scenarioKey,
      current: readSimulation(ticket.scenarioKey, ticket.simulation),
      agentMessage: body.body,
      customerName: ticket.customer.name,
      recent: recent.reverse().map((message) => ({ authorName: message.authorName, body: message.body })),
    });
    const saved = await prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          id: `msg_${createdAt.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
          ticketId: ticket.id,
          authorType: "agent",
          authorName: agent.name,
          agentId: agent.id,
          body: body.body,
          createdAt,
        },
      });
      const customerReplies = [];
      for (let index = 0; index < turn.replies.length; index += 1) {
        customerReplies.push(
          await tx.message.create({
            data: {
              id: `msg_${createdAt.getTime()}_c${index}_${Math.random().toString(36).slice(2, 6)}`,
              ticketId: ticket.id,
              authorType: "customer",
              authorName: ticket.customer.name,
              body: turn.replies[index],
              createdAt: new Date(createdAt.getTime() + (index + 1) * 1000),
            },
          })
        );
      }
      const updated = await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          simulation: turn.simulation as unknown as Prisma.InputJsonValue,
          lastActivityAt: new Date(createdAt.getTime() + turn.replies.length * 1000),
          status: turn.simulation.resolved ? "resolved" : ticket.status === "resolved" ? "open" : undefined,
        },
        include: { customer: true, assignee: true },
      });
      return { message, customerReplies, updated };
    });
    res.status(201).json({
      message: presentMessage(saved.message),
      customerReplies: saved.customerReplies.map(presentMessage),
      ticket: presentTicket(saved.updated),
      voice: turn.voice,
    });
  })
);

function presentMessage(message: { id: string; authorType: string; authorName: string; body: string; createdAt: Date }) {
  return {
    id: message.id,
    authorType: message.authorType,
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

ticketRouter.get(
  "/:id/draft",
  wrap(async (req, res) => {
    const agent = res.locals.agent as AuthAgent;
    await loadTicket(req.params.id);
    const draft = await prisma.draft.findUnique({
      where: { ticketId_agentId: { ticketId: req.params.id, agentId: agent.id } },
    });
    res.json({
      body: draft?.body ?? "",
      updatedAt: draft?.updatedAt.toISOString() ?? null,
    });
  })
);

ticketRouter.put(
  "/:id/draft",
  wrap(async (req, res) => {
    const body = draftSchema.parse(req.body);
    const agent = res.locals.agent as AuthAgent;
    await loadTicket(req.params.id);
    const id = `draft_${req.params.id}_${agent.id}`;
    if (body.body.length === 0) {
      await prisma.draft.deleteMany({
        where: { ticketId: req.params.id, agentId: agent.id },
      });
      res.json({ body: "", updatedAt: null });
      return;
    }
    const draft = await prisma.draft.upsert({
      where: { ticketId_agentId: { ticketId: req.params.id, agentId: agent.id } },
      create: { id, ticketId: req.params.id, agentId: agent.id, body: body.body },
      update: { body: body.body },
    });
    res.json({ body: draft.body, updatedAt: draft.updatedAt.toISOString() });
  })
);

ticketRouter.get(
  "/:id/suggestion",
  wrap(async (req, res) => {
    const agent = res.locals.agent as AuthAgent;
    const ticket = await loadTicket(req.params.id);
    const scenario = findScenario(ticket.productId, ticket.scenarioKey);
    if (!scenario) {
      throw new HttpError(404, "not_found", "No knowledge is registered for this ticket");
    }
    res.json(
      buildSuggestedReply({
        customerName: ticket.customer.name,
        agentName: agent.name,
        scenario,
      })
    );
  })
);

export const agentRouter = Router();

agentRouter.use(requireAgent);

agentRouter.get(
  "/",
  wrap(async (_req, res) => {
    const agents = await prisma.agent.findMany({ orderBy: { name: "asc" } });
    res.json({
      agents: agents.map((agent) => ({ id: agent.id, name: agent.name, email: agent.email })),
    });
  })
);
