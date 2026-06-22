export type StudentDetailTab = 'performance' | 'attendance' | 'payments' | 'seasons' | 'consultations';

export type StudentDetailAction = 'delete' | 'graduate' | 'withdraw';

export interface StudentDetailTabItem {
  id: StudentDetailTab;
  label: string;
  count?: number;
}
