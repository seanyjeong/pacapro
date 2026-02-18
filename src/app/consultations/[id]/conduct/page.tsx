'use client';

import { useState, useEffect, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, Save, User, Phone, School, Target, Calendar, Clock,
  CheckSquare, Square, ChevronDown, ChevronUp, Loader2, Sparkles, Plus, Trash2,
  GraduationCap, UserPlus, Edit
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

import apiClient from '@/lib/api/client';
import { convertToTrialStudent, convertToPendingStudent } from '@/lib/api/consultations';
import type { Consultation, ChecklistItem, ChecklistTemplate, LearningType } from '@/lib/types/consultation';
import { CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS, LEARNING_TYPE_LABELS } from '@/lib/types/consultation';

// 기본 체크리스트 템플릿 (체대입시 특화)
const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplate[] = [
  // 학생 배경
  { id: 1, category: '학생 배경', text: '타학원 경험 확인', input: { type: 'text', label: '학원명' } },
  { id: 2, category: '학생 배경', text: '운동 경력 확인', inputs: [
    { type: 'radio', label: '과거 선수 경험', options: ['있음', '없음'] },
    { type: 'text', label: '종목' }
  ]},
  { id: 3, category: '학생 배경', text: '제멀 기록 확인 (학교 기록)', input: { type: 'text', label: '기록' } },

  // 체력 및 성향
  { id: 4, category: '체력 및 성향', text: '현재 체력 수준', input: { type: 'radio', label: '체력', options: ['상', '중', '하'] } },
  { id: 5, category: '체력 및 성향', text: '성격/성향 파악', input: { type: 'radio', label: '성향', options: ['외향적', '내향적'] } },
  { id: 6, category: '체력 및 성향', text: '기타 운동 종목', input: { type: 'text', label: '종목' } },

  // 안내 완료
  { id: 7, category: '안내 완료', text: '수시/정시 입시 설명' },
  { id: 8, category: '안내 완료', text: '학원 커리큘럼 안내' },
  { id: 9, category: '안내 완료', text: '수업료 안내' },
  { id: 10, category: '안내 완료', text: '체험 수업 일정 협의' },
  { id: 11, category: '안내 완료', text: '질의응답 완료' },
];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ConductPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPage = searchParams.get('from');

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [consultationMemo, setConsultationMemo] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    '학생 배경': true,
    '체력 및 성향': true,
    '안내 완료': true
  });

  // 체험 등록 모달
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialDates, setTrialDates] = useState<{ date: string; timeSlot: string }[]>([
    { date: '', timeSlot: '' }
  ]);
  const [convertingToTrial, setConvertingToTrial] = useState(false);

  // 미등록관리 모달
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [pendingMemo, setPendingMemo] = useState('');
  const [convertingToPending, setConvertingToPending] = useState(false);

  // 학생 정보 수정 모달
  const [studentEditModalOpen, setStudentEditModalOpen] = useState(false);
  const [studentEditForm, setStudentEditForm] = useState({
    student_name: '',
    student_grade: '',
    gender: '' as 'male' | 'female' | '',
    student_school: '',
    parent_phone: '',
    target_school: ''
  });
  const [savingStudent, setSavingStudent] = useState(false);

  // 재원생 상담용 상태
  const [linkedStudent, setLinkedStudent] = useState<{
    id: number;
    name: string;
    grade: string;
    school?: string;
    student_type?: string;
  } | null>(null);
  // 이전 상담 기록
  const [previousConsultations, setPreviousConsultations] = useState<Array<{
    id: number;
    consultation_date: string;
    consultation_type: string;
    general_memo: string | null;
    academic_memo: string | null;
    physical_memo: string | null;
    target_memo: string | null;
  }>>([]);
  // 이전 메모 상세 모달
  const [memoModal, setMemoModal] = useState<{
    open: boolean;
    date: string;
    type: 'general' | 'academic' | 'physical' | 'target';
    content: string;
  }>({ open: false, date: '', type: 'general', content: '' });
  const [peakRecords, setPeakRecords] = useState<Record<string, {
    value: number;
    unit: string;
    direction: string;
    measured_at: string;
  }>>({});
  const [peakLoading, setPeakLoading] = useState(false);
  const [learningForm, setLearningForm] = useState({
    admissionType: 'early' as 'early' | 'regular',
    schoolGradeAvg: '' as string,
    mockTestScores: {
      march: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
      june: { korean: '', math: '', english: '', exploration1: '', exploration2: '' },
      september: { korean: '', math: '', english: '', exploration1: '', exploration2: '' }
    } as Record<string, Record<string, string>>,
    academicMemo: '',
    physicalRecordType: 'latest' as 'latest' | 'average',
    physicalMemo: '',
    targetUniversity1: '',
    targetUniversity2: '',
    targetMemo: '',
    generalMemo: ''
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    '학업': true,
    '실기': true,
    '목표': true,
    '기타': true
  });

  // 돌아갈 페이지 결정 (상담 유형에 따라)
  const getBackNavigation = () => {
    if (fromPage === 'pending') {
      return { url: '/students?tab=pending', label: '미등록관리로' };
    }
    if (fromPage === 'trial') {
      return { url: '/students?tab=trial', label: '체험생관리로' };
    }
    if (consultation?.consultation_type === 'learning') {
      return { url: '/consultations/enrolled', label: '재원생상담으로' };
    }
    return { url: '/consultations/new-inquiry', label: '신규상담으로' };
  };
  const { url: backUrl, label: backLabel } = getBackNavigation();

  // 상담 정보 로드
  useEffect(() => {
    const loadConsultation = async () => {
      try {
        const data = await apiClient.get<Consultation>(`/consultations/${resolvedParams.id}`);
        setConsultation(data);
        setConsultationMemo(data.consultation_memo || '');

        // 재원생 상담인 경우 학생 정보 및 P-EAK 기록 로드
        if (data.consultation_type === 'learning' && data.linked_student_id) {
          // 학생 정보 로드
          try {
            const studentData = await apiClient.get<{ student: typeof linkedStudent }>(`/students/${data.linked_student_id}`);
            setLinkedStudent(studentData.student);
          } catch (err) {
            console.error('학생 정보 로드 오류:', err);
          }

          // 이전 상담 기록 로드
          try {
            const prevData = await apiClient.get<{ consultations: typeof previousConsultations }>(`/student-consultations/${data.linked_student_id}`);
            setPreviousConsultations(prevData.consultations || []);
          } catch (err) {
            console.error('이전 상담 기록 로드 오류:', err);
          }

          // P-EAK 기록 로드
          loadPeakRecords(data.linked_student_id);
        }

        // 체크리스트 설정 로드 또는 기본값 사용 (신규 상담인 경우에만)
        if (data.consultation_type !== 'learning') {
          if (data.checklist && data.checklist.length > 0) {
            setChecklist(data.checklist);
          } else {
            // 설정에서 템플릿 로드 시도
            try {
              const settingsResponse = await apiClient.get<{ settings: { checklist_template?: ChecklistTemplate[] } }>('/consultations/settings/info');
              const template = settingsResponse.settings?.checklist_template || DEFAULT_CHECKLIST_TEMPLATE;
              setChecklist(template.map(item => ({
                ...item,
                checked: false,
                input: item.input ? { ...item.input, value: item.input.value || '' } : undefined,
                inputs: item.inputs?.map(inp => ({ ...inp, value: inp.value || '' }))
              })));
            } catch {
              // 기본 템플릿 사용
              setChecklist(DEFAULT_CHECKLIST_TEMPLATE.map(item => ({
                ...item,
                checked: false,
                input: item.input ? { ...item.input, value: '' } : undefined,
                inputs: item.inputs?.map(inp => ({ ...inp, value: '' }))
              })));
            }
          }
        }
      } catch (error) {
        console.error('상담 정보 로드 오류:', error);
        toast.error('상담 정보를 불러오는데 실패했습니다.');
        router.push(backUrl);
      } finally {
        setLoading(false);
      }
    };

    loadConsultation();
  }, [resolvedParams.id, router, backUrl]);

  // P-EAK 기록 로드
  const loadPeakRecords = async (studentId: number, type: 'latest' | 'average' = 'latest') => {
    setPeakLoading(true);
    try {
      const response = await apiClient.get<{
        found: boolean;
        records: typeof peakRecords;
      }>(`/student-consultations/${studentId}/peak-records`, {
        params: { type }
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
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // 섹션 토글 (재원생 상담용)
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // 저장
  const handleSave = async () => {
    if (!consultation) return;

    setSaving(true);
    try {
      if (consultation.consultation_type === 'learning' && consultation.linked_student_id) {
        // 재원생 상담 저장 - student_consultations 테이블에 저장
        await apiClient.post('/student-consultations', {
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
          general_memo: learningForm.generalMemo
        });
        toast.success('상담 기록이 저장되었습니다.');
        // 상담 상태도 업데이트
        setConsultation({ ...consultation, status: 'completed' });
      } else {
        // 신규 상담 저장
        await apiClient.put(`/consultations/${consultation.id}`, {
          checklist,
          consultationMemo,
          status: 'completed' // 상담 완료 상태로 변경
        });
        // 상태 업데이트
        setConsultation({ ...consultation, status: 'completed' });
        toast.success('상담이 완료 처리되었습니다.');
      }
    } catch (error) {
      console.error('저장 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 체험 일정 추가
  const addTrialDate = () => {
    setTrialDates([...trialDates, { date: '', timeSlot: '' }]);
  };

  // 체험 일정 삭제
  const removeTrialDate = (index: number) => {
    if (trialDates.length <= 1) {
      toast.error('최소 1개의 체험 일정이 필요합니다.');
      return;
    }
    const newDates = trialDates.filter((_, i) => i !== index);
    setTrialDates(newDates);
  };

  // 체험 학생 등록
  const handleConvertToTrial = async () => {
    if (!consultation) return;

    // 모든 일정이 입력되었는지 검증
    const incompleteDate = trialDates.find(d => !d.date || !d.timeSlot);
    if (incompleteDate) {
      toast.error('모든 체험 일정의 날짜와 시간대를 선택해주세요.');
      return;
    }

    // 중복 날짜 검증
    const dateSet = new Set<string>();
    for (const d of trialDates) {
      const key = `${d.date}-${d.timeSlot}`;
      if (dateSet.has(key)) {
        toast.error('같은 날짜, 같은 시간대의 체험 일정이 중복됩니다.');
        return;
      }
      dateSet.add(key);
    }

    // 같은 날짜 체크 (시간대 다르더라도)
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
      // 먼저 체크리스트와 메모 저장
      await apiClient.put(`/consultations/${consultation.id}`, {
        checklist,
        consultationMemo
      });

      // 체험 등록
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
      target_school: consultation.target_school || ''
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
        target_school: studentEditForm.target_school
      });

      // 로컬 상태 업데이트
      setConsultation({
        ...consultation,
        student_name: studentEditForm.student_name,
        student_grade: studentEditForm.student_grade as typeof consultation.student_grade,
        gender: studentEditForm.gender || undefined,
        student_school: studentEditForm.student_school,
        parent_phone: studentEditForm.parent_phone,
        target_school: studentEditForm.target_school
      });

      toast.success('학생 정보가 수정되었습니다.');
      setStudentEditModalOpen(false);
    } catch (error) {
      console.error('학생 정보 수정 오류:', error);
      toast.error('학생 정보 수정에 실패했습니다.');
    } finally {
      setSavingStudent(false);
    }
  };

  // 미등록관리 학생 등록
  const handleConvertToPending = async () => {
    if (!consultation) return;

    setConvertingToPending(true);
    try {
      // 먼저 체크리스트와 메모 저장
      await apiClient.put(`/consultations/${consultation.id}`, {
        checklist,
        consultationMemo
      });

      // 미등록관리 등록
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

  // 카테고리별 그룹핑
  const groupedChecklist = checklist.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, ChecklistItem[]>);

  // 진행률 계산
  const progressPercent = checklist.length > 0
    ? Math.round((checklist.filter(c => c.checked).length / checklist.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-muted-foreground">상담 정보를 찾을 수 없습니다.</p>
        <Link href={backUrl}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {backLabel}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={backUrl}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {backLabel}
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {consultation.consultation_type === 'learning' ? '재원생 상담' : '상담 진행'}: {consultation.student_name} ({consultation.student_grade})
                  {consultation.consultation_type === 'learning' && consultation.learning_type && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      {LEARNING_TYPE_LABELS[consultation.learning_type]}
                    </Badge>
                  )}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })} {consultation.preferred_time}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge className={CONSULTATION_STATUS_COLORS[consultation.status]}>
                {CONSULTATION_STATUS_LABELS[consultation.status]}
              </Badge>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                저장
              </Button>
            </div>
          </div>

          {/* 진행률 - 신규 상담에만 표시 */}
          {consultation.consultation_type !== 'learning' && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">진행률</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* 재원생 상담 UI */}
        {consultation.consultation_type === 'learning' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 왼쪽 컬럼: 학업 + 목표 */}
            <div className="space-y-6">
              {/* 학업 섹션 */}
              <Card>
                <CardHeader className="pb-3">
                  <button
                    onClick={() => toggleSection('학업')}
                    className="w-full flex items-center justify-between"
                  >
                    <CardTitle className="text-lg flex items-center">
                      <GraduationCap className="h-5 w-5 mr-2 text-blue-600" />
                      학업
                    </CardTitle>
                    {expandedSections['학업'] ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </CardHeader>
                {/* 이전 학업 메모 */}
                {previousConsultations.filter(p => p.academic_memo).length > 0 && (
                  <div className="px-6 pb-2 space-y-1">
                    {previousConsultations.filter(p => p.academic_memo).slice(0, 3).map((prev) => (
                      <button
                        key={prev.id}
                        onClick={() => setMemoModal({
                          open: true,
                          date: format(parseISO(prev.consultation_date), 'yyyy년 M월 d일', { locale: ko }),
                          type: 'academic',
                          content: prev.academic_memo || ''
                        })}
                        className="w-full text-left text-xs px-2 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-2"
                      >
                        <span className="font-medium shrink-0">{format(parseISO(prev.consultation_date), 'M/d', { locale: ko })}</span>
                        <span className="truncate text-blue-600">{prev.academic_memo?.slice(0, 30)}{(prev.academic_memo?.length || 0) > 30 ? '...' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {expandedSections['학업'] && (
                  <CardContent className="space-y-4">
                    {/* 입시 유형 & 내신 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">입시 유형</Label>
                        <Select
                          value={learningForm.admissionType}
                          onValueChange={(v) => setLearningForm({ ...learningForm, admissionType: v as 'early' | 'regular' })}
                        >
                          <SelectTrigger className="mt-1">
                            <span>{learningForm.admissionType === 'early' ? '수시' : '정시'}</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="early">수시</SelectItem>
                            <SelectItem value="regular">정시</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">내신 평균</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="1"
                          max="9"
                          placeholder="예: 3.5"
                          value={learningForm.schoolGradeAvg}
                          onChange={(e) => setLearningForm({ ...learningForm, schoolGradeAvg: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* 모의고사 성적 표 */}
                    <div>
                      <Label className="text-sm text-muted-foreground mb-2 block">모의고사 성적 (등급)</Label>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border border-border rounded-lg">
                          <thead>
                            <tr className="bg-muted">
                              <th className="p-2 text-left font-medium">회차</th>
                              <th className="p-2 text-center font-medium">국어</th>
                              <th className="p-2 text-center font-medium">수학</th>
                              <th className="p-2 text-center font-medium">영어</th>
                              <th className="p-2 text-center font-medium">탐구1</th>
                              <th className="p-2 text-center font-medium">탐구2</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(['march', 'june', 'september'] as const).map((month) => (
                              <tr key={month} className="border-t border-border">
                                <td className="p-2 font-medium">
                                  {month === 'march' ? '3월' : month === 'june' ? '6월' : '9월'}
                                </td>
                                {(['korean', 'math', 'english', 'exploration1', 'exploration2'] as const).map((subject) => (
                                  <td key={subject} className="p-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      max="9"
                                      className="h-8 text-center w-12"
                                      value={learningForm.mockTestScores[month]?.[subject] || ''}
                                      onChange={(e) => {
                                        setLearningForm({
                                          ...learningForm,
                                          mockTestScores: {
                                            ...learningForm.mockTestScores,
                                            [month]: {
                                              ...learningForm.mockTestScores[month],
                                              [subject]: e.target.value
                                            }
                                          }
                                        });
                                      }}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* 학업 메모 */}
                    <div>
                      <Label className="text-sm text-muted-foreground">학업 메모</Label>
                      <Textarea
                        placeholder="학업 관련 메모..."
                        value={learningForm.academicMemo}
                        onChange={(e) => setLearningForm({ ...learningForm, academicMemo: e.target.value })}
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* 목표 섹션 */}
              <Card>
                <CardHeader className="pb-3">
                  <button
                    onClick={() => toggleSection('목표')}
                    className="w-full flex items-center justify-between"
                  >
                    <CardTitle className="text-lg flex items-center">
                      <Target className="h-5 w-5 mr-2 text-purple-600" />
                      목표
                    </CardTitle>
                    {expandedSections['목표'] ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </CardHeader>
                {/* 이전 목표 메모 */}
                {previousConsultations.filter(p => p.target_memo).length > 0 && (
                  <div className="px-6 pb-2 space-y-1">
                    {previousConsultations.filter(p => p.target_memo).slice(0, 3).map((prev) => (
                      <button
                        key={prev.id}
                        onClick={() => setMemoModal({
                          open: true,
                          date: format(parseISO(prev.consultation_date), 'yyyy년 M월 d일', { locale: ko }),
                          type: 'target',
                          content: prev.target_memo || ''
                        })}
                        className="w-full text-left text-xs px-2 py-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-2"
                      >
                        <span className="font-medium shrink-0">{format(parseISO(prev.consultation_date), 'M/d', { locale: ko })}</span>
                        <span className="truncate text-purple-600">{prev.target_memo?.slice(0, 30)}{(prev.target_memo?.length || 0) > 30 ? '...' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {expandedSections['목표'] && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm text-muted-foreground">목표 대학 1</Label>
                        <Input
                          placeholder="예: 한국체육대학교"
                          value={learningForm.targetUniversity1}
                          onChange={(e) => setLearningForm({ ...learningForm, targetUniversity1: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-sm text-muted-foreground">목표 대학 2</Label>
                        <Input
                          placeholder="예: 경희대학교"
                          value={learningForm.targetUniversity2}
                          onChange={(e) => setLearningForm({ ...learningForm, targetUniversity2: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">목표 메모</Label>
                      <Textarea
                        placeholder="목표 관련 메모..."
                        value={learningForm.targetMemo}
                        onChange={(e) => setLearningForm({ ...learningForm, targetMemo: e.target.value })}
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* 오른쪽 컬럼: 실기 + 기타 */}
            <div className="space-y-6">
              {/* 실기 섹션 */}
              <Card>
                <CardHeader className="pb-3">
                  <button
                    onClick={() => toggleSection('실기')}
                    className="w-full flex items-center justify-between"
                  >
                    <CardTitle className="text-lg flex items-center">
                      <Sparkles className="h-5 w-5 mr-2 text-orange-600" />
                      실기 (P-EAK)
                    </CardTitle>
                    {expandedSections['실기'] ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </CardHeader>
                {/* 이전 실기 메모 */}
                {previousConsultations.filter(p => p.physical_memo).length > 0 && (
                  <div className="px-6 pb-2 space-y-1">
                    {previousConsultations.filter(p => p.physical_memo).slice(0, 3).map((prev) => (
                      <button
                        key={prev.id}
                        onClick={() => setMemoModal({
                          open: true,
                          date: format(parseISO(prev.consultation_date), 'yyyy년 M월 d일', { locale: ko }),
                          type: 'physical',
                          content: prev.physical_memo || ''
                        })}
                        className="w-full text-left text-xs px-2 py-1.5 rounded bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors flex items-center gap-2"
                      >
                        <span className="font-medium shrink-0">{format(parseISO(prev.consultation_date), 'M/d', { locale: ko })}</span>
                        <span className="truncate text-orange-600">{prev.physical_memo?.slice(0, 30)}{(prev.physical_memo?.length || 0) > 30 ? '...' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {expandedSections['실기'] && (
                  <CardContent className="space-y-4">
                    {/* 기록 조회 타입 */}
                    <div className="flex items-center gap-4">
                      <Label className="text-sm text-muted-foreground">기록 타입:</Label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="recordType"
                            checked={learningForm.physicalRecordType === 'latest'}
                            onChange={() => {
                              setLearningForm({ ...learningForm, physicalRecordType: 'latest' });
                              if (consultation.linked_student_id) {
                                loadPeakRecords(consultation.linked_student_id, 'latest');
                              }
                            }}
                          />
                          <span className="text-sm">최근 기록</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="recordType"
                            checked={learningForm.physicalRecordType === 'average'}
                            onChange={() => {
                              setLearningForm({ ...learningForm, physicalRecordType: 'average' });
                              if (consultation.linked_student_id) {
                                loadPeakRecords(consultation.linked_student_id, 'average');
                              }
                            }}
                          />
                          <span className="text-sm">평균 기록</span>
                        </label>
                      </div>
                    </div>

                    {/* P-EAK 기록 표시 */}
                    {peakLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                        <span className="ml-2 text-sm text-muted-foreground">P-EAK 기록 로딩 중...</span>
                      </div>
                    ) : Object.keys(peakRecords).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {Object.entries(peakRecords).map(([name, record]) => (
                          <div key={name} className="bg-muted rounded-lg p-3 text-center">
                            <div className="text-xs text-muted-foreground mb-1">{name}</div>
                            <div className="text-lg font-bold text-foreground">
                              {record.value} <span className="text-sm font-normal">{record.unit}</span>
                            </div>
                            {record.measured_at && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(record.measured_at), 'MM/dd')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        P-EAK에서 기록을 찾을 수 없습니다.
                      </div>
                    )}

                    {/* 실기 메모 */}
                    <div>
                      <Label className="text-sm text-muted-foreground">실기 메모</Label>
                      <Textarea
                        placeholder="실기 관련 메모..."
                        value={learningForm.physicalMemo}
                        onChange={(e) => setLearningForm({ ...learningForm, physicalMemo: e.target.value })}
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* 기타 섹션 */}
              <Card>
                <CardHeader className="pb-3">
                  <button
                    onClick={() => toggleSection('기타')}
                    className="w-full flex items-center justify-between"
                  >
                    <CardTitle className="text-lg flex items-center">
                      <Calendar className="h-5 w-5 mr-2 text-green-600" />
                      기타
                    </CardTitle>
                    {expandedSections['기타'] ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                </CardHeader>
                {/* 이전 종합 메모 */}
                {previousConsultations.filter(p => p.general_memo).length > 0 && (
                  <div className="px-6 pb-2 space-y-1">
                    {previousConsultations.filter(p => p.general_memo).slice(0, 3).map((prev) => (
                      <button
                        key={prev.id}
                        onClick={() => setMemoModal({
                          open: true,
                          date: format(parseISO(prev.consultation_date), 'yyyy년 M월 d일', { locale: ko }),
                          type: 'general',
                          content: prev.general_memo || ''
                        })}
                        className="w-full text-left text-xs px-2 py-1.5 rounded bg-green-50 text-green-700 hover:bg-green-100 transition-colors flex items-center gap-2"
                      >
                        <span className="font-medium shrink-0">{format(parseISO(prev.consultation_date), 'M/d', { locale: ko })}</span>
                        <span className="truncate text-green-600">{prev.general_memo?.slice(0, 30)}{(prev.general_memo?.length || 0) > 30 ? '...' : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {expandedSections['기타'] && (
                  <CardContent>
                    <div>
                      <Label className="text-sm text-muted-foreground">종합 메모</Label>
                      <Textarea
                        placeholder="상담 종합 메모..."
                        value={learningForm.generalMemo}
                        onChange={(e) => setLearningForm({ ...learningForm, generalMemo: e.target.value })}
                        className="mt-1 min-h-[150px]"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        ) : (
          /* 신규 상담 UI */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 기본 정보 + 메모 */}
          <div className="space-y-6">
            {/* 기본 정보 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center">
                    <User className="h-5 w-5 mr-2 text-primary-600" />
                    기본 정보
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openStudentEditModal}
                    className="h-8 px-2"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    수정
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">학생명</span>
                    <p className="font-medium">{consultation.student_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">학년</span>
                    <p className="font-medium">{consultation.student_grade}</p>
                  </div>
                </div>

                {consultation.gender && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">성별</span>
                    <p className="font-medium">{consultation.gender === 'male' ? '남' : '여'}</p>
                  </div>
                )}

                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  <span>{consultation.parent_phone}</span>
                </div>

                {consultation.student_school && (
                  <div className="flex items-center text-sm">
                    <School className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{consultation.student_school}</span>
                  </div>
                )}

                {consultation.target_school && (
                  <div className="flex items-center text-sm">
                    <Target className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>목표: {consultation.target_school}</span>
                  </div>
                )}

                {consultation.referral_sources && consultation.referral_sources.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">알게 된 경로</span>
                    <p className="font-medium">{consultation.referral_sources.join(', ')}</p>
                  </div>
                )}

                {consultation.inquiry_content && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">문의 내용</span>
                    <p className="text-foreground mt-1">{consultation.inquiry_content}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 성적 정보 */}
            {consultation.academicScores && (() => {
              const scores = consultation.academicScores;
              const hasMockGrades = scores.mockTestGrades &&
                Object.values(scores.mockTestGrades).some(v => v !== null && v !== undefined && v !== -1);
              const hasSchoolGradeAvg = scores.schoolGradeAvg !== null &&
                scores.schoolGradeAvg !== undefined && scores.schoolGradeAvg !== -1;
              const hasAdmissionType = scores.admissionType;

              if (!hasMockGrades && !hasSchoolGradeAvg && !hasAdmissionType) return null;

              const admissionTypeLabel = scores.admissionType === 'early' ? '수시' :
                scores.admissionType === 'regular' ? '정시' : scores.admissionType;

              return (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <GraduationCap className="h-5 w-5 mr-2 text-primary-600" />
                      성적 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 내신 평균 + 입시 유형 */}
                    <div className="flex gap-4">
                      {hasSchoolGradeAvg && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">내신</span>
                          <span className="font-bold text-blue-600">
                            {scores.schoolGradeAvg === -1 ? '미응시' : `${scores.schoolGradeAvg}등급`}
                          </span>
                        </div>
                      )}
                      {hasAdmissionType && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm">입시</span>
                          <span className="font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm">
                            {admissionTypeLabel}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 모의고사 등급 표 */}
                    {hasMockGrades && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">모의고사</p>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['korean', 'math', 'english', 'exploration'].map((subject) => {
                            const labels: Record<string, string> = {
                              korean: '국',
                              math: '수',
                              english: '영',
                              exploration: '탐'
                            };
                            const value = scores.mockTestGrades?.[subject as keyof typeof scores.mockTestGrades];
                            return (
                              <div key={subject} className="bg-muted rounded p-2 text-center">
                                <div className="text-xs text-muted-foreground">{labels[subject]}</div>
                                <div className={`font-bold ${value === -1 ? 'text-muted-foreground text-sm' : 'text-foreground'}`}>
                                  {value === -1 ? '-' : value ?? '-'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* 상담 메모 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">상담 메모</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="상담 중 메모할 내용을 입력하세요..."
                  value={consultationMemo}
                  onChange={(e) => setConsultationMemo(e.target.value)}
                  className="min-h-[200px] resize-none"
                />
              </CardContent>
            </Card>
          </div>

          {/* 오른쪽: 체크리스트 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <CheckSquare className="h-5 w-5 mr-2 text-primary-600" />
                  상담 체크리스트
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(groupedChecklist).map(([category, items]) => (
                  <div key={category} className="border border-border rounded-lg overflow-hidden">
                    {/* 카테고리 헤더 */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-center">
                        <span className="font-medium text-foreground">{category}</span>
                        <Badge variant="secondary" className="ml-2">
                          {items.filter(i => i.checked).length}/{items.length}
                        </Badge>
                      </div>
                      {expandedCategories[category] ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    {/* 체크리스트 항목 */}
                    {expandedCategories[category] && (
                      <div className="divide-y">
                        {items.map((item) => (
                          <div key={item.id} className="px-4 py-3 space-y-2">
                            {/* 체크박스 + 텍스트 */}
                            <div
                              className="flex items-start cursor-pointer"
                              onClick={() => toggleCheck(item.id)}
                            >
                              {item.checked ? (
                                <CheckSquare className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                              )}
                              <span className={`ml-3 ${item.checked ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                                {item.text}
                              </span>
                            </div>

                            {/* 단일 입력 필드 */}
                            {item.input && (
                              <div className="ml-8">
                                {item.input.type === 'text' ? (
                                  <div className="flex items-center space-x-2">
                                    <Label className="text-sm text-muted-foreground min-w-fit">{item.input.label}:</Label>
                                    <Input
                                      value={item.input.value}
                                      onChange={(e) => updateInputValue(item.id, null, e.target.value)}
                                      className="h-8 text-sm max-w-xs"
                                      placeholder={`${item.input.label} 입력`}
                                    />
                                  </div>
                                ) : item.input.type === 'radio' && item.input.options && (
                                  <div className="flex items-center space-x-3">
                                    <Label className="text-sm text-muted-foreground">{item.input.label}:</Label>
                                    <div className="flex items-center space-x-4">
                                      {item.input.options.map((option) => (
                                        <label key={option} className="flex items-center cursor-pointer">
                                          <input
                                            type="radio"
                                            name={`input-${item.id}`}
                                            value={option}
                                            checked={item.input?.value === option}
                                            onChange={(e) => updateInputValue(item.id, null, e.target.value)}
                                            className="mr-1.5"
                                          />
                                          <span className="text-sm">{option}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 복수 입력 필드 */}
                            {item.inputs && item.inputs.length > 0 && (
                              <div className="ml-8 space-y-2">
                                {item.inputs.map((inp, idx) => (
                                  <div key={idx}>
                                    {inp.type === 'text' ? (
                                      <div className="flex items-center space-x-2">
                                        <Label className="text-sm text-muted-foreground min-w-fit">{inp.label}:</Label>
                                        <Input
                                          value={inp.value}
                                          onChange={(e) => updateInputValue(item.id, idx, e.target.value)}
                                          className="h-8 text-sm max-w-xs"
                                          placeholder={`${inp.label} 입력`}
                                        />
                                      </div>
                                    ) : inp.type === 'radio' && inp.options && (
                                      <div className="flex items-center space-x-3">
                                        <Label className="text-sm text-muted-foreground">{inp.label}:</Label>
                                        <div className="flex items-center space-x-4">
                                          {inp.options.map((option) => (
                                            <label key={option} className="flex items-center cursor-pointer">
                                              <input
                                                type="radio"
                                                name={`input-${item.id}-${idx}`}
                                                value={option}
                                                checked={inp.value === option}
                                                onChange={(e) => updateInputValue(item.id, idx, e.target.value)}
                                                className="mr-1.5"
                                              />
                                              <span className="text-sm">{option}</span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
        )}
      </div>

      {/* 이전 메모 상세 모달 */}
      <Dialog open={memoModal.open} onOpenChange={(open) => setMemoModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-md py-6 px-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {memoModal.type === 'academic' && <GraduationCap className="h-5 w-5 text-blue-600" />}
              {memoModal.type === 'physical' && <Sparkles className="h-5 w-5 text-orange-600" />}
              {memoModal.type === 'general' && <Calendar className="h-5 w-5 text-green-600" />}
              {memoModal.type === 'target' && <Target className="h-5 w-5 text-purple-600" />}
              {memoModal.date} 상담 메모
            </DialogTitle>
            <DialogDescription>
              {memoModal.type === 'academic' ? '학업' :
               memoModal.type === 'physical' ? '실기' :
               memoModal.type === 'general' ? '종합' : '목표'} 메모
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{memoModal.content}</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* 하단 액션 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {consultation.consultation_type === 'learning' ? (
            <>
              <div className="text-sm text-muted-foreground">
                {linkedStudent?.name || consultation.student_name} ({consultation.student_grade}) 재원생 상담
              </div>
              <div className="flex items-center space-x-3">
                <Link href={backUrl}>
                  <Button variant="outline">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    돌아가기
                  </Button>
                </Link>
                <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  상담 기록 저장
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                체크된 항목: {checklist.filter(c => c.checked).length}/{checklist.length}
              </div>
              <div className="flex items-center space-x-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  저장
                </Button>
                <Button
                  variant="outline"
                  className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
                  onClick={() => setPendingModalOpen(true)}
                  disabled={!!consultation?.linked_student_id}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {consultation?.linked_student_id ? '등록 완료' : '미등록관리로 완료'}
                </Button>
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setTrialModalOpen(true)}
                  disabled={!!consultation?.linked_student_id}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {consultation?.linked_student_id ? '이미 체험 등록됨' : '체험 등록'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 체험 등록 모달 */}
      <Dialog open={trialModalOpen} onOpenChange={setTrialModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>체험 학생 등록</DialogTitle>
            <DialogDescription>
              {consultation?.student_name}님의 체험 수업 일정을 선택해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6 px-6 max-h-[60vh] overflow-y-auto">
            {/* 체험 일정 선택 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>체험 일정 ({trialDates.length}회)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTrialDate}>
                  <Plus className="h-4 w-4 mr-1" />
                  추가
                </Button>
              </div>

              {trialDates.map((trialDate, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground w-8">{index + 1}회</span>
                  <Input
                    type="date"
                    value={trialDate.date}
                    onChange={(e) => {
                      const newDates = [...trialDates];
                      newDates[index] = { ...newDates[index], date: e.target.value };
                      setTrialDates(newDates);
                    }}
                    className="flex-1"
                  />
                  <Select
                    value={trialDate.timeSlot}
                    onValueChange={(v) => {
                      const newDates = [...trialDates];
                      newDates[index] = { ...newDates[index], timeSlot: v };
                      setTrialDates(newDates);
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <span>{trialDate.timeSlot || '시간대'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="오전">오전</SelectItem>
                      <SelectItem value="오후">오후</SelectItem>
                      <SelectItem value="저녁">저녁</SelectItem>
                    </SelectContent>
                  </Select>
                  {trialDates.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTrialDate(index)}
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrialModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleConvertToTrial}
              disabled={convertingToTrial}
              className="bg-green-600 hover:bg-green-700"
            >
              {convertingToTrial ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              체험 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 미등록관리 모달 */}
      <Dialog open={pendingModalOpen} onOpenChange={setPendingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>미등록관리로 완료</DialogTitle>
            <DialogDescription>
              {consultation?.student_name}님의 상담을 완료하고 미등록관리 학생으로 등록합니다.
              <br />
              나중에 체험 등록 또는 정식 등록할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6 px-6">
            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea
                placeholder="추가 메모가 있으면 입력하세요..."
                value={pendingMemo}
                onChange={(e) => setPendingMemo(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleConvertToPending}
              disabled={convertingToPending}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {convertingToPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-2" />
              )}
              미등록관리로 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 학생 정보 수정 모달 */}
      <Dialog open={studentEditModalOpen} onOpenChange={setStudentEditModalOpen}>
        <DialogContent className="max-w-md py-6 px-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary-600" />
              학생 정보 수정
            </DialogTitle>
            <DialogDescription>
              상담 학생의 기본 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>학생명</Label>
                <Input
                  value={studentEditForm.student_name}
                  onChange={(e) => setStudentEditForm({ ...studentEditForm, student_name: e.target.value })}
                  placeholder="이름"
                />
              </div>
              <div className="space-y-2">
                <Label>학년</Label>
                <Select
                  value={studentEditForm.student_grade}
                  onValueChange={(v) => setStudentEditForm({ ...studentEditForm, student_grade: v })}
                >
                  <SelectTrigger>
                    <span>{studentEditForm.student_grade || '학년 선택'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="중1">중1</SelectItem>
                    <SelectItem value="중2">중2</SelectItem>
                    <SelectItem value="중3">중3</SelectItem>
                    <SelectItem value="고1">고1</SelectItem>
                    <SelectItem value="고2">고2</SelectItem>
                    <SelectItem value="고3">고3</SelectItem>
                    <SelectItem value="N수생">N수생</SelectItem>
                    <SelectItem value="대학생">대학생</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>성별</Label>
                <Select
                  value={studentEditForm.gender}
                  onValueChange={(v) => setStudentEditForm({ ...studentEditForm, gender: v as 'male' | 'female' })}
                >
                  <SelectTrigger>
                    <span>{studentEditForm.gender === 'male' ? '남' : studentEditForm.gender === 'female' ? '여' : '성별 선택'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">남</SelectItem>
                    <SelectItem value="female">여</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>학교</Label>
                <Input
                  value={studentEditForm.student_school}
                  onChange={(e) => setStudentEditForm({ ...studentEditForm, student_school: e.target.value })}
                  placeholder="학교명"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>학부모 연락처</Label>
              <Input
                value={studentEditForm.parent_phone}
                onChange={(e) => setStudentEditForm({ ...studentEditForm, parent_phone: e.target.value })}
                placeholder="010-0000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label>목표 대학</Label>
              <Input
                value={studentEditForm.target_school}
                onChange={(e) => setStudentEditForm({ ...studentEditForm, target_school: e.target.value })}
                placeholder="목표 대학"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setStudentEditModalOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSaveStudentInfo}
              disabled={savingStudent}
            >
              {savingStudent ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
