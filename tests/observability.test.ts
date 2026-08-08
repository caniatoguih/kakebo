import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';
import { requestContext } from '../src/middlewares/requestContext';
import { getRequestContext } from '../src/observability/requestContext';
import { metricsMiddleware, renderMetrics, resetMetricsForTests } from '../src/observability/metrics';

describe('observabilidade HTTP', () => {
  it('preserva um ID de correlação válido na resposta e no contexto', () => {
    let contextId: string | undefined;
    const response = { setHeader: vi.fn() } as any;
    requestContext({ header: () => 'request-test-123' } as any, response, () => {
      contextId = getRequestContext()?.requestId;
    });
    expect(contextId).toBe('request-test-123');
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', 'request-test-123');
  });

  it('substitui IDs de correlação potencialmente maliciosos', () => {
    const response = { setHeader: vi.fn() } as any;
    requestContext({ header: () => 'invalid id\nheader' } as any, response, () => undefined);
    expect(response.setHeader.mock.calls[0][1]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('contabiliza requisições e erros em formato Prometheus', () => {
    resetMetricsForTests();
    const response = new EventEmitter() as EventEmitter & { statusCode: number };
    response.statusCode = 500;
    metricsMiddleware({} as any, response as any, () => undefined);
    response.emit('finish');
    const metrics = renderMetrics();
    expect(metrics).toContain('kakebo_http_requests_total 1');
    expect(metrics).toContain('kakebo_http_errors_total 1');
    expect(metrics).toContain('kakebo_http_requests_active 0');
  });
});
