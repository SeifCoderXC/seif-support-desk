import { Router } from "express";
import { z } from "zod";
import { checkPassword, requireAgent, signToken, type AuthAgent } from "../auth";
import { prisma } from "../db";
import { wrap, HttpError } from "../errors";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

authRouter.post(
  "/login",
  wrap(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const agent = await prisma.agent.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!agent || !(await checkPassword(body.password, agent.passwordHash))) {
      throw new HttpError(401, "invalid_credentials", "Email or password is incorrect");
    }
    res.json({
      token: signToken(agent),
      agent: { id: agent.id, email: agent.email, name: agent.name },
    });
  })
);

authRouter.get(
  "/me",
  requireAgent,
  wrap(async (_req, res) => {
    const agent = res.locals.agent as AuthAgent;
    res.json({ agent });
  })
);
