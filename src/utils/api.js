/**
 * Utility functions for API base URL resolution and safe JSON parsing.
 */

export const getApiBaseUrl = () => {
  let url = (import.meta.env.VITE_API_URL || '').trim();

  if (!url) {
    // In production environment (Vercel deployment), default to backend host if VITE_API_URL is omitted
    if (import.meta.env.PROD) {
      return 'https://dayscore-backend.vercel.app';
    }
    // In local development, return empty string so Vite server proxy handles /api
    return '';
  }

  url = url.replace(/\/+$/, '');

  // If URL is missing protocol prefix and is not a relative path starting with '/'
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
    if (url.startsWith('localhost') || url.startsWith('127.0.0.1')) {
      return `http://${url}`;
    }
    return `https://${url}`;
  }

  return url;
};

export const safeJsonParse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Expected JSON response but received ${contentType || 'non-JSON'} (status ${response.status}): ${text.substring(0, 120)}`);
  }
  return response.json();
};
