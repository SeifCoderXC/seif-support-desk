import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "./db";
import { env } from "./env";
import { errorHandler, wrap } from "./errors";
import { authRouter } from "./routes/auth";
import { agentRouter, ticketRouter } from "./routes/tickets";

const app = express();
app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "100kb" }));

app.get(
  "/api/health",
  wrap(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  })
);

app.use("/api/auth", authRouter);
app.use("/api/tickets", ticketRouter);
app.use("/api/agents", agentRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({
    error: { code: "not_found", message: "API route not found", details: null },
  });
});

const publicDir = [
  path.join(__dirname, "../public"),
  path.join(__dirname, "../../frontend/dist"),
].find((dir) => fs.existsSync(path.join(dir, "index.html")));

if (publicDir) {
  app.use(express.static(publicDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

app.use(errorHandler);

app.listen(env.port, "0.0.0.0", () => {
  console.log(`support-console listening on ${env.port}`);
});
