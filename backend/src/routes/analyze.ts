import { Router } from "express";
import { IncomingMessageSchema } from "../schemas/analysis.js";
import { analyzeMessage } from "../services/orchestrator.js";

export const analyzeRouter = Router();

analyzeRouter.post("/", async (req, res) => {
  const parsed = IncomingMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const result = await analyzeMessage(parsed.data);
  res.json(result);
});

