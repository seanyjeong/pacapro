import { toast } from 'sonner';
import { PACA_API_BASE_URL } from './api/base-url';

const PACA_API_URL = PACA_API_BASE_URL;
const PEAK_FRONTEND_URL = process.env.NEXT_PUBLIC_PEAK_URL || 'https://peak-rose.vercel.app';

interface PeakSsoResponse {
  success: boolean;
  peakUrl?: string;
  code?: string;
}

export async function openPeakSso(): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) {
    window.open(PEAK_FRONTEND_URL, '_blank');
    return;
  }

  try {
    const response = await fetch(`${PACA_API_URL}/peak-sso/code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('PEAK_SSO_FAILED');
    }

    const data = await response.json() as PeakSsoResponse;
    const peakUrl = data.peakUrl || (data.code ? `${PEAK_FRONTEND_URL}/login?code=${encodeURIComponent(data.code)}` : PEAK_FRONTEND_URL);
    window.open(peakUrl, '_blank');
  } catch {
    toast.warning('피크 자동 로그인을 준비하지 못했습니다. 피크 로그인 화면으로 이동합니다.');
    window.open(PEAK_FRONTEND_URL, '_blank');
  }
}
