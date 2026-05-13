import { parseErrorResponse } from './api';

/** Minimal Response-like mock for Jest (no global Response constructor). */
function makeResponse(init: {
  status?: number;
  contentType?: string;
  body?: string;
}): any {
  const { status = 422, contentType = 'application/json', body = '' } = init;
  let bodyConsumed = false;
  const guard = () => {
    if (bodyConsumed) throw new TypeError('Body already consumed');
    bodyConsumed = true;
  };
  return {
    status,
    headers: { get: (key: string) => (key === 'content-type' ? contentType : null) },
    json: async () => {
      guard();
      return JSON.parse(body);
    },
    text: async () => {
      guard();
      return body;
    },
  };
}

describe('parseErrorResponse', () => {
  it('returns default message for non-JSON non-HTML text response', async () => {
    const res = makeResponse({
      status: 500,
      contentType: 'text/plain',
      body: 'Internal Server Error',
    });
    const result = await parseErrorResponse(res);
    expect(result).toBe('Internal Server Error');
  });

  it('normalises FastAPI 422 array detail', async () => {
    const payload = {
      detail: [
        { msg: 'field required', loc: ['body', 'prompt'] },
        { msg: 'value is not a valid integer', loc: ['body', 'limit'] },
      ],
    };
    const res = makeResponse({ body: JSON.stringify(payload) });
    const result = await parseErrorResponse(res);
    expect(result).toBe('field required; value is not a valid integer');
  });

  it('handles string detail', async () => {
    const payload = { detail: 'Not found' };
    const res = makeResponse({ status: 404, body: JSON.stringify(payload) });
    const result = await parseErrorResponse(res);
    expect(result).toBe('Not found');
  });

  it('handles non-string, non-array detail (object)', async () => {
    const payload = { detail: { code: 'E_AUTH', message: 'expired' } };
    const res = makeResponse({ status: 401, body: JSON.stringify(payload) });
    const result = await parseErrorResponse(res);
    expect(result).toContain('E_AUTH');
  });

  it('uses default message when JSON parse fails', async () => {
    const res = makeResponse({
      status: 500,
      contentType: 'application/json',
      body: '<<<bad json',
    });
    const result = await parseErrorResponse(res);
    expect(result).toContain('500');
  });

  it('skips HTML error pages', async () => {
    const html = '<!DOCTYPE html><html><body>502 Bad Gateway</body></html>';
    const res = makeResponse({
      status: 502,
      contentType: 'text/html',
      body: html,
    });
    const result = await parseErrorResponse(res);
    expect(result).not.toContain('<!DOCTYPE');
    expect(result).toContain('502');
  });

  it('includes status code in default message when body is empty', async () => {
    const res = makeResponse({ status: 503, contentType: 'text/plain', body: '' });
    const result = await parseErrorResponse(res);
    expect(result).toContain('503');
  });
});
