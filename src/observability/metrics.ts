import { NextFunction, Request, Response } from 'express';

const startedAt = Date.now();
let totalRequests = 0;
let activeRequests = 0;
let totalErrors = 0;
let durationMsTotal = 0;

export function metricsMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const start = performance.now();
  totalRequests += 1;
  activeRequests += 1;
  res.once('finish', () => {
    activeRequests -= 1;
    durationMsTotal += performance.now() - start;
    if (res.statusCode >= 500) totalErrors += 1;
  });
  next();
}

export function renderMetrics(): string {
  const lines = [
    '# HELP kakebo_uptime_seconds Process uptime in seconds.',
    '# TYPE kakebo_uptime_seconds gauge',
    `kakebo_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
    '# HELP kakebo_http_requests_total Total HTTP requests.',
    '# TYPE kakebo_http_requests_total counter',
    `kakebo_http_requests_total ${totalRequests}`,
    '# HELP kakebo_http_requests_active Active HTTP requests.',
    '# TYPE kakebo_http_requests_active gauge',
    `kakebo_http_requests_active ${activeRequests}`,
    '# HELP kakebo_http_errors_total HTTP responses with status 5xx.',
    '# TYPE kakebo_http_errors_total counter',
    `kakebo_http_errors_total ${totalErrors}`,
    '# HELP kakebo_http_request_duration_ms_total Sum of request duration in milliseconds.',
    '# TYPE kakebo_http_request_duration_ms_total counter',
    `kakebo_http_request_duration_ms_total ${durationMsTotal.toFixed(3)}`,
  ];
  return `${lines.join('\n')}\n`;
}

export function resetMetricsForTests(): void {
  totalRequests = 0;
  activeRequests = 0;
  totalErrors = 0;
  durationMsTotal = 0;
}
