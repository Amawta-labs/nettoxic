type FraudPattern = {
  id: string;
  category: string;
  label: string;
  evidence: string;
  examples: string[];
};

export type FraudPatternEmbeddingMatch = {
  provider: "local-pattern-embedding-v1";
  score: number;
  category: string | null;
  label: string | null;
  evidence: string | null;
  matches: Array<{
    id: string;
    category: string;
    label: string;
    score: number;
    evidence: string;
    matchedTerms: string[];
  }>;
};

const DIMENSIONS = 384;
const LABEL_THRESHOLD = 0.34;
const MATCH_THRESHOLD = 0.22;

const STOPWORDS = new Set([
  "ante",
  "aqui",
  "cada",
  "como",
  "con",
  "del",
  "desde",
  "este",
  "esta",
  "estos",
  "hay",
  "ingrese",
  "para",
  "por",
  "que",
  "sin",
  "sus",
  "tiene",
  "una",
  "usted"
]);

const CONCEPT_LEXICON: Record<string, string[]> = {
  urgency: ["ahora", "hoy", "urgente", "24 horas", "ultimo aviso", "inmediato", "vence"],
  credentials: ["clave", "contrasena", "password", "pin", "token", "codigo", "validar", "verificar", "datos"],
  consequence: ["bloqueada", "bloqueado", "suspendida", "suspendido", "multa", "retencion", "inhabilitada"],
  bank: ["bancoestado", "banco", "cuenta", "tarjeta", "transferencia", "saldo"],
  government: ["sii", "clave unica", "impuestos internos", "tesoreria", "multa", "tributaria"],
  shipping: ["correos", "paquete", "envio", "despacho", "aduana", "reparto", "retenido"],
  prize: ["premio", "bono", "ganaste", "sorteo", "beneficio", "subsidio"],
  support: ["soporte", "tecnico", "mesa de ayuda", "anydesk", "teamviewer", "instala"],
  money: ["transferencia", "deposito", "pago", "abono", "retirado", "retenida"],
  link: ["link", "enlace", "url", "http", "https", "click"]
};

const FRAUD_PATTERNS: FraudPattern[] = [
  {
    id: "cl-bank-blocked-account",
    category: "suplantacion_bancaria",
    label: "Cuenta bancaria bloqueada o suspendida",
    evidence: "Bloqueo de cuenta y validacion de clave.",
    examples: [
      "BancoEstado informa que su cuenta sera bloqueada hoy. Valide su clave en este enlace.",
      "Su tarjeta fue suspendida por seguridad. Confirme sus datos y token antes de 24 horas.",
      "Ultimo aviso: cuenta bancaria inhabilitada. Ingrese al portal seguro para evitar bloqueo.",
      "Banco seguro: actualice sus datos personales o su cuenta quedara suspendida."
    ]
  },
  {
    id: "cl-tax-fine-sii",
    category: "suplantacion_gubernamental",
    label: "Multa o tramite SII con clave tributaria",
    evidence: "Amenaza con multa y pide clave tributaria.",
    examples: [
      "SII informa multa pendiente. Regularice hoy ingresando con su clave tributaria.",
      "Servicio de Impuestos Internos: retencion activa. Valide su identidad para liberar documento.",
      "Clave tributaria vencida. Actualice sus datos para evitar sancion y bloqueo.",
      "Tesoreria: pago obligatorio pendiente. Ingrese ahora para detener multa."
    ]
  },
  {
    id: "cl-shipping-payment",
    category: "paquete_retenido",
    label: "Paquete retenido con pago pendiente",
    evidence: "Courier falso con pago para liberar envio.",
    examples: [
      "Correos de Chile: paquete retenido por pago pendiente. Pague despacho en este link.",
      "Envio en aduana necesita validacion de identidad y abono para ser liberado.",
      "Reparto fallido. Complete direccion y tarjeta para reprogramar entrega.",
      "Paquete retenido hoy. Evite devolucion pagando el despacho urgente."
    ]
  },
  {
    id: "cl-fake-prize-bonus",
    category: "premio_falso",
    label: "Premio, bono o beneficio falso",
    evidence: "Promete premio y pide datos o identidad.",
    examples: [
      "Ganaste un premio. Valida tu identidad y datos bancarios para recibir el deposito.",
      "Bono pendiente para clientes seleccionados. Ingresa tus datos antes de que venza.",
      "Subsidio aprobado. Confirma RUT, cuenta y codigo para liberar el pago.",
      "Sorteo finalizado: reclama beneficio hoy completando el formulario."
    ]
  },
  {
    id: "cl-fake-support-remote-access",
    category: "soporte_falso",
    label: "Soporte falso o acceso remoto",
    evidence: "Pide instalar acceso remoto o compartir codigo.",
    examples: [
      "Soporte tecnico del banco detecto un problema. Instala AnyDesk y comparte el codigo.",
      "Mesa de ayuda requiere acceso remoto para desbloquear tu cuenta.",
      "Ejecutivo de seguridad necesita verificar tu equipo. Entrega el codigo de TeamViewer.",
      "Atencion urgente: descarga aplicacion de soporte para proteger tu dinero."
    ]
  },
  {
    id: "cl-urgent-money-transfer",
    category: "transferencia_urgente",
    label: "Transferencia o deposito urgente",
    evidence: "Presiona para mover dinero rapido.",
    examples: [
      "Necesito transferencia urgente ahora. Despues te explico, deposita a esta cuenta.",
      "Pago retenido por seguridad. Transfiere un monto de verificacion para liberar el saldo.",
      "Abono pendiente requiere deposito minimo hoy para no perder la operacion.",
      "Tu transferencia fue retenida. Ingresa al enlace y valida el pago."
    ]
  },
  {
    id: "cl-marketplace-account",
    category: "suplantacion_comercio",
    label: "Cuenta de comercio o marketplace comprometida",
    evidence: "Fuerza validacion fuera del canal oficial.",
    examples: [
      "Mercado Libre detecto ingreso sospechoso. Verifica tu cuenta en el enlace.",
      "Falabella: compra retenida. Confirma datos de tarjeta para evitar anulacion.",
      "Cuenta de ecommerce bloqueada por seguridad. Actualiza clave y datos personales.",
      "Pago de compra observado. Ingresa al sitio seguro para validar identidad."
    ]
  },
  {
    id: "cl-unlicensed-loan-investment",
    category: "prestamo_inversion_no_autorizada",
    label: "Prestamo o inversion no autorizada",
    evidence: "Credito o inversion por canal informal.",
    examples: [
      "Credito aprobado sin requisitos. Paga la comision inicial para liberar el prestamo.",
      "Inversion garantizada con alta rentabilidad. Transfiere hoy para asegurar cupo.",
      "Entidad financiera ofrece prestamo express por WhatsApp y pide datos personales.",
      "Aprobamos tu credito. Envia documentos y abono de activacion antes de las 18 horas."
    ]
  }
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/https?:\/\/\S+/g, " url ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function meaningTokens(value: string) {
  return tokenize(value).filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function addFeature(features: Map<string, number>, key: string, weight: number) {
  features.set(key, (features.get(key) ?? 0) + weight);
}

function featureMap(value: string) {
  const features = new Map<string, number>();
  const normalized = normalizeText(value);
  const padded = ` ${normalized} `;
  const tokens = normalized ? normalized.split(" ") : [];

  for (const token of tokens) {
    if (token.length <= 1 || STOPWORDS.has(token)) continue;
    addFeature(features, `tok:${token}`, 1.1);
    if (token.length >= 5) {
      for (let index = 0; index <= token.length - 3; index += 1) {
        addFeature(features, `tri:${token.slice(index, index + 3)}`, 0.18);
      }
    }
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];
    if (STOPWORDS.has(first) || STOPWORDS.has(second)) continue;
    addFeature(features, `bi:${first}_${second}`, 1.35);
  }

  for (const [concept, terms] of Object.entries(CONCEPT_LEXICON)) {
    for (const term of terms) {
      const normalizedTerm = normalizeText(term);
      if (normalizedTerm && padded.includes(` ${normalizedTerm} `)) {
        addFeature(features, `concept:${concept}`, 2.4);
      }
    }
  }

  return features;
}

