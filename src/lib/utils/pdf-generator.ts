/**
 * PDF Generator Utility
 * Generate salary payslips as PDF and download as ZIP
 * Aligned with backend field names
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Salary } from '@/lib/types/salary';
import { TAX_TYPE_LABELS } from '@/lib/types/salary';
import { SALARY_TYPE_LABELS } from '@/lib/types/instructor';

// Extended salary data (from API response with instructor fields attached)
interface ExtendedSalary extends Salary {
  salary_type?: string;
  hourly_rate?: number;
  morning_class_rate?: number;
  afternoon_class_rate?: number;
  evening_class_rate?: number;
}

interface AttendanceDetail {
  time_slot: string;
  time_slot_label: string;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_status: string;
}

interface DailyBreakdown {
  slots: string[];
  details: AttendanceDetail[];
}

interface AttendanceSummary {
  work_year_month: string;
  attendance_days: number;
  total_classes: number;
  morning_classes: number;
  afternoon_classes: number;
  evening_classes: number;
  total_hours: number;
  daily_breakdown: Record<string, DailyBreakdown>;
}

export interface SalaryWithAttendance {
  salary: ExtendedSalary;
  attendance_summary?: AttendanceSummary | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원';
}

/**
 * Generate salary payslip HTML template
 */
function createSalaryTemplate(data: SalaryWithAttendance, academyName: string = 'P-ACA'): string {
  const { salary, attendance_summary } = data;
  const hourlyRate = parseFloat(String(salary.hourly_rate)) || 0;
  const morningRate = parseFloat(String(salary.morning_class_rate)) || 0;
  const afternoonRate = parseFloat(String(salary.afternoon_class_rate)) || 0;
  const eveningRate = parseFloat(String(salary.evening_class_rate)) || 0;

  // Build attendance table rows
  let attendanceTableRows = '';
  if (attendance_summary && Object.keys(attendance_summary.daily_breakdown).length > 0) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const sortedDates = Object.entries(attendance_summary.daily_breakdown).sort(([a], [b]) => a.localeCompare(b));

    for (const [date, data] of sortedDates) {
      const dateObj = new Date(date);
      const month = dateObj.getMonth() + 1;
      const day = dateObj.getDate();
      const dayOfWeek = dayNames[dateObj.getDay()];
      const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
      const bgColor = isWeekend ? 'background-color: #FEF2F2;' : '';
      const textColor = isWeekend ? 'color: #DC2626;' : '';

      data.details.forEach((detail, idx) => {
        attendanceTableRows += `
          <tr style="${bgColor}">
            ${idx === 0 ? `
              <td rowspan="${data.details.length}" style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; font-weight: 500; vertical-align: middle; text-align: center;">${month}/${day}</td>
              <td rowspan="${data.details.length}" style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; ${textColor} vertical-align: middle; text-align: center;">${dayOfWeek}</td>
            ` : ''}
            <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; vertical-align: middle; text-align: center;">${detail.time_slot_label}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; color: #6B7280; vertical-align: middle; text-align: center;">${detail.check_in_time || '-'}</td>
            <td style="padding: 4px 8px; border-bottom: 1px solid #E5E7EB; color: #6B7280; vertical-align: middle; text-align: center;">${detail.check_out_time || '-'}</td>
          </tr>
        `;
      });
    }
  }

  // Build calculation formula HTML
  let calculationHtml = '';
  if (attendance_summary && salary.salary_type === 'per_class') {
    const calculations: string[] = [];
    if (morningRate > 0 && attendance_summary.morning_classes > 0) {
      calculations.push(`오전: ${formatCurrency(morningRate)} x ${attendance_summary.morning_classes}회 = ${formatCurrency(morningRate * attendance_summary.morning_classes)}`);
    }
    if (afternoonRate > 0 && attendance_summary.afternoon_classes > 0) {
      calculations.push(`오후: ${formatCurrency(afternoonRate)} x ${attendance_summary.afternoon_classes}회 = ${formatCurrency(afternoonRate * attendance_summary.afternoon_classes)}`);
    }
    if (eveningRate > 0 && attendance_summary.evening_classes > 0) {
      calculations.push(`저녁: ${formatCurrency(eveningRate)} x ${attendance_summary.evening_classes}회 = ${formatCurrency(eveningRate * attendance_summary.evening_classes)}`);
    }
    if (calculations.length > 0) {
      calculationHtml = `
        <div style="background-color: #F9FAFB; padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 11px; color: #4B5563;">
          ${calculations.join('<br>')}
        </div>
      `;
    }
  } else if (attendance_summary && salary.salary_type === 'hourly' && hourlyRate > 0) {
    calculationHtml = `
      <div style="background-color: #F9FAFB; padding: 8px; border-radius: 4px; margin-bottom: 8px; font-size: 11px; color: #4B5563;">
        시급 ${formatCurrency(hourlyRate)} x ${attendance_summary.total_hours}시간 = ${formatCurrency(hourlyRate * attendance_summary.total_hours)}
      </div>
    `;
  }

  // Salary type label
  const baseSalaryAmount = salary.base_salary || 0;
  let salaryTypeLabel = '';
  if (salary.salary_type === 'monthly') {
    salaryTypeLabel = baseSalaryAmount > 0 ? `월급 ${formatCurrency(baseSalaryAmount)}` : '월급제';
  } else if (salary.salary_type === 'hourly') {
    salaryTypeLabel = hourlyRate > 0 ? `시급 ${formatCurrency(hourlyRate)}` : '시급제';
  } else if (salary.salary_type === 'per_class') {
    const rates = [morningRate, afternoonRate, eveningRate].filter(r => r > 0);
    if (rates.length > 0) {
      const avgRate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
      salaryTypeLabel = `수업당 ${formatCurrency(avgRate)}`;
    } else {
      salaryTypeLabel = '수업당';
    }
  } else {
    salaryTypeLabel = SALARY_TYPE_LABELS[salary.salary_type as keyof typeof SALARY_TYPE_LABELS] || salary.salary_type || '-';
  }

  return `
    <div style="width: 700px; padding: 24px; font-family: 'Malgun Gothic', sans-serif; background: white;">
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 12px;">
        <h1 style="font-size: 26px; font-weight: bold; color: #1E40AF; margin: 0;">${academyName}</h1>
      </div>

      <div style="text-align: center; border-bottom: 2px solid #1F2937; padding-bottom: 12px; margin-bottom: 16px;">
        <h2 style="font-size: 18px; font-weight: bold; margin: 0 0 4px 0;">급 여 명 세 서</h2>
        <p style="font-size: 12px; color: #4B5563; margin: 0;">${salary.year_month} ${attendance_summary ? `(${attendance_summary.work_year_month} 근무분)` : ''}</p>
      </div>

      <!-- Basic info -->
      <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 13px;">
          <div>
            <span style="color: #6B7280;">강사명:</span>
            <span style="margin-left: 8px; font-weight: 600;">${salary.instructor_name ?? `강사 #${salary.instructor_id}`}</span>
          </div>
          <div>
            <span style="color: #6B7280;">급여유형:</span>
            <span style="margin-left: 8px; font-weight: 600;">${salaryTypeLabel}</span>
          </div>
          <div>
            <span style="color: #6B7280;">급여월:</span>
            <span style="margin-left: 8px; font-weight: 600;">${salary.year_month}</span>
          </div>
        </div>
      </div>

      <!-- Per-class rate info -->
      ${salary.salary_type === 'per_class' && (morningRate !== afternoonRate || afternoonRate !== eveningRate) && (morningRate > 0 || afternoonRate > 0 || eveningRate > 0) ? `
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; margin-bottom: 12px; background-color: #F9FAFB;">
          <h3 style="font-size: 13px; font-weight: 600; color: #374151; margin: 0 0 8px 0;">시간대별 수당</h3>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 12px;">
            ${morningRate > 0 ? `<div><span style="color: #6B7280;">오전:</span><span style="margin-left: 8px; font-weight: 600;">${formatCurrency(morningRate)}/회</span></div>` : ''}
            ${afternoonRate > 0 ? `<div><span style="color: #6B7280;">오후:</span><span style="margin-left: 8px; font-weight: 600;">${formatCurrency(afternoonRate)}/회</span></div>` : ''}
            ${eveningRate > 0 ? `<div><span style="color: #6B7280;">저녁:</span><span style="margin-left: 8px; font-weight: 600;">${formatCurrency(eveningRate)}/회</span></div>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Attendance -->
      ${attendance_summary && Object.keys(attendance_summary.daily_breakdown).length > 0 ? `
        <div style="border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
          <div style="background-color: #EFF6FF; padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="font-size: 13px; font-weight: 600; color: #1E40AF; margin: 0;">
                ${attendance_summary.work_year_month} 출근 내역
              </h3>
              <div style="font-size: 11px; color: #1D4ED8;">
                출근 ${attendance_summary.attendance_days}일 | 총 ${attendance_summary.total_classes}회
                <span style="color: #2563EB;">(오전 ${attendance_summary.morning_classes} / 오후 ${attendance_summary.afternoon_classes} / 저녁 ${attendance_summary.evening_classes})</span>
              </div>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead style="background-color: #F3F4F6;">
              <tr>
                <th style="padding: 6px 8px; text-align: center; font-weight: 500; color: #4B5563; width: 60px;">날짜</th>
                <th style="padding: 6px 8px; text-align: center; font-weight: 500; color: #4B5563; width: 40px;">요일</th>
                <th style="padding: 6px 8px; text-align: center; font-weight: 500; color: #4B5563;">시간대</th>
                <th style="padding: 6px 8px; text-align: center; font-weight: 500; color: #4B5563; width: 60px;">출근</th>
                <th style="padding: 6px 8px; text-align: center; font-weight: 500; color: #4B5563; width: 60px;">퇴근</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceTableRows}
            </tbody>
          </table>
          ${attendance_summary.total_hours > 0 ? `
            <div style="padding: 6px 12px; text-align: right; font-size: 11px; color: #4B5563; background-color: #F9FAFB; border-top: 1px solid #E5E7EB;">
              총 근무시간: <span style="font-weight: 600;">${attendance_summary.total_hours}시간</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Salary calculation -->
      <div style="border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #ECFDF5; padding: 8px 12px; border-bottom: 1px solid #E5E7EB;">
          <h3 style="font-size: 13px; font-weight: 600; color: #065F46; margin: 0;">급여 계산</h3>
        </div>
        <div style="padding: 12px; font-size: 13px;">
          ${calculationHtml}

          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
            <span style="color: #4B5563;">기본급</span>
            <span style="font-weight: 500;">${formatCurrency(salary.base_salary)}</span>
          </div>

          ${salary.overtime_pay > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
              <span style="color: #4B5563;">초과근무수당</span>
              <span style="color: #EA580C; font-weight: 500;">+${formatCurrency(salary.overtime_pay)}</span>
            </div>
          ` : ''}

          ${salary.incentive > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
              <span style="color: #4B5563;">인센티브</span>
              <span style="color: #059669; font-weight: 500;">+${formatCurrency(salary.incentive)}</span>
            </div>
          ` : ''}

          ${salary.tax_type && salary.tax_type !== 'none' && salary.tax_amount > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
              <span style="color: #4B5563;">세금 (${TAX_TYPE_LABELS[salary.tax_type as keyof typeof TAX_TYPE_LABELS] ?? salary.tax_type})</span>
              <span style="color: #DC2626; font-weight: 500;">-${formatCurrency(salary.tax_amount)}</span>
            </div>
          ` : ''}

          ${salary.deductions > 0 ? `
            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
              <span style="color: #4B5563;">공제액</span>
              <span style="color: #DC2626; font-weight: 500;">-${formatCurrency(salary.deductions)}</span>
            </div>
          ` : ''}

          <div style="display: flex; justify-content: space-between; padding: 12px; background-color: #EFF6FF; margin: 8px -12px -12px -12px; border-radius: 0 0 8px 8px;">
            <span style="font-weight: bold; color: #111827;">총 급여</span>
            <span style="font-size: 18px; font-weight: bold; color: #2563EB;">${formatCurrency(salary.total_salary)}</span>
          </div>
        </div>
      </div>

      <!-- Payment info -->
      ${salary.payment_status === 'paid' && salary.paid_date ? `
        <div style="border: 1px solid #D1FAE5; border-radius: 8px; padding: 12px; margin-top: 12px; background-color: #ECFDF5;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px;">
            <span style="color: #047857; font-weight: 500;">지급 완료</span>
            <span style="color: #065F46; font-weight: 600;">${new Date(salary.paid_date).toLocaleDateString('ko-KR')}</span>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Convert HTML to PDF
 */
async function htmlToPdf(html: string): Promise<Blob> {
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Generate single salary payslip PDF
 */
export async function generateSalaryPDF(data: SalaryWithAttendance, academyName?: string): Promise<Blob> {
  const html = createSalaryTemplate(data, academyName);
  return htmlToPdf(html);
}

/**
 * Download multiple salary payslips as ZIP
 */
export async function downloadSalariesAsZip(
  salaries: SalaryWithAttendance[],
  yearMonth: string,
  onProgress?: (current: number, total: number) => void,
  academyName?: string
): Promise<void> {
  const zip = new JSZip();

  for (let i = 0; i < salaries.length; i++) {
    const data = salaries[i];
    onProgress?.(i + 1, salaries.length);

    try {
      const pdfBlob = await generateSalaryPDF(data, academyName);
      const name = data.salary.instructor_name ?? `강사${data.salary.instructor_id}`;
      const filename = `급여명세서_${name}_${yearMonth.replace('-', '')}.pdf`;
      zip.file(filename, pdfBlob);
    } catch (error) {
      console.error(`Failed to generate PDF for salary ${data.salary.id}:`, error);
    }
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  saveAs(zipBlob, `급여명세서_${yearMonth.replace('-', '')}.zip`);
}
