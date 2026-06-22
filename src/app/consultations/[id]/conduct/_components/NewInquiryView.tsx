'use client';

import { ChevronDown, ChevronUp, User, Phone, School, Target, CheckSquare, Square, GraduationCap, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { Consultation, ChecklistItem } from '@/lib/types/consultation';

interface NewInquiryViewProps {
  consultation: Consultation;
  consultationMemo: string;
  setConsultationMemo: (v: string) => void;
  groupedChecklist: Record<string, ChecklistItem[]>;
  expandedCategories: Record<string, boolean>;
  toggleCategory: (category: string) => void;
  toggleCheck: (itemId: number) => void;
  updateInputValue: (itemId: number, inputIndex: number | null, value: string) => void;
  onOpenStudentEdit: () => void;
}

export function NewInquiryView({
  consultation, consultationMemo, setConsultationMemo,
  groupedChecklist, expandedCategories, toggleCategory,
  toggleCheck, updateInputValue, onOpenStudentEdit,
}: NewInquiryViewProps) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.9fr_1.8fr]">
      {/* 왼쪽: 기본 정보 + 메모 */}
      <div className="space-y-5">
        {/* 기본 정보 */}
        <Card className="rounded-md shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <User className="h-5 w-5 mr-2 text-primary-600" />
                기본 정보
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={onOpenStudentEdit} className="h-8 px-2">
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
            <Card className="rounded-md shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <GraduationCap className="h-5 w-5 mr-2 text-primary-600" />
                  성적 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-semibold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {admissionTypeLabel}
                      </span>
                    </div>
                  )}
                </div>

                {hasMockGrades && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">모의고사</p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {['korean', 'math', 'english', 'exploration'].map((subject) => {
                        const labels: Record<string, string> = { korean: '국', math: '수', english: '영', exploration: '탐' };
                        const value = scores.mockTestGrades?.[subject as keyof typeof scores.mockTestGrades];
                        return (
                          <div key={subject} className="rounded-md bg-muted p-2 text-center">
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
        <Card className="rounded-md shadow-none">
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
        <Card className="rounded-md shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center">
              <CheckSquare className="h-5 w-5 mr-2 text-primary-600" />
              상담 체크리스트
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(groupedChecklist).map(([category, items]) => (
              <div key={category} className="overflow-hidden rounded-md border border-border">
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

                {expandedCategories[category] && (
                  <div className="divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="px-4 py-3 space-y-2">
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
  );
}
