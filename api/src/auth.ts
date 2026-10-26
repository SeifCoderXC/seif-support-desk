import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./db";
import { env } from "./env";
import { HttpError } from "./errors";

export type AuthAgent = {
  id: string;
  email: string;
  name: string;
};

export function signToken(agent: { id: string; email: string }): string {
  return jwt.sign({ sub: agent.id, email: agent.email }, env.jwtSecret, { expiresIn: "12h" });
}

export async function requireAgent(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "unauthorized", "Sign in required");
    }
    const payload = jwt.verify(header.slice("Bearer ".length), env.jwtSecret);
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new HttpError(401, "unauthorized", "Sign in required");
    }
    const agent = await prisma.agent.findUnique({ where: { id: payload.sub } });
    if (!agent) {
      throw new HttpError(401, "unauthorized", "Sign in required");
    }
    res.locals.agent = { id: agent.id, email: agent.email, name: agent.name } satisfies AuthAgent;
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    next(new HttpError(401, "unauthorized", "Sign in required"));
  }
}

export async function checkPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
