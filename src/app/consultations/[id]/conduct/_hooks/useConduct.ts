'use client';

// conduct/_hooks/useConduct.ts — 상담 진행 전체 state + handler (ADR-018)

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { convertToTrialStudent, convertToPendingStudent } from '@/lib/api/consultations';
import {
  fetchJungsiLearningMockScores,
  hasAnyLearningMockScore,
  mergeMissingLearningMockScores,
  parseLearningMockScores,
  type LearningMockScores,
} from '@/lib/api/jungsi-learning-scores';
import { DEFAULT_CONSULTATION_CHECKLIST } from '@/lib/consultations/default-checklist';
import type { Consultation, ChecklistItem, ChecklistTemplate } from '@/lib/types/consultation';
import type {
  LearningForm,
  StudentEditForm,
  TrialDate,
  PreviousConsultation,
  PeakRecord,
  MemoModalState,
  LinkedStudent,
} from '../_types';

const SILENT_CONFIG = { suppressErrorToast: true };

export function useConduct(consultationId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPage = searchParams.get('from');

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
  const [previousConsultations, setPreviousConsultations] = useState<PreviousConsultation[]>([]);
  const [memoModal, setMemoModal] = useState<MemoModalState>({
    open: false,
    date: '',
    type: 'general',
    content: '',
  });
  const [peakRecords, setPeakRecords] = useState<Record<string, PeakRecord>>({});
  const [peakLoading, setPeakLoading] = useState(false);
  const [existingStudentConsultationId, setExistingStudentConsultationId] = useState<number | null>(null);
  const [learningForm, setLearningForm] = useState<LearningForm>({
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
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    '학업': true,
    '실기': true,
    '목표': true,
    '기타': true,
  });

  // 돌아갈 페이지 결정
  const getBackNavigation = (c: Consultation | null) => {
    if (fromPage === 'pending') return { url: '/students?tab=pending', label: '미등록관리로' };
    if (fromPage === 'trial') return { url: '/students?tab=trial', label: '체험생관리로' };
    if (c?.consultation_type === 'learning') return { url: '/consultations/enrolled', label: '재원생상담으로' };
    return { url: '/consultations/new-inquiry', label: '신규상담으로' };
  };

  // 현재 backUrl (consultation 로드 전 기본값)
  const backNav = getBackNavigation(consultation);
  const backUrl = backNav.url;
  const backLabel = backNav.label;

  // P-EAK 기록 로드
  const loadPeakRecords = async (studentId: number, type: 'latest' | 'average' = 'latest') => {
    setPeakLoading(true);
    try {
      const response = await apiClient.get<{
        found: boolean;
        records: Record<string, PeakRecord>;
      }>(`/student-consultations/${studentId}/peak-records`, { params: { type }, suppressErrorToast: true });
      if (response.found) {
        setPeakRecords(response.records);
      }
    } catch {
      setPeakRecords({});
    } finally {
      setPeakLoading(false);
    }
  };

  // 상담 정보 로드
  useEffect(() => {
    const loadConsultation = async () => {
      setLoadError(null);
      try {
        const data = await apiClient.get<Consultation>(`/consultations/${consultationId}`, SILENT_CONFIG);
        setConsultation(data);
        setConsultationMemo(data.consultation_memo || '');

        if (data.consultation_type === 'learning' && data.linked_student_id) {
          try {
            const studentData = await apiClient.get<{ student: LinkedStudent }>(`/students/${data.linked_student_id}`, SILENT_CONFIG);
            setLinkedStudent(studentData.student);
          } catch {
            setLinkedStudent(null);
          }

          let existing: PreviousConsultation | undefined;
          let savedMockScores: LearningMockScores | null = null;
          try {
            const prevData = await apiClient.get<{ consultations: PreviousConsultation[] }>(`/student-consultations/${data.linked_student_id}`, SILENT_CONFIG);
            const allConsultations = prevData.consultations || [];
            setPreviousConsultations(allConsultations);

            existing = allConsultations.find(item => item.consultation_id === data.id);
            if (existing) {
              setExistingStudentConsultationId(existing.id);
              savedMockScores = parseLearningMockScores(existing.mock_test_scores);
            }
          } catch {
            setPreviousConsultations([]);
          }

          const jungsiMockScores = hasAnyLearningMockScore(savedMockScores)
            ? null
            : await fetchJungsiLearningMockScores(data.linked_student_id);
          if (existing || jungsiMockScores) {
            setLearningForm(prev => {
              const next = existing ? {
                ...prev,
                admissionType: existing.admission_type || 'early',
                schoolGradeAvg: existing.school_grade_avg ? String(existing.school_grade_avg) : '',
                academicMemo: existing.academic_memo || '',
                physicalRecordType: existing.physical_record_type || 'latest',
                physicalMemo: existing.physical_memo || '',
                targetUniversity1: existing.target_university_1 || '',
                targetUniversity2: existing.target_university_2 || '',
                targetMemo: existing.target_memo || '',
                generalMemo: existing.general_memo || '',
              } : prev;
              if (savedMockScores && hasAnyLearningMockScore(savedMockScores)) {
                return { ...next, mockTestScores: savedMockScores };
              }
              if (jungsiMockScores) {
                return {
                  ...next,
                  mockTestScores: mergeMissingLearningMockScores(next.mockTestScores, jungsiMockScores),
                };
              }
              return next;
            });
          }

          loadPeakRecords(data.linked_student_id);
        }

        if (data.consultation_type !== 'learning') {
          if (data.checklist && data.checklist.length > 0) {
            setChecklist(data.checklist);
          } else {
            try {
              const settingsResponse = await apiClient.get<{ settings: { checklist_template?: ChecklistTemplate[] } }>('/consultations/settings/info', SILENT_CONFIG);
              const template = settingsResponse.settings?.checklist_template || DEFAULT_CONSULTATION_CHECKLIST;
              setChecklist(template.map(item => ({
                ...item,
                checked: false,
                input: item.input ? { ...item.input, value: item.input.value || '' } : undefined,
                inputs: item.inputs?.map(inp => ({ ...inp, value: inp.value || '' })),
              })));
            } catch {
              setChecklist(DEFAULT_CONSULTATION_CHECKLIST.map(item => ({
                ...item,
                checked: false,
                input: item.input ? { ...item.input, value: '' } : undefined,
                inputs: item.inputs?.map(inp => ({ ...inp, value: '' })),
              })));
            }
          }
        }
      } catch {
        setLoadError('잠시 후 다시 시도해주세요.');
      } finally {
        setLoading(false);
      }
    };

    loadConsultation();
  }, [consultationId]);

  // 체크리스트 체크 토글
  const toggleCheck = (itemId: number) => {
    setChecklist(prev =>
      prev.map(item => item.id === itemId ? { ...item, checked: !item.checked } : item)
    );
  };

  // 입력값 변경
  const updateInputValue = (itemId: number, inputIndex: number | null, value: string) => {
    setChecklist(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        if (inputIndex === null && item.input) return { ...item, input: { ...item.input, value } };
        if (inputIndex !== null && item.inputs) {
          const newInputs = [...item.inputs];
          newInputs[inputIndex] = { ...newInputs[inputIndex], value };
          return { ...item, inputs: newInputs };
        }
        return item;
      })
    );
  };

  const toggleCategory = (category: string) =>
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));

  const toggleSection = (section: string) =>
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));

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
          await apiClient.put(`/student-consultations/${existingStudentConsultationId}`, payload, SILENT_CONFIG);
          toast.success('상담 기록이 수정되었습니다.');
        } else {
          const result = await apiClient.post<{ id: number }>('/student-consultations', payload, SILENT_CONFIG);
          setExistingStudentConsultationId(result.id);
          toast.success('상담 기록이 저장되었습니다.');
        }
        setConsultation({ ...consultation, status: 'completed' });
      } else {
        await apiClient.put(`/consultations/${consultation.id}`, {
          checklist,
          consultationMemo,
          status: 'completed',
        }, SILENT_CONFIG);
        setConsultation({ ...consultation, status: 'completed' });
        toast.success('상담이 완료 처리되었습니다.');
      }
    } catch {
      toast.error('저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  // 체험 일정
  const addTrialDate = () => setTrialDates([...trialDates, { date: '', timeSlot: '' }]);
  const removeTrialDate = (index: number) => {
    if (trialDates.length <= 1) { toast.error('최소 1개의 체험 일정이 필요합니다.'); return; }
    setTrialDates(trialDates.filter((_, i) => i !== index));
  };

  const handleConvertToTrial = async () => {
    if (!consultation) return;
    const incompleteDate = trialDates.find(d => !d.date || !d.timeSlot);
    if (incompleteDate) { toast.error('모든 체험 일정의 날짜와 시간대를 선택해주세요.'); return; }
    const dateSet = new Set<string>();
    for (const d of trialDates) {
      const key = `${d.date}-${d.timeSlot}`;
      if (dateSet.has(key)) { toast.error('같은 날짜, 같은 시간대의 체험 일정이 중복됩니다.'); return; }
      dateSet.add(key);
    }
    const dateOnlySet = new Set<string>();
    for (const d of trialDates) {
      if (dateOnlySet.has(d.date)) { toast.error('같은 날에 여러 체험 수업을 등록할 수 없습니다.'); return; }
      dateOnlySet.add(d.date);
    }
    setConvertingToTrial(true);
    try {
      await apiClient.put(`/consultations/${consultation.id}`, { checklist, consultationMemo }, SILENT_CONFIG);
      await convertToTrialStudent(consultation.id, trialDates, undefined, SILENT_CONFIG);
      toast.success('체험 학생으로 등록되었습니다.');
      setTrialModalOpen(false);
      router.push(backUrl);
    } catch {
      toast.error('체험 학생으로 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setConvertingToTrial(false);
    }
  };

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
      }, SILENT_CONFIG);
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
    } catch {
      toast.error('학생 정보를 수정하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSavingStudent(false);
    }
  };

  const handleConvertToPending = async () => {
    if (!consultation) return;
    setConvertingToPending(true);
    try {
      await apiClient.put(`/consultations/${consultation.id}`, { checklist, consultationMemo }, SILENT_CONFIG);
      await convertToPendingStudent(consultation.id, undefined, pendingMemo || consultationMemo || undefined, SILENT_CONFIG);
      toast.success('미등록관리 학생으로 등록되었습니다.');
      setPendingModalOpen(false);
      router.push(backUrl);
    } catch {
      toast.error('미등록관리 학생으로 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setConvertingToPending(false);
    }
  };

  // 파생 값
  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  const progressPercent = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0;

  return {
    // state
    consultation, setConsultation,
    loading,
    loadError,
    saving,
    checklist,
    consultationMemo, setConsultationMemo,
    expandedCategories,
    trialModalOpen, setTrialModalOpen,
    trialDates, setTrialDates,
    convertingToTrial,
    pendingModalOpen, setPendingModalOpen,
    pendingMemo, setPendingMemo,
    convertingToPending,
    studentEditModalOpen, setStudentEditModalOpen,
    studentEditForm, setStudentEditForm,
    savingStudent,
    linkedStudent,
    previousConsultations,
    memoModal, setMemoModal,
    peakRecords,
    peakLoading,
    learningForm, setLearningForm,
    expandedSections,
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
    loadPeakRecords,
    // derived
    backUrl,
    backLabel,
    groupedChecklist,
    progressPercent,
  };
}
