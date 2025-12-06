'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, Save, User, Phone, School, Target, Calendar, Clock,
  CheckSquare, Square, ChevronDown, ChevronUp, Loader2, Sparkles
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
import { convertToTrialStudent } from '@/lib/api/consultations';
import type { Consultation, ChecklistItem, ChecklistTemplate } from '@/lib/types/consultation';
import { CONSULTATION_STATUS_LABELS, CONSULTATION_STATUS_COLORS } from '@/lib/types/consultation';

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
    { date: '', timeSlot: '' },
    { date: '', timeSlot: '' }
  ]);
  const [convertingToTrial, setConvertingToTrial] = useState(false);

  // 상담 정보 로드
  useEffect(() => {
    const loadConsultation = async () => {
      try {
        const data = await apiClient.get<Consultation>(`/consultations/${resolvedParams.id}`);
        setConsultation(data);
        setConsultationMemo(data.consultation_memo || '');

        // 체크리스트 설정 로드 또는 기본값 사용
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
      } catch (error) {
        console.error('상담 정보 로드 오류:', error);
        toast.error('상담 정보를 불러오는데 실패했습니다.');
        router.push('/consultations');
      } finally {
        setLoading(false);
      }
    };

    loadConsultation();
  }, [resolvedParams.id, router]);

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

  // 저장
  const handleSave = async () => {
    if (!consultation) return;

    setSaving(true);
    try {
      await apiClient.put(`/consultations/${consultation.id}`, {
        checklist,
        consultationMemo
      });
      toast.success('상담 진행 내용이 저장되었습니다.');
    } catch (error) {
      console.error('저장 오류:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 체험 학생 등록
  const handleConvertToTrial = async () => {
    if (!consultation) return;

    // 검증
    if (!trialDates[0].date || !trialDates[0].timeSlot ||
        !trialDates[1].date || !trialDates[1].timeSlot) {
      toast.error('체험 일정 2개를 모두 선택해주세요.');
      return;
    }

    setConvertingToTrial(true);
    try {
      await convertToTrialStudent(consultation.id, trialDates);
      toast.success('체험 학생으로 등록되었습니다.');
      setTrialModalOpen(false);
      router.push('/consultations');
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || '체험 등록에 실패했습니다.');
    } finally {
      setConvertingToTrial(false);
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
        <p className="text-gray-500">상담 정보를 찾을 수 없습니다.</p>
        <Link href="/consultations">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            목록으로
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/consultations">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  목록으로
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  상담 진행: {consultation.student_name} ({consultation.student_grade})
                </h1>
                <p className="text-sm text-gray-500">
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

          {/* 진행률 */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">진행률</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 왼쪽: 기본 정보 + 메모 */}
          <div className="space-y-6">
            {/* 기본 정보 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center">
                  <User className="h-5 w-5 mr-2 text-primary-600" />
                  기본 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">학생명</span>
                    <p className="font-medium">{consultation.student_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">학년</span>
                    <p className="font-medium">{consultation.student_grade}</p>
                  </div>
                </div>

                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 mr-2 text-gray-400" />
                  <span>{consultation.parent_phone}</span>
                </div>

                {consultation.student_school && (
                  <div className="flex items-center text-sm">
                    <School className="h-4 w-4 mr-2 text-gray-400" />
                    <span>{consultation.student_school}</span>
                  </div>
                )}

                {consultation.target_school && (
                  <div className="flex items-center text-sm">
                    <Target className="h-4 w-4 mr-2 text-gray-400" />
                    <span>목표: {consultation.target_school}</span>
                  </div>
                )}

                {consultation.referral_sources && consultation.referral_sources.length > 0 && (
                  <div className="text-sm">
                    <span className="text-gray-500">알게 된 경로</span>
                    <p className="font-medium">{consultation.referral_sources.join(', ')}</p>
                  </div>
                )}

                {consultation.inquiry_content && (
                  <div className="text-sm">
                    <span className="text-gray-500">문의 내용</span>
                    <p className="text-gray-700 mt-1">{consultation.inquiry_content}</p>
                  </div>
                )}
              </CardContent>
            </Card>

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
                  <div key={category} className="border rounded-lg overflow-hidden">
                    {/* 카테고리 헤더 */}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">{category}</span>
                        <Badge variant="secondary" className="ml-2">
                          {items.filter(i => i.checked).length}/{items.length}
                        </Badge>
                      </div>
                      {expandedCategories[category] ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
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
                                <Square className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                              )}
                              <span className={`ml-3 ${item.checked ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                {item.text}
                              </span>
                            </div>

                            {/* 단일 입력 필드 */}
                            {item.input && (
                              <div className="ml-8">
                                {item.input.type === 'text' ? (
                                  <div className="flex items-center space-x-2">
                                    <Label className="text-sm text-gray-500 min-w-fit">{item.input.label}:</Label>
                                    <Input
                                      value={item.input.value}
                                      onChange={(e) => updateInputValue(item.id, null, e.target.value)}
                                      className="h-8 text-sm max-w-xs"
                                      placeholder={`${item.input.label} 입력`}
                                    />
                                  </div>
                                ) : item.input.type === 'radio' && item.input.options && (
                                  <div className="flex items-center space-x-3">
                                    <Label className="text-sm text-gray-500">{item.input.label}:</Label>
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
                                        <Label className="text-sm text-gray-500 min-w-fit">{inp.label}:</Label>
                                        <Input
                                          value={inp.value}
                                          onChange={(e) => updateInputValue(item.id, idx, e.target.value)}
                                          className="h-8 text-sm max-w-xs"
                                          placeholder={`${inp.label} 입력`}
                                        />
                                      </div>
                                    ) : inp.type === 'radio' && inp.options && (
                                      <div className="flex items-center space-x-3">
                                        <Label className="text-sm text-gray-500">{inp.label}:</Label>
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
      </div>

      {/* 하단 액션 바 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
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
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setTrialModalOpen(true)}
              disabled={!!consultation?.linked_student_id}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {consultation?.linked_student_id ? '이미 체험 등록됨' : '체험 등록'}
            </Button>
          </div>
        </div>
      </div>

      {/* 체험 등록 모달 */}
      <Dialog open={trialModalOpen} onOpenChange={setTrialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>체험 학생 등록</DialogTitle>
            <DialogDescription>
              {consultation?.student_name}님의 체험 수업 일정을 선택해주세요. (2회)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6 px-6">
            {[0, 1].map((index) => (
              <div key={index} className="space-y-2">
                <Label>체험 {index + 1}회차</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={trialDates[index].date}
                    onChange={(e) => {
                      const newDates = [...trialDates];
                      newDates[index] = { ...newDates[index], date: e.target.value };
                      setTrialDates(newDates);
                    }}
                  />
                  <Select
                    value={trialDates[index].timeSlot}
                    onValueChange={(v) => {
                      const newDates = [...trialDates];
                      newDates[index] = { ...newDates[index], timeSlot: v };
                      setTrialDates(newDates);
                    }}
                  >
                    <SelectTrigger>
                      <span>{trialDates[index].timeSlot || '시간대 선택'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">오전</SelectItem>
                      <SelectItem value="afternoon">오후</SelectItem>
                      <SelectItem value="evening">저녁</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
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
    </div>
  );
}
