const TOKEN_PATTERNS = [
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bsk-[A-Za-z0-9]{16,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]{10,}\b/gi,
  /\b(?:token|api[_-]?key|secret|password)\s*[:=]\s*["']?[^"'\s]+["']?/gi,
];

export function redactSensitiveText(value: string) {
  let next = String(value || '');
  for (const pattern of TOKEN_PATTERNS) {
    next = next.replace(pattern, '[redacted]');
  }
  return next;
}

export function truncateText(value: string, max = 8_000) {
  return value.length > max ? `${value.slice(0, max)}\n...[truncado pelo Nexus]` : value;
}

export function nowIso() {
  return new Date().toISOString();
}

export function sanitizeArtifactPreview(value: string, max = 320) {
  return truncateText(redactSensitiveText(value), max);
}
