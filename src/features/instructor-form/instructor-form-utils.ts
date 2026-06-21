import type { Instructor, InstructorFormData } from '@/lib/types/instructor';

export function parseWorkDays(workDays: number[] | string | null | undefined): number[] {
  if (!workDays) return [];
  if (Array.isArray(workDays)) return workDays;

  try {
    const parsed: unknown = JSON.parse(workDays);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'number') ? parsed : [];
  } catch {
    return [];
  }
}

export function buildInitialInstructorFormData(initialData?: Instructor): InstructorFormData {
  return {
    name: initialData?.name || '',
    phone: initialData?.phone || '',
    gender: initialData?.gender || undefined,
    email: initialData?.email || '',
    resident_number: initialData?.resident_number || '',
    hire_date: initialData?.hire_date || new Date().toISOString().split('T')[0],
    salary_type: initialData?.salary_type || 'hourly',
    instructor_type: initialData?.instructor_type || 'teacher',
    hourly_rate: initialData?.hourly_rate ? parseFloat(initialData.hourly_rate) : 0,
    base_salary: initialData?.base_salary ? parseFloat(initialData.base_salary) : 0,
    tax_type: initialData?.tax_type || '3.3%',
    bank_name: initialData?.bank_name || '',
    account_number: initialData?.account_number || '',
    address: initialData?.address || '',
    notes: initialData?.notes || '',
    status: initialData?.status || 'active',
    work_days: parseWorkDays(initialData?.work_days),
    work_start_time: initialData?.work_start_time || '09:00',
    work_end_time: initialData?.work_end_time || '18:00',
  };
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return fallback;
  }

  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const message = response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function inputClassName(error?: string) {
  return `w-full px-4 py-2 border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
    error ? 'border-red-500' : 'border-border'
  }`;
}
