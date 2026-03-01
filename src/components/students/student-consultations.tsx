'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, ChevronDown, ChevronUp, Loader2, MessageSquare,
  GraduationCap, Target, Sparkles, FileText, Plus, PhoneCall,
  ClipboardList, BookOpen
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import Link from 'next/link';

interface StudentConsultation {
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

interface InitialConsultation {
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
  academic_scores: any;
  target_school: string | null;
  checklist: any;
  referral_sources: any;
  created_at: string;
}

type TimelineItem =
  | { type: 'student'; data: StudentConsultation; date: string }
  | { type: 'initial'; data: InitialConsultation; date: string };

interface Props {
  studentId: number;
  studentName: string;
}

const CONSULTATION_TYPE_LABELS: Record<string, string> = {
  regular: '정기상담',
  admission: '진학상담',
  parent: '학부모상담',
  counseling: '고민상담'
};

const INITIAL_STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  confirmed: '확정',
  completed: '완료',
  cancelled: '취소',
  no_show: '노쇼',
};

export function StudentConsultationsComponent({ studentId, studentName }: Props) {
  const [consultations, setConsultations] = useState<StudentConsultation[]>([]);
  const [initialConsultations, setInitialConsultations] = useState<InitialConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadConsultations();
  }, [studentId]);

  const loadConsultations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{
        consultations: StudentConsultation[];
        initialConsultations?: InitialConsultation[];
      }>(`/student-consultations/${studentId}`);
      setConsultations(response.consultations || []);
      setInitialConsultations(response.initialConsultations || []);
    } catch (error) {
      console.error('상담 기록 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 통합 타임라인: 날짜 내림차순 정렬
  const timeline = useMemo<TimelineItem[]>(() => {
    const studentItems: TimelineItem[] = consultations.map(c => ({
      type: 'student',
      data: c,
      date: c.consultation_date,
    }));
    const initialItems: TimelineItem[] = initialConsultations.map(c => ({
      type: 'initial',
      data: c,
      date: c.preferred_date,
    }));
    return [...studentItems, ...initialItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [consultations, initialConsultations]);

  const toggleExpand = (key: string) => {
    setExpandedId(expandedId === key ? null : key);
  };

  const parseJSON = (jsonStr: string | null | object) => {
    if (!jsonStr) return null;
    if (typeof jsonStr === 'object') return jsonStr;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <span className="ml-2 text-muted-foreground">상담 기록 로딩 중...</span>
        </CardContent>
      </Card>
    );
  }

  if (timeline.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">상담 기록이 없습니다</h3>
          <p className="text-muted-foreground mb-4">
            {studentName} 학생의 상담 기록을 캘린더에서 등록할 수 있습니다.
          </p>
          <Link href="/consultations/calendar">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              상담 등록하기
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const countLabel = initialConsultations.length > 0
    ? `재원 ${consultations.length}건 + 신규 ${initialConsultations.length}건`
    : `${consultations.length}건`;

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          상담 기록 ({countLabel})
        </h3>
        <Link href="/consultations/calendar">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            새 상담 등록
          </Button>
        </Link>
      </div>

      {/* 통합 타임라인 */}
      <div className="space-y-3">
        {timeline.map((item) => {
          if (item.type === 'student') {
            return renderStudentConsultation(item.data, expandedId, toggleExpand, parseJSON);
          } else {
            return renderInitialConsultation(item.data, expandedId, toggleExpand, parseJSON);
          }
        })}
      </div>
    </div>
  );
}

// 재원생 상담 렌더링 (기존 로직)
function renderStudentConsultation(
  consultation: StudentConsultation,
  expandedId: string | null,
  toggleExpand: (key: string) => void,
  parseJSON: (v: string | null | object) => any
) {
  const key = `student-${consultation.id}`;
  const mockTestScores = parseJSON(consultation.mock_test_scores);
  const physicalRecords = parseJSON(consultation.physical_records);
  const isExpanded = expandedId === key;

  return (
    <Card key={key} className="overflow-hidden">
      <button
        onClick={() => toggleExpand(key)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {format(parseISO(consultation.consultation_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            </span>
          </div>
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            {CONSULTATION_TYPE_LABELS[consultation.consultation_type] || consultation.consultation_type}
          </Badge>
          {consultation.admission_type && (
            <Badge variant="outline">
              {consultation.admission_type === 'early' ? '수시' : '정시'}
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <CardContent className="border-t border-border pt-4 space-y-4">
          {/* 학업 정보 */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              학업
            </div>
            <div className="pl-6 space-y-2">
              {consultation.school_grade_avg && (
                <p className="text-sm">
                  <span className="text-muted-foreground">내신 평균:</span>{' '}
                  <span className="font-medium">{consultation.school_grade_avg}등급</span>
                </p>
              )}
              {mockTestScores && (
                <div className="text-sm">
                  <span className="text-muted-foreground">모의고사:</span>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    {Object.entries(mockTestScores).map(([month, scores]: [string, any]) => {
                      const hasScores = scores && Object.values(scores).some((v: any) => v);
                      if (!hasScores) return null;
                      return (
                        <div key={month} className="bg-muted rounded p-2 text-xs">
                          <div className="font-medium mb-1">
                            {month === 'march' ? '3월' : month === 'june' ? '6월' : '9월'}
                          </div>
                          <div className="grid grid-cols-5 gap-1 text-center">
                            {['korean', 'math', 'english', 'exploration1', 'exploration2'].map(subject => (
                              <div key={subject}>
                                <div className="text-muted-foreground text-[10px]">
                                  {subject === 'korean' ? '국' : subject === 'math' ? '수' : subject === 'english' ? '영' : subject === 'exploration1' ? '탐1' : '탐2'}
                                </div>
                                <div>{scores[subject] || '-'}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {consultation.academic_memo && (
                <p className="text-sm text-muted-foreground">{consultation.academic_memo}</p>
              )}
            </div>
          </div>

          {/* 실기 정보 */}
          {physicalRecords && Object.keys(physicalRecords).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-orange-600" />
                실기 ({consultation.physical_record_type === 'latest' ? '최근 기록' : '평균 기록'})
              </div>
              <div className="pl-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(physicalRecords).map(([name, record]: [string, any]) => (
                    <div key={name} className="bg-muted rounded p-2 text-center text-sm">
                      <div className="text-xs text-muted-foreground">{name}</div>
                      <div className="font-medium">
                        {record.value} {record.unit}
                      </div>
                    </div>
                  ))}
                </div>
                {consultation.physical_memo && (
                  <p className="text-sm text-muted-foreground mt-2">{consultation.physical_memo}</p>
                )}
              </div>
            </div>
          )}

          {/* 목표 정보 */}
          {(consultation.target_university_1 || consultation.target_university_2 || consultation.target_memo) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target className="h-4 w-4 text-purple-600" />
                목표
              </div>
              <div className="pl-6 space-y-1">
                {consultation.target_university_1 && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">목표 1:</span>{' '}
                    <span className="font-medium">{consultation.target_university_1}</span>
                  </p>
                )}
                {consultation.target_university_2 && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">목표 2:</span>{' '}
                    <span className="font-medium">{consultation.target_university_2}</span>
                  </p>
                )}
                {consultation.target_memo && (
                  <p className="text-sm text-muted-foreground">{consultation.target_memo}</p>
                )}
              </div>
            </div>
          )}

          {/* 기타 메모 */}
          {consultation.general_memo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-green-600" />
                종합 메모
              </div>
              <div className="pl-6">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {consultation.general_memo}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// 신규상담 렌더링
function renderInitialConsultation(
  consultation: InitialConsultation,
  expandedId: string | null,
  toggleExpand: (key: string) => void,
  parseJSON: (v: string | null | object) => any
) {
  const key = `initial-${consultation.id}`;
  const isExpanded = expandedId === key;
  const academicScores = parseJSON(consultation.academic_scores);
  const checklist = parseJSON(consultation.checklist);

  return (
    <Card key={key} className="overflow-hidden">
      <button
        onClick={() => toggleExpand(key)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {format(parseISO(consultation.preferred_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
            </span>
            {consultation.preferred_time && (
              <span className="text-sm text-muted-foreground">
                {consultation.preferred_time.slice(0, 5)}
              </span>
            )}
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            신규상담
          </Badge>
          <Badge variant="outline" className={
            consultation.status === 'completed' ? 'border-green-300 text-green-700' :
            consultation.status === 'confirmed' ? 'border-blue-300 text-blue-700' :
            consultation.status === 'cancelled' || consultation.status === 'no_show' ? 'border-red-300 text-red-700' :
            ''
          }>
            {INITIAL_STATUS_LABELS[consultation.status] || consultation.status}
          </Badge>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <CardContent className="border-t border-border pt-4 space-y-4">
          {/* 문의 내용 */}
          {consultation.inquiry_content && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageSquare className="h-4 w-4 text-blue-600" />
                문의 내용
              </div>
              <div className="pl-6">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {consultation.inquiry_content}
                </p>
              </div>
            </div>
          )}

          {/* 상담 메모 */}
          {consultation.consultation_memo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="h-4 w-4 text-green-600" />
                상담 메모
              </div>
              <div className="pl-6">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {consultation.consultation_memo}
                </p>
              </div>
            </div>
          )}

          {/* 관리자 메모 */}
          {consultation.admin_notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-amber-600" />
                관리자 메모
              </div>
              <div className="pl-6">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {consultation.admin_notes}
                </p>
              </div>
            </div>
          )}

          {/* 목표 학교 */}
          {consultation.target_school && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target className="h-4 w-4 text-purple-600" />
                목표 학교
              </div>
              <div className="pl-6">
                <p className="text-sm font-medium">{consultation.target_school}</p>
              </div>
            </div>
          )}

          {/* 학업 성적 */}
          {academicScores && Object.keys(academicScores).length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <BookOpen className="h-4 w-4 text-indigo-600" />
                학업 성적
              </div>
              <div className="pl-6 space-y-2">
                <div className="flex flex-wrap gap-2">
                  {academicScores.admissionType && (
                    <Badge variant="outline">
                      {academicScores.admissionType === 'early' ? '수시' : academicScores.admissionType === 'regular' ? '정시' : academicScores.admissionType}
                    </Badge>
                  )}
                  {academicScores.schoolGradeAvg && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">내신 평균:</span>{' '}
                      <span className="font-medium">{academicScores.schoolGradeAvg}등급</span>
                    </p>
                  )}
                </div>
                {academicScores.mockTestGrades && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { key: 'korean', label: '국어' },
                      { key: 'math', label: '수학' },
                      { key: 'english', label: '영어' },
                      { key: 'exploration', label: '탐구' },
                    ].map(({ key, label }) => (
                      academicScores.mockTestGrades[key] != null && (
                        <div key={key} className="bg-muted rounded p-2 text-center text-sm">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="font-medium">{academicScores.mockTestGrades[key]}등급</div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 체크리스트 */}
          {checklist && Array.isArray(checklist) && checklist.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-teal-600" />
                체크리스트
              </div>
              <div className="pl-6">
                <ul className="text-sm text-muted-foreground space-y-1">
                  {checklist.map((item: any, idx: number) => {
                    const label = item.text || item.label || (typeof item === 'string' ? item : '');
                    const inputVal = item.input?.value || '';
                    return (
                      <li key={idx} className="flex items-center gap-2">
                        <span>{item.checked ? '✅' : '⬜'}</span>
                        <span>
                          {label}
                          {inputVal && <span className="ml-1 text-foreground font-medium">({inputVal})</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* 신청자 정보 */}
          {(consultation.student_name || consultation.student_grade) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <PhoneCall className="h-4 w-4 text-gray-600" />
                신청자 정보
              </div>
              <div className="pl-6 space-y-1">
                {consultation.student_name && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">이름:</span>{' '}
                    <span className="font-medium">{consultation.student_name}</span>
                  </p>
                )}
                {consultation.student_grade && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">학년:</span>{' '}
                    <span className="font-medium">{consultation.student_grade}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
