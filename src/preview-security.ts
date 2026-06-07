import type { Response } from 'express';

export function setPreviewSecurityHeaders(res: Response) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    [
      'sandbox allow-scripts allow-forms allow-modals',
      "default-src 'none'",
      "script-src 'unsafe-inline'",
      "style-src 'unsafe-inline'",
      'img-src data: blob:',
      'font-src data:',
      'media-src data: blob:',
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
    ].join('; '),
  );
}
