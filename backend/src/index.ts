import cors from "cors";
import "dotenv/config";
import express from "express";
import { analyzeRouter } from "./routes/analyze.js";
import { devicesRouter } from "./routes/devices.js";
import { gmailRouter } from "./routes/gmail.js";
import { ingestRouter } from "./routes/ingest.js";
import { inboxRouter } from "./routes/inbox.js";
import { reportRouter } from "./routes/report.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "nettoxic-backend" });
});

app.use("/analyze", analyzeRouter);
app.use("/devices", devicesRouter);
app.use("/gmail", gmailRouter);
app.use("/ingest", ingestRouter);
app.use("/inbox", inboxRouter);
app.use("/report", reportRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled route error", error);
  res.status(500).json({
    error: "internal_error",
    message: error instanceof Error ? error.message : "Unexpected backend error"
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Nettoxic backend listening on http://0.0.0.0:${port}`);
});