function hashFeature(feature: string) {
  let hash = 2166136261;
  for (let index = 0; index < feature.length; index += 1) {
    hash ^= feature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function vectorize(value: string) {
  const vector = new Float32Array(DIMENSIONS);
  const features = featureMap(value);

  for (const [feature, weight] of features.entries()) {
    const hash = hashFeature(feature);
    const slot = hash % DIMENSIONS;
    const sign = hash & 1 ? -1 : 1;
    vector[slot] += sign * weight;
  }

  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm);
  if (norm === 0) return vector;

  for (let index = 0; index < vector.length; index += 1) {
    vector[index] = vector[index] / norm;
  }
  return vector;
}

function cosine(a: Float32Array, b: Float32Array) {
  let dot = 0;
  for (let index = 0; index < DIMENSIONS; index += 1) dot += a[index] * b[index];
  return Math.max(0, dot);
}

function roundScore(value: number) {
  return Number(Math.max(0, Math.min(1, value)).toFixed(2));
}

const PATTERN_INDEX = FRAUD_PATTERNS.map((pattern) => {
  const patternText = `${pattern.label} ${pattern.evidence} ${pattern.examples.join(" ")}`;
  return {
    pattern,
    tokens: new Set(meaningTokens(patternText)),
    vectors: [vectorize(patternText), ...pattern.examples.map((example) => vectorize(example))]
  };
});

function matchedTerms(input: Set<string>, patternTokens: Set<string>) {
  return Array.from(input)
    .filter((token) => patternTokens.has(token))
    .slice(0, 8);
}

export function fraudPatternEmbeddingMatch(text: string): FraudPatternEmbeddingMatch {
  const inputVector = vectorize(text);
  const inputTokens = new Set(meaningTokens(text));
  const matches = PATTERN_INDEX.map(({ pattern, tokens, vectors }) => {
    const bestRawScore = Math.max(...vectors.map((vector) => cosine(inputVector, vector)));
    return {
      id: pattern.id,
      category: pattern.category,
      label: pattern.label,
      score: roundScore(bestRawScore),
      evidence: pattern.evidence,
      matchedTerms: matchedTerms(inputTokens, tokens)
    };
  })
    .filter((match) => match.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const best = matches[0] ?? null;
  const hasLabel = Boolean(best && best.score >= LABEL_THRESHOLD);

  return {
    provider: "local-pattern-embedding-v1",
    score: best?.score ?? 0,
    category: hasLabel ? best?.category ?? null : null,
    label: hasLabel ? best?.label ?? null : null,
    evidence: hasLabel ? best?.evidence ?? null : null,
    matches
  };
}

export function semanticFraudSimilarity(text: string): number {
  return fraudPatternEmbeddingMatch(text).score;
}
