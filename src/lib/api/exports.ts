/**
 * 엑셀 내보내기 API 클라이언트
 */

import axios from 'axios';
import { PACA_API_BASE_URL } from './base-url';

const BASE_URL = PACA_API_BASE_URL;
const BASE_PATH = '/exports';

export interface ExportFilters {
  start_date?: string;
  end_date?: string;
  year?: number;
  month?: number;
  status?: string;
  payment_status?: string;
}

/**
 * 토큰 가져오기
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function getFilenameFromContentDisposition(contentDisposition: string | undefined, fallback: string) {
  if (!contentDisposition) return fallback;

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch) return decodeURIComponent(encodedMatch[1]);

  const quotedMatch = contentDisposition.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1];

  const basicMatch = contentDisposition.match(/filename=([^;]+)/i);
  return basicMatch ? basicMatch[1].trim() : fallback;
}

function isXlsxArrayBuffer(data: ArrayBuffer) {
  const bytes = new Uint8Array(data);
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4B;
}

async function downloadExcel(endpoint: string, filters?: ExportFilters, defaultFilename?: string) {
  const params = new URLSearchParams();

  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);
  if (filters?.year) params.append('year', filters.year.toString());
  if (filters?.month) params.append('month', filters.month.toString());
  if (filters?.status) params.append('status', filters.status);
  if (filters?.payment_status) params.append('payment_status', filters.payment_status);

  const queryString = params.toString();
  const url = queryString
    ? `${BASE_URL}${BASE_PATH}${endpoint}?${queryString}`
    : `${BASE_URL}${BASE_PATH}${endpoint}`;

  const token = getToken();

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      Authorization: token ? `Bearer ${token}` : '',
    },
  });

  if (!isXlsxArrayBuffer(response.data)) {
    throw new Error('INVALID_EXCEL_RESPONSE');
  }

  const filename = getFilenameFromContentDisposition(
    response.headers?.['content-disposition'],
    defaultFilename || 'download.xlsx',
  );
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
   * 학생 명단 엑셀 다운로드
   */
  downloadStudents: async () => {
    await downloadExcel('/students', undefined, '학생명단.xlsx');
  },

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
