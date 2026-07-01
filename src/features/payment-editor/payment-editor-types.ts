import type { PaymentFormData } from '@/lib/types/payment';

export interface PaymentFormStudent {
  id: number;
  name: string;
  student_number: string;
  monthly_tuition: number;
  final_monthly_tuition: number | null;
  discount_rate: number;
}

export type PaymentFormMode = 'create' | 'edit';

export interface PaymentEditorStateBase {
  students: PaymentFormStudent[];
  loading: boolean;
  error: string | null;
  saving: boolean;
}

export type PaymentFormSubmit = (data: PaymentFormData) => Promise<void>;
