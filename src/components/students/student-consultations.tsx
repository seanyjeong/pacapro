'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar, ChevronDown, ChevronUp, Loader2, MessageSquare,
  GraduationCap, Target, Sparkles, FileText, Plus
} from 'lucide-react';
import apiClient from '@/lib/api/client';
import Link from 'next/link';

interface StudentConsultation {
  id: number;
  student_id: number;
  consultation_date: string;
  consultation_type: string; // regular, admission, parent, counseling
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

export function StudentConsultationsComponent({ studentId, studentName }: Props) {
  const [consultations, setConsultations] = useState<StudentConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadConsultations();
  }, [studentId]);

  const loadConsultations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ consultations: StudentConsultation[] }>(
        `/student-consultations/${studentId}`
      );
      setConsultations(response.consultations || []);
    } catch (error) {
      console.error('상담 기록 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const parseJSON = (jsonStr: string | null) => {
    if (!jsonStr) return null;
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

  if (consultations.length === 0) {
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

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          상담 기록 ({consultations.length}건)
        </h3>
        <Link href="/consultations/calendar">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            새 상담 등록
          </Button>
        </Link>
      </div>

      {/* 상담 목록 */}
      <div className="space-y-3">
        {consultations.map((consultation) => {
          const mockTestScores = parseJSON(consultation.mock_test_scores);
          const physicalRecords = parseJSON(consultation.physical_records);
          const isExpanded = expandedId === consultation.id;

          return (
            <Card key={consultation.id} className="overflow-hidden">
              {/* 상담 헤더 */}
              <button
                onClick={() => toggleExpand(consultation.id)}
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

              {/* 상담 상세 내용 */}
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
        })}
      </div>
    </div>
  );
}
