import rateLimit from 'express-rate-limit';

const rateLimitMessage = {
  ok: false,
  error: 'Muitas requisições. Aguarde alguns segundos antes de tentar novamente.',
};

function createLimiter(max: number) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitMessage,
  });
}

export const aiRateLimiter = createLimiter(10);
export const commandRateLimiter = createLimiter(20);
export const generalWriteRateLimiter = createLimiter(60);
