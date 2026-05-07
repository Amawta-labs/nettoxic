import type { InboxItem } from "../types";

export const mockInbox: InboxItem[] = [
  {
    id: "mail-001",
    source: "email",
    sender: "bancoestado-alertas.net",
    subject: "Urgente: Tu cuenta será bloqueada en 24 horas",
    preview:
      "BancoEstado informa que su cuenta sera bloqueada hoy. Valide su clave en https://bancoestado-seguro.click/login",
    analysis: {
      score: 94,
      nivel: "critico",
      entidad_suplantada: "BancoEstado",
      explicacion:
        "El mensaje combina urgencia, solicitud de clave y un dominio no oficial. No abras el enlace ni entregues datos.",
      pasos: ["No abras el enlace.", "No entregues claves ni codigos.", "Entra manualmente a bancoestado.cl.", "Reporta el caso."],
      fuentes_externas: { phishtank: false, cmf: false, urlhaus: false },
      debug: {
        model: "offline-mock",
        usedClaude: false,
        urls: ["https://bancoestado-seguro.click/login"],
        embedding: {
          provider: "local-pattern-embedding-v1",
          score: 0.74,
          category: "suplantacion_bancaria",
          label: "Cuenta bancaria bloqueada o suspendida",
          evidence: "Bloqueo de cuenta y validacion de clave.",
          matches: ["Cuenta bancaria bloqueada o suspendida (0.74)"]
        }
      },
      senales_detectadas: [
        { key: "urgencia_artificial", label: "Urgencia artificial", present: true },
        { key: "solicitud_credenciales", label: "Solicitud de credenciales", present: true },
        { key: "dominio_no_oficial", label: "Dominio no oficial", present: true },
        { key: "suplantacion_entidad", label: "Suplantacion de entidad chilena", present: true },
        { key: "amenaza_consecuencia", label: "Amenaza de consecuencia", present: true },
        { key: "redireccion_sospechosa", label: "Redireccion sospechosa", present: true }
      ]
    }
  },
  {
    id: "mail-002",
    source: "email",
    sender: "correos-chile.info",
    subject: "Tu paquete está retenido. Paga $990",
    preview: "Correos Chile: tu paquete está retenido. Paga $990 para liberar el despacho.",
    analysis: {
      score: 58,
      nivel: "medio",
      entidad_suplantada: "Correos Chile",
      explicacion: "El mensaje pide un pago rápido para liberar un paquete y usa un remitente no oficial.",
      pasos: ["No pagues desde el enlace.", "Revisa el envío en el sitio oficial.", "Reporta el mensaje si no esperabas un paquete."],
      fuentes_externas: { phishtank: false, cmf: false, urlhaus: false },
      debug: {
        model: "offline-mock",
        usedClaude: false,
        urls: [],
        embedding: {
          provider: "local-pattern-embedding-v1",
          score: 0.68,
          category: "paquete_retenido",
          label: "Paquete retenido con pago pendiente",
          evidence: "Courier falso con pago para liberar envio.",
          matches: ["Paquete retenido con pago pendiente (0.68)"]
        }
      },
      senales_detectadas: [
        { key: "urgencia_artificial", label: "Urgencia artificial", present: true },
        { key: "dominio_no_oficial", label: "Dominio no oficial", present: true },
        { key: "suplantacion_entidad", label: "Suplantacion de entidad chilena", present: true },
        { key: "redireccion_sospechosa", label: "Redireccion sospechosa", present: true }
      ]
    }
  },
  {
    id: "mail-003",
    source: "sms",
    sender: "soporte@mercadolibre-cl.net",
    subject: "Ganaste un premio exclusivo. Reclámalo ahora",
    preview: "MercadoLibre: ganaste un premio exclusivo. Reclámalo ahora ingresando tus datos.",
    analysis: {
      score: 54,
      nivel: "medio",
      entidad_suplantada: "Mercado Libre",
      explicacion:
        "El mensaje promete un premio y empuja a reclamarlo rápido desde un dominio no oficial.",
      pasos: ["No abras el enlace.", "No entregues datos personales.", "Revisa premios solo desde la app oficial.", "Reporta el caso."],
      fuentes_externas: { phishtank: false, cmf: false, urlhaus: false },
      debug: {
        model: "offline-mock",
        usedClaude: false,
        urls: ["https://correos-verifica.xyz"],
        embedding: {
          provider: "local-pattern-embedding-v1",
          score: 0.72,
          category: "premio_falso",
          label: "Premio, bono o beneficio falso",
          evidence: "Promete premio y pide datos o identidad.",
          matches: ["Premio, bono o beneficio falso (0.72)"]
        }
      },
      senales_detectadas: [
        { key: "solicitud_credenciales", label: "Solicitud de credenciales", present: true },
        { key: "dominio_no_oficial", label: "Dominio no oficial", present: true },
        { key: "suplantacion_entidad", label: "Suplantacion de entidad chilena", present: true },
        { key: "redireccion_sospechosa", label: "Redireccion sospechosa", present: true }
      ]
    }
  }
];
