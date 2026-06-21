// Phase 4 #3 (ADR-018) — 신규상담 페이지 타입 정의
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';

export type TagFilter = 'registered' | 'trial_completed' | 'trial_ongoing' | 'unregistered' | 'no_trial';

export interface CreateForm {
  studentName: string;
  phone: string;
  grade: string;
  gender: '' | 'male' | 'female';
  studentSchool: string;
  schoolGradeAvg: number | undefined;
  admissionType: '' | 'early' | 'regular' | 'both';
  mockTestGrades: {
    korean: number | undefined;
    math: number | undefined;
    english: number | undefined;
    exploration: number | undefined;
  };
  targetSchool: string;
  referrerStudent: string;
  preferredDate: string;
  preferredTime: string;
  notes: string;
}

export const INITIAL_CREATE_FORM: CreateForm = {
  studentName: '',
  phone: '',
  grade: '',
  gender: '',
  studentSchool: '',
  schoolGradeAvg: undefined,
  admissionType: '',
  mockTestGrades: {
    korean: undefined,
    math: undefined,
    english: undefined,
    exploration: undefined,
  },
  targetSchool: '',
  referrerStudent: '',
  preferredDate: '',
  preferredTime: '',
  notes: '',
};

export interface EditStudentForm {
  studentGrade: string;
  parentPhone: string;
  studentSchool: string;
}

export interface CompletedStats {
  total: number;
  registered: number;
  trialOngoing: number;
  unregistered: number;
}

export interface GroupedMonth {
  key: string;
  label: string;
  consultations: Consultation[];
}

export interface NewInquiryState {
  consultations: Consultation[];
  loading: boolean;
  stats: Record<string, number>;
  pagination: { total: number; page: number; limit: number; totalPages: number };
  search: string;
  statusFilter: string;
  dateFilter: 'all' | 'today' | 'week';
  completedTab: 'all' | 'registered' | 'trial_ongoing' | 'unregistered';
  selectedTags: TagFilter[];
  expandedMonths: Record<string, boolean>;
  selectedConsultation: Consultation | null;
  detailOpen: boolean;
  statusModalOpen: boolean;
  newStatus: ConsultationStatus;
  adminNotes: string;
  updating: boolean;
  newDate: string;
  newTime: string;
  editBookedTimes: string[];
  loadingEditBookedTimes: boolean;
  deleteModalOpen: boolean;
  deleting: boolean;
  createModalOpen: boolean;
  createForm: CreateForm;
  creating: boolean;
  bookedTimes: string[];
  loadingBookedTimes: boolean;
  trialModalOpen: boolean;
  trialConsultation: Consultation | null;
  trialDates: { date: string; timeSlot: string }[];
  convertingToTrial: boolean;
  editStudentModalOpen: boolean;
  editStudentForm: EditStudentForm;
  updatingStudent: boolean;
}
