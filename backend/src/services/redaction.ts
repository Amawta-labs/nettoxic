const RUT_PATTERN = /\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/g;
const CARD_PATTERN = /\b(?:\d[ -]*?){13,19}\b/g;
const TOKEN_PATTERN = /\b(?:token|codigo|código|clave|password|contraseña|contrasena)\s*[:=]?\s*\S+/gi;

export function normalizeSpanish(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function redactSensitiveText(text: string) {
  return text
    .replace(RUT_PATTERN, "[RUT_REDACTADO]")
    .replace(CARD_PATTERN, "[NUMERO_REDACTADO]")
    .replace(TOKEN_PATTERN, (match) => {
      const [label] = match.split(/\s+/);
      return `${label} [VALOR_REDACTADO]`;
    });
}
