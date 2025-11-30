/**
 * 엑셀 내보내기 API 클라이언트
 */

import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://supermax.kr/paca';
const BASE_PATH = '/exports';

export interface ExportFilters {
  start_date?: string;
  end_date?: string;
  year?: number;
  month?: number;
  status?: string;
}

/**
 * 토큰 가져오기
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

/**
 * 엑셀 파일 다운로드 공통 함수
 */
async function downloadExcel(endpoint: string, filters?: ExportFilters, defaultFilename?: string) {
  const params = new URLSearchParams();

  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);
  if (filters?.year) params.append('year', filters.year.toString());
  if (filters?.month) params.append('month', filters.month.toString());
  if (filters?.status) params.append('status', filters.status);

  const queryString = params.toString();
  const url = queryString
    ? `${BASE_URL}${BASE_PATH}${endpoint}?${queryString}`
    : `${BASE_URL}${BASE_PATH}${endpoint}`;

  const token = getToken();

  // axios로 blob 다운로드
  const response = await axios.get(url, {
    responseType: 'blob',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  // 파일명 추출 (Content-Disposition 헤더에서)
  const contentDisposition = response.headers?.['content-disposition'];
  let filename = defaultFilename || 'download.xlsx';

  if (contentDisposition) {
    // filename*=UTF-8''인코딩된파일명 형식 처리
    const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1]);
    } else {
      // filename="파일명" 형식 처리
      const basicMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (basicMatch) {
        filename = basicMatch[1];
      }
    }
  }

  // Blob으로 다운로드
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
}

export const exportsApi = {
  /**
   * 수입 내역 엑셀 다운로드
   */
  downloadRevenue: async (filters?: ExportFilters) => {
    await downloadExcel('/revenue', filters, '수입내역.xlsx');
  },

  /**
   * 지출 내역 엑셀 다운로드
   */
  downloadExpenses: async (filters?: ExportFilters) => {
    await downloadExcel('/expenses', filters, '지출내역.xlsx');
  },

  /**
   * 재무 리포트 엑셀 다운로드
   */
  downloadFinancial: async (year?: number) => {
    await downloadExcel('/financial', { year }, `재무리포트_${year || new Date().getFullYear()}년.xlsx`);
  },

  /**
   * 납부 내역 엑셀 다운로드
   */
  downloadPayments: async (filters?: ExportFilters) => {
    await downloadExcel('/payments', filters, '납부내역.xlsx');
  },

  /**
   * 급여 내역 엑셀 다운로드
   */
  downloadSalaries: async (filters?: ExportFilters & { payment_status?: string }) => {
    await downloadExcel('/salaries', filters, '급여명세서.xlsx');
  },
};

export default exportsApi;
