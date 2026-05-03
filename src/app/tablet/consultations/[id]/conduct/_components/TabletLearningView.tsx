'use client';

// tablet/consultations/[id]/conduct/_components/TabletLearningView.tsx — 재원생 상담 UI (ADR-018)

import { format } from 'date-fns';
import {
  ChevronDown, ChevronUp, Loader2, Sparkles,
  GraduationCap, Target, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { LearningForm, PeakRecord } from '../_types';

interface TabletLearningViewProps {
  learningForm: LearningForm;
  setLearningForm: React.Dispatch<React.SetStateAction<LearningForm>>;
  expandedSections: Record<string, boolean>;
  toggleSection: (section: string) => void;
  peakRecords: Record<string, PeakRecord>;
  peakLoading: boolean;
  linkedStudentId: number | undefined;
  loadPeakRecords: (studentId: number, type: 'latest' | 'average') => void;
}

export function TabletLearningView({
  learningForm,
  setLearningForm,
  expandedSections,
  toggleSection,
  peakRecords,
  peakLoading,
  linkedStudentId,
  loadPeakRecords,
}: TabletLearningViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 학업 섹션 */}
      <Card>
        <CardHeader className="pb-3">
          <button onClick={() => toggleSection('학업')} className="w-full flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <GraduationCap className="h-5 w-5 mr-2 text-blue-600" />
              학업
            </CardTitle>
            {expandedSections['학업'] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </CardHeader>
        {expandedSections['학업'] && (
          <CardContent className="space-y-4">
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
                                      [subject]: e.target.value,
                                    },
                                  },
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

      {/* 실기 섹션 */}
      <Card>
        <CardHeader className="pb-3">
          <button onClick={() => toggleSection('실기')} className="w-full flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-orange-600" />
              실기 (P-EAK)
            </CardTitle>
            {expandedSections['실기'] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </CardHeader>
        {expandedSections['실기'] && (
          <CardContent className="space-y-4">
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
                      if (linkedStudentId) loadPeakRecords(linkedStudentId, 'latest');
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
                      if (linkedStudentId) loadPeakRecords(linkedStudentId, 'average');
                    }}
                  />
                  <span className="text-sm">평균 기록</span>
                </label>
              </div>
            </div>

            {peakLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

      {/* 목표 섹션 */}
      <Card>
        <CardHeader className="pb-3">
          <button onClick={() => toggleSection('목표')} className="w-full flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Target className="h-5 w-5 mr-2 text-purple-600" />
              목표
            </CardTitle>
            {expandedSections['목표'] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </CardHeader>
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

      {/* 기타 섹션 */}
      <Card>
        <CardHeader className="pb-3">
          <button onClick={() => toggleSection('기타')} className="w-full flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-green-600" />
              기타
            </CardTitle>
            {expandedSections['기타'] ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </CardHeader>
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
  );
}
