const SUPERMAX_PACA_API_URL = 'https://supermax.kr/paca';
const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function trimSlash(value?: string) {
  return String(value || '').replace(/\/+$/, '');
}

function isLocalApiUrl(value: string) {
  try {
    return LOCAL_API_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function getPacaApiBase(value?: string) {
  const baseUrl = trimSlash(value);
  return baseUrl && isLocalApiUrl(baseUrl) ? baseUrl : SUPERMAX_PACA_API_URL;
}

export const PACA_API_BASE_URL = getPacaApiBase(process.env.NEXT_PUBLIC_API_URL);
export const PACA_API_FALLBACK_URL = getPacaApiBase(process.env.NEXT_PUBLIC_FALLBACK_API_URL);
