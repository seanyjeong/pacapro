'use client';

// tablet/consultations/[id]/conduct/_hooks/useTabletConduct.ts — 전체 state + handler (ADR-018)

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { convertToTrialStudent, convertToPendingStudent } from '@/lib/api/consultations';
import type { Consultation, ChecklistItem, ChecklistTemplate } from '@/lib/types/consultation';
import type {
  TrialDate,
  StudentEditForm,
  LearningForm,
  LinkedStudent,
  PeakRecord,
} from '../_types';

// 기본 체크리스트 템플릿 (체대입시 특화)
export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplate[] = [
  { id: 1, category: '학생 배경', text: '타학원 경험 확인', input: { type: 'text', label: '학원명' } },
  { id: 2, category: '학생 배경', text: '운동 경력 확인', inputs: [
    { type: 'radio', label: '과거 선수 경험', options: ['있음', '없음'] },
    { type: 'text', label: '종목' },
  ]},
  { id: 3, category: '학생 배경', text: '제멀 기록 확인 (학교 기록)', input: { type: 'text', label: '기록' } },
  { id: 4, category: '체력 및 성향', text: '현재 체력 수준', input: { type: 'radio', label: '체력', options: ['상', '중', '하'] } },
  { id: 5, category: '체력 및 성향', text: '성격/성향 파악', input: { type: 'radio', label: '성향', options: ['외향적', '내향적'] } },
  { id: 6, category: '체력 및 성향', text: '기타 운동 종목', input: { type: 'text', label: '종목' } },
  { id: 7, category: '안내 완료', text: '수시/정시 입시 설명' },
  { id: 8, category: '안내 완료', text: '학원 커리큘럼 안내' },
  { id: 9, category: '안내 완료', text: '수업료 안내' },
  { id: 10, category: '안내 완료', text: '체험 수업 일정 협의' },
  { id: 11, category: '안내 완료', text: '질의응답 완료' },
];

const INITIAL_LEARNING_FORM: LearningForm = {
  admissionType: 'early',
  schoolGradeAvg: '',
  mockTestScores: {
    march: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
    june: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
    september: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
  },
  academicMemo: '',
  physicalRecordType: 'latest',
  physicalMemo: '',
  targetUniversity1: '',
  targetUniversity2: '',
  targetMemo: '',
  generalMemo: '',
};

