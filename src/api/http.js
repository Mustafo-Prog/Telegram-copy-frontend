export const TOKEN_KEY = 'tg_token';

function createError(message, { code, params, status } = {}) {
  const err = new Error(message);
  err.code = code;
  err.params = params;
  err.status = status;
  return err;
}

export async function request(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw createError('Server unavailable', { code: 'network' });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw createError(data.message || 'Server error', {
      code: data.code ?? (data.message ? undefined : 'server'),
      params: data.params,
      status: res.status,
    });
  }
  return data;
}
