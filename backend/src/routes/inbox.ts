import { Router } from "express";
import { analyzeMessage } from "../services/orchestrator.js";
import { listAnalyzedInboxItems } from "../services/ingestStore.js";

export const inboxRouter = Router();

const demoInbox = [
  {
    id: "mail-001",
    source: "email" as const,
    sender: "seguridad@bancoestado-alertas.com",
    subject: "Cuenta bloqueada por seguridad",
    content:
      "BancoEstado informa que su cuenta sera bloqueada hoy. Valide su clave en https://bancoestado-seguro.click/login"
  },
  {
    id: "mail-002",
    source: "email" as const,
    sender: "boletas@sii.cl",
    subject: "Documento tributario recibido",
    content: "Tiene un documento tributario disponible. Ingrese desde sii.cl con sus canales habituales."
  },
  {
    id: "mail-003",
    source: "sms" as const,
    sender: "+56940000000",
    subject: "Paquete retenido",
    content: "Correos de Chile: paquete retenido por pago pendiente. Pague despacho en https://correos-verifica.xyz"
  }
];

inboxRouter.get("/", async (_req, res) => {
  const ingested = await listAnalyzedInboxItems();
  const analyzed = await Promise.all(
    demoInbox.map(async (item) => ({
      id: item.id,
      source: item.source,
      sender: item.sender,
      subject: item.subject,
      preview: item.content.slice(0, 120),
      analysis: await analyzeMessage(item)
    }))
  );

  res.json({ items: [...ingested, ...analyzed] });
});
