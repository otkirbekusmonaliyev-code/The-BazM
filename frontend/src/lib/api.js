// Barcha HTTP so'rovlar shu yerdan o'tadi.
// Dev rejimida Vite proxy /api ni backend'ga uzatadi, shuning uchun
// bu yerda hech qanday to'liq manzil (http://localhost:4000) yozilmagan.

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const NETWORK_MESSAGE = 'Internet aloqasi yo\'q, qayta urinib ko\'ring';

export async function request(path, options = {}) {
  const { method = 'GET', body, token, slug, formData } = options;

  const headers = {};
  if (!formData) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (slug) headers['X-Restaurant-Slug'] = slug;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    throw new ApiError(NETWORK_MESSAGE, 0, null);
  }

  if (res.status === 204) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }

  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Xatolik (${res.status})`;
    throw new ApiError(message, res.status, data);
  }
  return data;
}

// Har bir panel o'ziga bog'langan mijoz yaratadi: slug va token avtomatik qo'shiladi
export function createClient({ getToken, getSlug, onUnauthorized }) {
  const call = async (path, options = {}) => {
    try {
      return await request(path, {
        ...options,
        token: options.token !== undefined ? options.token : getToken && getToken(),
        slug: options.slug !== undefined ? options.slug : getSlug && getSlug(),
      });
    } catch (err) {
      if (err.status === 401 && onUnauthorized) onUnauthorized(err);
      throw err;
    }
  };

  // Rasm/PDF kabi binar javoblar uchun (masalan stolning QR kodi).
  // request() JSON kutgani uchun bu yerda alohida fetch ishlatiladi.
  const blob = async (path) => {
    const headers = {};
    const token = getToken && getToken();
    const slug = getSlug && getSlug();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (slug) headers['X-Restaurant-Slug'] = slug;

    const res = await fetch(`/api${path}`, { headers });
    if (!res.ok) {
      if (res.status === 401 && onUnauthorized) onUnauthorized();
      throw new ApiError('Fayl yuklanmadi', res.status, null);
    }
    return res.blob();
  };

  return {
    blob,
    get: (path, opts) => call(path, { ...opts, method: 'GET' }),
    post: (path, body, opts) => call(path, { ...opts, method: 'POST', body }),
    patch: (path, body, opts) => call(path, { ...opts, method: 'PATCH', body }),
    del: (path, opts) => call(path, { ...opts, method: 'DELETE' }),
    upload: (path, formData, opts) => call(path, { ...opts, method: 'POST', formData }),
    raw: call,
  };
}