export function useTabletConduct(consultationId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPage = searchParams.get('from');

  // 돌아갈 페이지 결정 (태블릿 경로)
  const backUrl = fromPage === 'pending' ? '/tablet/students?tab=pending' : '/tablet/consultations';
  const backLabel = fromPage === 'pending' ? '미등록관리로' : '목록으로';

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [consultationMemo, setConsultationMemo] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    '학생 배경': true,
    '체력 및 성향': true,
    '안내 완료': true,
  });

  // 체험 등록 모달
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialDates, setTrialDates] = useState<TrialDate[]>([{ date: '', timeSlot: '' }]);
  const [convertingToTrial, setConvertingToTrial] = useState(false);

  // 미등록관리 모달
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingMemo, setPendingMemo] = useState('');
  const [convertingToPending, setConvertingToPending] = useState(false);

  // 학생 정보 수정 모달
  const [studentEditModalOpen, setStudentEditModalOpen] = useState(false);
  const [studentEditForm, setStudentEditForm] = useState<StudentEditForm>({
    student_name: '',
    student_grade: '',
    gender: '',
    student_school: '',
    parent_phone: '',
    target_school: '',
  });
  const [savingStudent, setSavingStudent] = useState(false);

  // 재원생 상담용 상태
  const [linkedStudent, setLinkedStudent] = useState<LinkedStudent | null>(null);
  const [peakRecords, setPeakRecords] = useState<Record<string, PeakRecord>>({});
  const [peakLoading, setPeakLoading] = useState(false);
  const [existingStudentConsultationId, setExistingStudentConsultationId] = useState<number | null>(null);
  const [learningForm, setLearningForm] = useState<LearningForm>(INITIAL_LEARNING_FORM);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    '학업': true,
    '실기': true,
    '목표': true,
    '기타': true,
  });

  // 상담 정보 로드
  useEffect(() => {
    const loadConsultation = async () => {
      try {
        const data = await apiClient.get<Consultation>(`/consultations/${consultationId}`);
        setConsultation(data);
        setConsultationMemo(data.consultation_memo || '');

        // 재원생 상담인 경우 학생 정보 및 P-EAK 기록 로드
        if (data.consultation_type === 'learning' && data.linked_student_id) {
          try {
            const studentData = await apiClient.get<{ student: LinkedStudent }>(`/students/${data.linked_student_id}`);
            setLinkedStudent(studentData.student);
          } catch (err) {
            console.error('학생 정보 로드 오류:', err);
          }

          // 이 consultation_id로 이미 생성된 student_consultation이 있으면 폼에 로드
          try {
            const prevData = await apiClient.get<{ consultations: any[] }>(`/student-consultations/${data.linked_student_id}`);
            const existing = (prevData.consultations || []).find(
              (c: any) => c.consultation_id === data.id
            );
            if (existing) {
              setExistingStudentConsultationId(existing.id);
              const mockScores = existing.mock_test_scores
                ? (typeof existing.mock_test_scores === 'string' ? JSON.parse(existing.mock_test_scores) : existing.mock_test_scores)
                : null;
              setLearningForm(prev => ({
                ...prev,
                admissionType: existing.admission_type || 'early',
                schoolGradeAvg: existing.school_grade_avg ? String(existing.school_grade_avg) : '',
                mockTestScores: mockScores || prev.mockTestScores,
                academicMemo: existing.academic_memo || '',
                physicalRecordType: existing.physical_record_type || 'latest',
                physicalMemo: existing.physical_memo || '',
                targetUniversity1: existing.target_university_1 || '',
                targetUniversity2: existing.target_university_2 || '',
                targetMemo: existing.target_memo || '',
                generalMemo: existing.general_memo || '',
              }));
            }
          } catch (err) {
            console.error('기존 상담 기록 로드 오류:', err);
          }

          loadPeakRecords(data.linked_student_id);
        }

        // 체크리스트 설정 로드 또는 기본값 사용 (신규 상담인 경우에만)
        if (data.consultation_type !== 'learning') {
          if (data.checklist && data.checklist.length > 0) {
            setChecklist(data.checklist);
          } else {
            try {
              const settingsResponse = await apiClient.get<{ settings: { checklist_template?: ChecklistTemplate[] } }>('/consultations/settings/info');
              const template = settingsResponse.settings?.checklist_template || DEFAULT_CHECKLIST_TEMPLATE;
              setChecklist(template.map(item => ({
                ...item,
                checked: false,
                input: item.input ? { ...item.input, value: item.input.value || '' } : undefined,
                inputs: item.inputs?.map(inp => ({ ...inp, value: inp.value || '' })),
              })));
            } catch {
              setChecklist(DEFAULT_CHECKLIST_TEMPLATE.map(item => ({
                ...item,
                checked: false,
                input: item.input ? { ...item.input, value: '' } : undefined,
                inputs: item.inputs?.map(inp => ({ ...inp, value: '' })),
              })));
            }
          }
        }
      } catch (error) {
        console.error('상담 정보 로드 오류:', error);
        router.push(backUrl);
      } finally {
        setLoading(false);
      }
    };

    loadConsultation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId]);

  // P-EAK 기록 로드
  const loadPeakRecords = async (studentId: number, type: 'latest' | 'average' = 'latest') => {
    setPeakLoading(true);
    try {
      const response = await apiClient.get<{
        found: boolean;
        records: Record<string, PeakRecord>;
      }>(`/student-consultations/${studentId}/peak-records`, {
        params: { type },
      });
      if (response.found) {
        setPeakRecords(response.records);
      }
    } catch (err) {
      console.error('P-EAK 기록 로드 오류:', err);
    } finally {
      setPeakLoading(false);
    }
  };

  // 체크리스트 체크 토글
  const toggleCheck = (itemId: number) => {
    setChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    ));
  };

  // 입력값 변경
  const updateInputValue = (itemId: number, inputIndex: number | null, value: string) => {
    setChecklist(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      if (inputIndex === null && item.input) {
        return { ...item, input: { ...item.input, value } };
      }
      if (inputIndex !== null && item.inputs) {
        const newInputs = [...item.inputs];
        newInputs[inputIndex] = { ...newInputs[inputIndex], value };
        return { ...item, inputs: newInputs };
      }
      return item;
    }));
  };

  // 카테고리 토글
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  // 섹션 토글 (재원생 상담용)
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // 저장
  const handleSave = async () => {
    if (!consultation) return;

    setSaving(true);
    try {
      if (consultation.consultation_type === 'learning' && consultation.linked_student_id) {
        const payload = {
          student_id: consultation.linked_student_id,
          consultation_id: consultation.id,
          consultation_date: consultation.preferred_date,
          consultation_type: consultation.learning_type || 'regular',
          admission_type: learningForm.admissionType,
          school_grade_avg: learningForm.schoolGradeAvg ? parseFloat(learningForm.schoolGradeAvg) : null,
          mock_test_scores: learningForm.mockTestScores,
          academic_memo: learningForm.academicMemo,
          physical_record_type: learningForm.physicalRecordType,
          physical_records: peakRecords,
          physical_memo: learningForm.physicalMemo,
          target_university_1: learningForm.targetUniversity1,
          target_university_2: learningForm.targetUniversity2,
          target_memo: learningForm.targetMemo,
          general_memo: learningForm.generalMemo,
        };

        if (existingStudentConsultationId) {
          await apiClient.put(`/student-consultations/${existingStudentConsultationId}`, payload);
          toast.success('상담 기록이 수정되었습니다.');
        } else {
          const result = await apiClient.post<{ id: number }>('/student-consultations', payload);
          setExistingStudentConsultationId(result.id);
          toast.success('상담 기록이 저장되었습니다.');
        }
        setConsultation({ ...consultation, status: 'completed' });
      } else {
        await apiClient.put(`/consultations/${consultation.id}`, {
          checklist,
          consultationMemo,
          status: 'completed',
        });
        setConsultation({ ...consultation, status: 'completed' });
        toast.success('상담이 완료 처리되었습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
    } finally {
      setSaving(false);
    }
  };

  // 체험 일정 추가
  const addTrialDate = () => {
    setTrialDates(prev => [...prev, { date: '', timeSlot: '' }]);
  };

  // 체험 일정 삭제
  const removeTrialDate = (index: number) => {
    if (trialDates.length <= 1) {
      toast.error('최소 1개의 체험 일정이 필요합니다.');
      return;
    }
    setTrialDates(prev => prev.filter((_, i) => i !== index));
  };

  // 체험 학생 등록
  const handleConvertToTrial = async () => {
    if (!consultation) return;

    const incompleteDate = trialDates.find(d => !d.date || !d.timeSlot);
    if (incompleteDate) {
      toast.error('모든 체험 일정의 날짜와 시간대를 선택해주세요.');
      return;
    }

    const dateSet = new Set<string>();
    for (const d of trialDates) {
      const key = `${d.date}-${d.timeSlot}`;
      if (dateSet.has(key)) {
        toast.error('같은 날짜, 같은 시간대의 체험 일정이 중복됩니다.');
        return;
      }
      dateSet.add(key);
    }

    const dateOnlySet = new Set<string>();
    for (const d of trialDates) {
      if (dateOnlySet.has(d.date)) {
        toast.error('같은 날에 여러 체험 수업을 등록할 수 없습니다.');
        return;
      }
      dateOnlySet.add(d.date);
    }

    setConvertingToTrial(true);
    try {
      await apiClient.put(`/consultations/${consultation.id}`, {
        checklist,
        consultationMemo,
      });
      await convertToTrialStudent(consultation.id, trialDates);
      toast.success('체험 학생으로 등록되었습니다.');
      setTrialModalOpen(false);
      router.push(backUrl);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || '체험 등록에 실패했습니다.');
    } finally {
      setConvertingToTrial(false);
    }
  };

  // 학생 정보 수정 모달 열기
  const openStudentEditModal = () => {
    if (!consultation) return;
    setStudentEditForm({
      student_name: consultation.student_name || '',
      student_grade: consultation.student_grade || '',
      gender: consultation.gender || '',
      student_school: consultation.student_school || '',
      parent_phone: consultation.parent_phone || '',
      target_school: consultation.target_school || '',
    });
    setStudentEditModalOpen(true);
  };

  // 학생 정보 저장
  const handleSaveStudentInfo = async () => {
    if (!consultation) return;

    setSavingStudent(true);
    try {
      await apiClient.put(`/consultations/${consultation.id}`, {
        student_name: studentEditForm.student_name,
        student_grade: studentEditForm.student_grade,
        gender: studentEditForm.gender || undefined,
        student_school: studentEditForm.student_school,
        parent_phone: studentEditForm.parent_phone,
        target_school: studentEditForm.target_school,
      });

      setConsultation({
        ...consultation,
        student_name: studentEditForm.student_name,
        student_grade: studentEditForm.student_grade as typeof consultation.student_grade,
        gender: studentEditForm.gender || undefined,
        student_school: studentEditForm.student_school,
        parent_phone: studentEditForm.parent_phone,
        target_school: studentEditForm.target_school,
      });

      toast.success('학생 정보가 수정되었습니다.');
      setStudentEditModalOpen(false);
    } catch (error) {
      console.error('학생 정보 수정 오류:', error);
    } finally {
      setSavingStudent(false);
    }
  };

  // 미등록관리 학생 등록
  const handleConvertToPending = async () => {
    if (!consultation) return;

    setConvertingToPending(true);
    try {
      await apiClient.put(`/consultations/${consultation.id}`, {
        checklist,
        consultationMemo,
      });
      await convertToPendingStudent(
        consultation.id,
        undefined,
        pendingMemo || consultationMemo || undefined
      );
      toast.success('미등록관리 학생으로 등록되었습니다.');
      setPendingModalOpen(false);
      router.push(backUrl);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || '미등록관리 등록에 실패했습니다.');
    } finally {
      setConvertingToPending(false);
    }
  };

  // 파생값
  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const progressPercent = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0;

  return {
    // navigation
    router,
    backUrl,
    backLabel,
    // core state
    consultation,
    setConsultation,
    loading,
    saving,
    // checklist
    checklist,
    consultationMemo,
    setConsultationMemo,
    expandedCategories,
    groupedChecklist,
    progressPercent,
    // trial modal
    trialModalOpen,
    setTrialModalOpen,
    trialDates,
    setTrialDates,
    convertingToTrial,
    // pending modal
    pendingModalOpen,
    setPendingModalOpen,
    pendingMemo,
    setPendingMemo,
    convertingToPending,
    // student edit modal
    studentEditModalOpen,
    setStudentEditModalOpen,
    studentEditForm,
    setStudentEditForm,
    savingStudent,
    // learning (재원생)
    linkedStudent,
    peakRecords,
    peakLoading,
    learningForm,
    setLearningForm,
    expandedSections,
    loadPeakRecords,
    // handlers
    toggleCheck,
    updateInputValue,
    toggleCategory,
    toggleSection,
    handleSave,
    addTrialDate,
    removeTrialDate,
    handleConvertToTrial,
    openStudentEditModal,
    handleSaveStudentInfo,
    handleConvertToPending,
  };
}
