const SUPERMAX_PACA_API_URL = 'https://supermax.kr/paca';
const LEGACY_PACA_API_URLS = new Set([
  'https://chejump.com/paca',
  'https://chejump.com:8320/paca',
]);

function trimSlash(value?: string) {
  return String(value || '').replace(/\/+$/, '');
}

export function getPacaApiBase(value?: string) {
  const baseUrl = trimSlash(value);
  if (!baseUrl || LEGACY_PACA_API_URLS.has(baseUrl)) {
    return SUPERMAX_PACA_API_URL;
  }
  return baseUrl;
}

export const PACA_API_BASE_URL = getPacaApiBase(process.env.NEXT_PUBLIC_API_URL);
export const PACA_API_FALLBACK_URL = getPacaApiBase(process.env.NEXT_PUBLIC_FALLBACK_API_URL);
