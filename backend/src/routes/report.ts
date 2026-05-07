import { Router } from "express";
import { z } from "zod";
import { listRecentReports, saveReport } from "../services/reportStore.js";

export const reportRouter = Router();

const ReportSchema = z.object({
  messageId: z.string().optional(),
  confirmedFraud: z.boolean(),
  notes: z.string().max(500).optional()
});

reportRouter.post("/", async (req, res) => {
  const parsed = ReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const report = await saveReport(parsed.data);
  res.status(202).json({
    ok: true,
    stored: true,
    report
  });
});

reportRouter.get("/", async (_req, res) => {
  res.json({ items: await listRecentReports() });
});
