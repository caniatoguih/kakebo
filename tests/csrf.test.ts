import { describe, expect, it, vi } from 'vitest';
import { requireCsrf } from '../src/middlewares/requireCsrf';
import { parseCookies } from '../src/utils/cookies';

function responseMock() {
  const response: any = {};
  response.status = vi.fn(() => response);
  response.json = vi.fn(() => response);
  return response;
}

describe('cookies e proteção CSRF', () => {
  it('interpreta cookies codificados sem expor o token de sessão à aplicação', () => {
    const request = { headers: { cookie: 'kakebo_session=jwt.value; kakebo_csrf=abc%20123' } } as any;
    expect(parseCookies(request)).toEqual({ kakebo_session: 'jwt.value', kakebo_csrf: 'abc 123' });
  });

  it('permite métodos seguros sem token CSRF', () => {
    const next = vi.fn();
    requireCsrf({ method: 'GET', headers: {} } as any, responseMock(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejeita escrita autenticada quando o header CSRF está ausente', () => {
    const response = responseMock();
    requireCsrf({
      method: 'POST', headers: { cookie: 'kakebo_session=session; kakebo_csrf=token' },
      header: vi.fn(() => undefined),
    } as any, response, vi.fn());
    expect(response.status).toHaveBeenCalledWith(403);
  });

  it('aceita escrita quando cookie e header CSRF coincidem', () => {
    const next = vi.fn();
    requireCsrf({
      method: 'POST', headers: { cookie: 'kakebo_session=session; kakebo_csrf=token' },
      header: vi.fn(() => 'token'),
    } as any, responseMock(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
