export interface StudentConsultation {
    id: number;
    student_id: number;
    consultation_date: string;
    consultation_type: string;
    admission_type: string;
    school_grade_avg: number | null;
    mock_test_scores: string | null;
    academic_memo: string | null;
    physical_record_type: string;
    physical_records: string | null;
    physical_memo: string | null;
    target_university_1: string | null;
    target_university_2: string | null;
    target_memo: string | null;
    general_memo: string | null;
    created_at: string;
}

export interface InitialConsultation {
    id: number;
    consultation_type: string;
    learning_type: string | null;
    preferred_date: string;
    preferred_time: string;
    status: string;
    student_name: string | null;
    student_grade: string | null;
    inquiry_content: string | null;
    consultation_memo: string | null;
    admin_notes: string | null;
    academic_scores: unknown;
    target_school: string | null;
    checklist: unknown;
    referral_sources: unknown;
    created_at: string;
}

export type ConsultationTimelineItem =
    | { type: 'student'; data: StudentConsultation; date: string }
    | { type: 'initial'; data: InitialConsultation; date: string };
