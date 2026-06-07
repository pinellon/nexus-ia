import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const DEFAULT_ALLOWED_ORIGINS = new Set([
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const SENSITIVE_GETS = [
  /^\/api\/ai\/settings$/,
  /^\/api\/ai\/status$/,
  /^\/api\/ai-edits(?:\/.*)?$/,
  /^\/api\/agents(?:\/.*)?$/,
  /^\/api\/actions(?:\/.*)?$/,
  /^\/api\/patches(?:\/.*)?$/,
  /^\/api\/project(?:\/.*)?$/,
  /^\/api\/workspace(?:\/.*)?$/,
  /^\/api\/git(?:\/.*)?$/,
  /^\/api\/runs(?:\/.*)?$/,
  /^\/api\/backups(?:\/.*)?$/,
  /^\/api\/staged-files(?:\/.*)?$/,
  /^\/api\/sessions(?:\/.*)?$/,
];

let bootToken: string | null = null;

function parseOrigins(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAllowedOrigins() {
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...parseOrigins(process.env.NEXUS_ALLOWED_ORIGINS)]);
}

export function getLocalAuthToken() {
  if (process.env.NEXUS_LOCAL_TOKEN?.trim()) {
    return process.env.NEXUS_LOCAL_TOKEN.trim();
  }
  if (!bootToken) {
    bootToken = randomBytes(32).toString('hex');
  }
  return bootToken;
}

function sameValue(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeOrigin(value: string | undefined) {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

export function isAllowedOrigin(value: string | undefined) {
  if (!value) return true;
  return getAllowedOrigins().has(normalizeOrigin(value));
}

export function configureLocalCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', normalizeOrigin(origin));
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Nexus-Request, X-Nexus-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS');
  }

  if (req.method === 'OPTIONS') {
    if (!origin || !isAllowedOrigin(origin)) {
      return res.status(403).json({ ok: false, error: 'Origin nao permitido pelo Nexus IA' });
    }
    return res.sendStatus(204);
  }

  if (origin && !isAllowedOrigin(origin)) {
    return res.status(403).json({ ok: false, error: 'Origin nao permitido pelo Nexus IA' });
  }

  return next();
}

function hasAllowedReferer(req: Request) {
  const referer = req.headers.referer;
  if (!referer) return true;
  if (referer.includes('/preview/project/') || referer.includes('/preview/staged/')) {
    return false;
  }
  return isAllowedOrigin(referer);
}

function isSensitiveRequest(req: Request) {
  if (!req.path.startsWith('/api/')) {
    return false;
  }
  if (!SAFE_METHODS.has(req.method)) {
    return true;
  }
  return SENSITIVE_GETS.some((pattern) => pattern.test(req.path));
}

function readToken(req: Request) {
  const headerToken = req.header('X-Nexus-Token');
  if (headerToken) return headerToken;
  if (req.path.endsWith('/events/stream') && typeof req.query.nexusToken === 'string') {
    return req.query.nexusToken;
  }
  return '';
}

export function requireLocalTrust(req: Request, res: Response, next: NextFunction) {
  if (!isSensitiveRequest(req)) {
    return next();
  }

  if (!isAllowedOrigin(req.headers.origin) || !hasAllowedReferer(req)) {
    return res.status(403).json({ ok: false, error: 'Requisicao local nao confiavel' });
  }

  const csrfHeader = req.header('X-Nexus-Request');
  const token = readToken(req);
  if (csrfHeader !== 'true' && !req.path.endsWith('/events/stream')) {
    return res.status(403).json({ ok: false, error: 'Header X-Nexus-Request ausente' });
  }
  if (!token || !sameValue(token, getLocalAuthToken())) {
    return res.status(401).json({ ok: false, error: 'Token local do Nexus invalido ou ausente' });
  }

  return next();
}

export function buildLocalSecurityPayload() {
  return {
    token: getLocalAuthToken(),
    csrfHeader: 'X-Nexus-Request',
    tokenHeader: 'X-Nexus-Token',
    allowedOrigins: Array.from(getAllowedOrigins()),
  };
}

export function requireConfirmation(req: Request, res: Response, next: NextFunction) {
  if (
    req.body?.confirmed === true ||
    req.body?.confirmation === 'confirmed' ||
    req.query.confirm === 'true'
  ) {
    return next();
  }

  return res.status(409).json({
    ok: false,
    destructive: true,
    requiresConfirmation: true,
    confirmationId: 'confirmed',
    message: 'Confirme explicitamente esta operacao destrutiva enviando confirmed=true.',
  });
}
