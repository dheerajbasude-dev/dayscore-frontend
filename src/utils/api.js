/**
 * Utility functions for API base URL resolution and safe JSON parsing.
 */

export const getApiBaseUrl = () => {
  let url = (import.meta.env.VITE_API_URL || '').trim();

  if (!url) {
    // Return empty string so Vite proxy (dev) and Vercel rewrites proxy (prod) handle /api seamlessly
    return '';
  }

  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api$/, '');

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
