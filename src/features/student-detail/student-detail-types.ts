export type StudentDetailTab = 'performance' | 'attendance' | 'payments' | 'seasons' | 'consultations';

export interface StudentDetailTabItem {
  id: StudentDetailTab;
  label: string;
  count?: number;
}
