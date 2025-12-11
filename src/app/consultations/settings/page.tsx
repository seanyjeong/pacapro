'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, Save, Link2, Clock, Calendar, Plus, Trash2,
  ExternalLink, Copy, Check, Loader2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import Link from 'next/link';

import {
  getConsultationSettings,
  updateConsultationSettings,
  updateWeeklyHours,
  addBlockedSlot,
  removeBlockedSlot,
  checkSlugAvailability
} from '@/lib/api/consultations';
import type { WeeklyHour, BlockedSlot, ConsultationSettings, ChecklistTemplate } from '@/lib/types/consultation';
import { DAY_LABELS } from '@/lib/types/consultation';

// 기본 체크리스트 템플릿 (체대입시 특화)
const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplate[] = [
  { id: 1, category: '학생 배경', text: '타학원 경험 확인', input: { type: 'text', label: '학원명' } },
  { id: 2, category: '학생 배경', text: '운동 경력 확인', inputs: [
    { type: 'radio', label: '과거 선수 경험', options: ['있음', '없음'] },
    { type: 'text', label: '종목' }
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

export default function ConsultationSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 학원 정보
  const [academyName, setAcademyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // 설정
  const [settings, setSettings] = useState<Partial<ConsultationSettings>>({
    isEnabled: true,
    pageTitle: '상담 예약',
    pageDescription: '',
    slotDuration: 30,
    maxReservationsPerSlot: 1,
    advanceDays: 30,
    referralSources: ['블로그/인터넷 검색', '지인 소개', '현수막/전단지', 'SNS', '기타'],
    sendConfirmationAlimtalk: true
  });

  // 운영 시간
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHour[]>([]);

  // 차단된 날짜
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);

  // 새 차단 날짜 모달
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');
  const [addingBlock, setAddingBlock] = useState(false);

  // 알게 된 경로 수정
  const [newReferralSource, setNewReferralSource] = useState('');

  // 체크리스트 템플릿
  const [checklistTemplate, setChecklistTemplate] = useState<ChecklistTemplate[]>(DEFAULT_CHECKLIST_TEMPLATE);
  const [newChecklistItem, setNewChecklistItem] = useState({
    category: '',
    text: '',
    inputType: 'none' as 'none' | 'text' | 'radio',
    inputLabel: '',
    radioOptions: ''
  });
  const [addChecklistModalOpen, setAddChecklistModalOpen] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);

  // 복사 완료 상태
  const [copied, setCopied] = useState(false);

  // 기본 운영 시간 설정
  const [defaultStartTime, setDefaultStartTime] = useState('09:00:00');
  const [defaultEndTime, setDefaultEndTime] = useState('18:00:00');

  // 데이터 로드
  useEffect(() => {
    async function loadData() {
      try {
        const response = await getConsultationSettings();
        setAcademyName(response.academy?.name || '');
        setSlug(response.academy?.slug || '');
        setSettings(response.settings || {});
        setWeeklyHours(response.weeklyHours || []);
        setBlockedSlots(response.blockedSlots || []);

        // 체크리스트 템플릿 로드 (설정에 저장된 것이 있으면 사용)
        const savedTemplate = (response.settings as { checklist_template?: ChecklistTemplate[] })?.checklist_template;
        if (savedTemplate && savedTemplate.length > 0) {
          setChecklistTemplate(savedTemplate);
        }
      } catch (error) {
        console.error('설정 로드 오류:', error);
        toast.error('설정을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // slug 중복 확인
  const checkSlug = async () => {
    if (!slug || slug.length < 3) {
      toast.error('3자 이상 입력해주세요.');
      return;
    }

    setCheckingSlug(true);
    try {
      const result = await checkSlugAvailability(slug);
      setSlugAvailable(result.available);
      if (!result.available) {
        toast.error(result.message || '이미 사용 중인 주소입니다.');
      } else {
        toast.success('사용 가능한 주소입니다.');
      }
    } catch (error) {
      toast.error('확인에 실패했습니다.');
    } finally {
      setCheckingSlug(false);
    }
  };

  // 설정 저장
  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await updateConsultationSettings({
        slug,
        ...settings
      });
      toast.success('설정이 저장되었습니다.');
    } catch (error) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 운영 시간 저장
  const handleSaveWeeklyHours = async () => {
    setSaving(true);
    try {
      await updateWeeklyHours(weeklyHours);
      toast.success('운영 시간이 저장되었습니다.');
    } catch (error) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 차단 날짜 추가
  const handleAddBlockedSlot = async () => {
    if (!newBlockedDate) {
      toast.error('날짜를 선택해주세요.');
      return;
    }

    setAddingBlock(true);
    try {
      const result = await addBlockedSlot({
        blockedDate: newBlockedDate,
        isAllDay: true,
        reason: newBlockReason
      });

      setBlockedSlots([
        ...blockedSlots,
        {
          id: result.id,
          blocked_date: newBlockedDate,
          is_all_day: true,
          reason: newBlockReason,
          created_at: new Date().toISOString()
        }
      ]);

      setBlockModalOpen(false);
      setNewBlockedDate('');
      setNewBlockReason('');
      toast.success('날짜가 차단되었습니다.');
    } catch (error) {
      toast.error('차단에 실패했습니다.');
    } finally {
      setAddingBlock(false);
    }
  };

  // 차단 날짜 삭제
  const handleRemoveBlockedSlot = async (id: number) => {
    try {
      await removeBlockedSlot(id);
      setBlockedSlots(blockedSlots.filter(b => b.id !== id));
      toast.success('차단이 해제되었습니다.');
    } catch (error) {
      toast.error('해제에 실패했습니다.');
    }
  };

  // 한국 공휴일 (연도별)
  // 양력 공휴일은 고정, 음력 명절(설날/추석/부처님오신날)은 연도별 계산 필요
  const getKoreanHolidays = (year: number) => {
    // 양력 고정 공휴일
    const fixedHolidays = [
      { date: `${year}-01-01`, name: '신정' },
      { date: `${year}-03-01`, name: '삼일절' },
      { date: `${year}-05-05`, name: '어린이날' },
      { date: `${year}-06-06`, name: '현충일' },
      { date: `${year}-08-15`, name: '광복절' },
      { date: `${year}-10-03`, name: '개천절' },
      { date: `${year}-10-09`, name: '한글날' },
      { date: `${year}-12-25`, name: '크리스마스' },
    ];

    // 음력 명절 (매년 다름, 2025-2030년 미리 계산)
    const lunarHolidays: Record<number, { date: string; name: string }[]> = {
      2025: [
        { date: '2025-01-28', name: '설날 연휴' },
        { date: '2025-01-29', name: '설날' },
        { date: '2025-01-30', name: '설날 연휴' },
        { date: '2025-05-05', name: '부처님오신날' },
        { date: '2025-10-05', name: '추석 연휴' },
        { date: '2025-10-06', name: '추석' },
        { date: '2025-10-07', name: '추석 연휴' },
      ],
      2026: [
        { date: '2026-02-16', name: '설날 연휴' },
        { date: '2026-02-17', name: '설날' },
        { date: '2026-02-18', name: '설날 연휴' },
        { date: '2026-05-24', name: '부처님오신날' },
        { date: '2026-09-24', name: '추석 연휴' },
        { date: '2026-09-25', name: '추석' },
        { date: '2026-09-26', name: '추석 연휴' },
      ],
      2027: [
        { date: '2027-02-05', name: '설날 연휴' },
        { date: '2027-02-06', name: '설날' },
        { date: '2027-02-07', name: '설날 연휴' },
        { date: '2027-05-13', name: '부처님오신날' },
        { date: '2027-09-14', name: '추석 연휴' },
        { date: '2027-09-15', name: '추석' },
        { date: '2027-09-16', name: '추석 연휴' },
      ],
      2028: [
        { date: '2028-01-25', name: '설날 연휴' },
        { date: '2028-01-26', name: '설날' },
        { date: '2028-01-27', name: '설날 연휴' },
        { date: '2028-05-02', name: '부처님오신날' },
        { date: '2028-10-02', name: '추석 연휴' },
        { date: '2028-10-03', name: '추석' },
        { date: '2028-10-04', name: '추석 연휴' },
      ],
      2029: [
        { date: '2029-02-12', name: '설날 연휴' },
        { date: '2029-02-13', name: '설날' },
        { date: '2029-02-14', name: '설날 연휴' },
        { date: '2029-05-20', name: '부처님오신날' },
        { date: '2029-09-21', name: '추석 연휴' },
        { date: '2029-09-22', name: '추석' },
        { date: '2029-09-23', name: '추석 연휴' },
      ],
      2030: [
        { date: '2030-02-02', name: '설날 연휴' },
        { date: '2030-02-03', name: '설날' },
        { date: '2030-02-04', name: '설날 연휴' },
        { date: '2030-05-09', name: '부처님오신날' },
        { date: '2030-09-11', name: '추석 연휴' },
        { date: '2030-09-12', name: '추석' },
        { date: '2030-09-13', name: '추석 연휴' },
      ],
    };

    const lunar = lunarHolidays[year] || [];

    // 중복 제거 (어린이날과 부처님오신날이 같은 날인 경우 등)
    const allHolidays = [...fixedHolidays, ...lunar];
    const uniqueHolidays = allHolidays.filter((h, idx, arr) =>
      arr.findIndex(x => x.date === h.date) === idx
    );

    return uniqueHolidays.sort((a, b) => a.date.localeCompare(b.date));
  };

  const currentYear = new Date().getFullYear();

  // 공휴일 모두 차단
  const [addingHolidays, setAddingHolidays] = useState(false);

  const handleAddAllHolidays = async () => {
    const today = new Date();
    const holidays = getKoreanHolidays(currentYear);
    const futureHolidays = holidays.filter(h => new Date(h.date) >= today);

    if (futureHolidays.length === 0) {
      toast.error('추가할 공휴일이 없습니다.');
      return;
    }

    // 이미 차단된 날짜 제외
    const existingDates = blockedSlots.map(s => s.blocked_date.substring(0, 10));
    const newHolidays = futureHolidays.filter(h => !existingDates.includes(h.date));

    if (newHolidays.length === 0) {
      toast.info('모든 공휴일이 이미 차단되어 있습니다.');
      return;
    }

    setAddingHolidays(true);
    try {
      for (const holiday of newHolidays) {
        const result = await addBlockedSlot({
          blockedDate: holiday.date,
          reason: holiday.name
        });
        // API는 id만 반환하므로 BlockedSlot 객체를 직접 구성
        const newSlot: BlockedSlot = {
          id: result.id,
          blocked_date: holiday.date,
          is_all_day: true,
          reason: holiday.name,
          created_at: new Date().toISOString()
        };
        setBlockedSlots(prev => [...prev, newSlot]);
      }
      toast.success(`${newHolidays.length}개 공휴일이 차단되었습니다.`);
    } catch (error) {
      toast.error('공휴일 추가 중 오류가 발생했습니다.');
    } finally {
      setAddingHolidays(false);
    }
  };

  // 운영 시간 업데이트
  const updateHour = (dayOfWeek: number, field: keyof WeeklyHour, value: unknown) => {
    setWeeklyHours(weeklyHours.map(h =>
      h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h
    ));
  };

  // 기본 시간을 전체 요일에 적용
  const applyDefaultTimeToAll = () => {
    setWeeklyHours(weeklyHours.map(h => ({
      ...h,
      isAvailable: true,
      startTime: defaultStartTime,
      endTime: defaultEndTime
    })));
    toast.success('모든 요일에 적용되었습니다.');
  };

  // 평일(월~금)에만 적용
  const applyDefaultTimeToWeekdays = () => {
    setWeeklyHours(weeklyHours.map(h => ({
      ...h,
      isAvailable: h.dayOfWeek >= 1 && h.dayOfWeek <= 5, // 월~금만 활성화
      startTime: defaultStartTime,
      endTime: defaultEndTime
    })));
    toast.success('평일(월~금)에 적용되었습니다.');
  };

  // 알게 된 경로 추가
  const addReferralSource = () => {
    if (!newReferralSource.trim()) return;
    if (settings.referralSources?.includes(newReferralSource.trim())) {
      toast.error('이미 존재하는 항목입니다.');
      return;
    }
    setSettings({
      ...settings,
      referralSources: [...(settings.referralSources || []), newReferralSource.trim()]
    });
    setNewReferralSource('');
  };

  // 알게 된 경로 삭제
  const removeReferralSource = (source: string) => {
    setSettings({
      ...settings,
      referralSources: settings.referralSources?.filter(s => s !== source)
    });
  };

  // 체크리스트 항목 추가
  const addChecklistItem = () => {
    if (!newChecklistItem.category.trim() || !newChecklistItem.text.trim()) {
      toast.error('카테고리와 항목명을 입력해주세요.');
      return;
    }

    const newId = Math.max(0, ...checklistTemplate.map(c => c.id)) + 1;
    const newItem: ChecklistTemplate = {
      id: newId,
      category: newChecklistItem.category.trim(),
      text: newChecklistItem.text.trim()
    };

    if (newChecklistItem.inputType === 'text' && newChecklistItem.inputLabel.trim()) {
      newItem.input = { type: 'text', label: newChecklistItem.inputLabel.trim() };
    } else if (newChecklistItem.inputType === 'radio' && newChecklistItem.inputLabel.trim() && newChecklistItem.radioOptions.trim()) {
      newItem.input = {
        type: 'radio',
        label: newChecklistItem.inputLabel.trim(),
        options: newChecklistItem.radioOptions.split(',').map(o => o.trim()).filter(o => o)
      };
    }

    setChecklistTemplate([...checklistTemplate, newItem]);
    setNewChecklistItem({ category: '', text: '', inputType: 'none', inputLabel: '', radioOptions: '' });
    setAddChecklistModalOpen(false);
    toast.success('항목이 추가되었습니다.');
  };

  // 체크리스트 항목 삭제
  const removeChecklistItem = (id: number) => {
    setChecklistTemplate(checklistTemplate.filter(c => c.id !== id));
  };

  // 체크리스트 저장
  const saveChecklist = async () => {
    setSavingChecklist(true);
    try {
      await updateConsultationSettings({
        ...settings,
        checklist_template: checklistTemplate
      } as Partial<ConsultationSettings> & { checklist_template: ChecklistTemplate[] });
      toast.success('체크리스트가 저장되었습니다.');
    } catch (error) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setSavingChecklist(false);
    }
  };

  // 기본 체크리스트로 초기화
  const resetToDefaultChecklist = () => {
    setChecklistTemplate(DEFAULT_CHECKLIST_TEMPLATE);
    toast.success('기본 체크리스트로 초기화되었습니다.');
  };

  // 체크리스트 카테고리 목록
  const checklistCategories = [...new Set(checklistTemplate.map(c => c.category))];

  // 링크 복사
  const copyLink = () => {
    const url = `${window.location.origin}/c/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('링크가 복사되었습니다.');
  };

  // 시간 옵션 생성
  const timeOptions: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`);
    }
  }
  timeOptions.push('24:00:00');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/consultations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">상담 예약 설정</h1>
            <p className="text-muted-foreground">{academyName}</p>
          </div>
        </div>
      </div>

      {/* 상담 페이지 링크 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            상담 예약 링크
          </CardTitle>
          <CardDescription>
            학부모에게 공유할 상담 예약 페이지 링크입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={settings.isEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, isEnabled: checked })}
            />
            <Label>상담 예약 활성화</Label>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label>페이지 주소 (slug)</Label>
              <div className="flex gap-2 mt-1">
                <div className="flex items-center bg-muted px-3 rounded-l-md border border-r-0 border-border text-muted-foreground text-sm">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/c/
                </div>
                <Input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    setSlugAvailable(null);
                  }}
                  placeholder="my-academy"
                  className="rounded-l-none flex-1"
                />
                <Button variant="outline" onClick={checkSlug} disabled={checkingSlug}>
                  {checkingSlug ? <Loader2 className="h-4 w-4 animate-spin" /> : '중복 확인'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                영문 소문자, 숫자, 하이픈(-)만 사용 가능
              </p>
            </div>
          </div>

          {slug && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <span className="text-sm text-blue-800 dark:text-blue-200 flex-1">
                {typeof window !== 'undefined' ? `${window.location.origin}/c/${slug}` : ''}
              </span>
              <Button variant="outline" size="sm" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Link href={`/c/${slug}`} target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 페이지 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>페이지 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>페이지 제목</Label>
            <Input
              value={settings.pageTitle || ''}
              onChange={(e) => setSettings({ ...settings, pageTitle: e.target.value })}
              placeholder="상담 예약"
            />
          </div>
          <div>
            <Label>안내 문구</Label>
            <Textarea
              value={settings.pageDescription || ''}
              onChange={(e) => setSettings({ ...settings, pageDescription: e.target.value })}
              placeholder="상담 예약 페이지 상단에 표시될 안내 문구를 입력하세요."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>상담 시간 (분)</Label>
              <Select
                value={settings.slotDuration?.toString() || '30'}
                onValueChange={(v) => setSettings({ ...settings, slotDuration: parseInt(v) })}
              >
                <SelectTrigger>
                  <span>
                    {settings.slotDuration === 30 ? '30분' : settings.slotDuration === 60 ? '1시간' : settings.slotDuration === 90 ? '1시간 30분' : '30분'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30분</SelectItem>
                  <SelectItem value="60">1시간</SelectItem>
                  <SelectItem value="90">1시간 30분</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>슬롯당 최대 예약</Label>
              <Select
                value={settings.maxReservationsPerSlot?.toString() || '1'}
                onValueChange={(v) => setSettings({ ...settings, maxReservationsPerSlot: parseInt(v) })}
              >
                <SelectTrigger>
                  <span>{settings.maxReservationsPerSlot || 1}명</span>
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n}명</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>예약 가능 기간</Label>
              <Select
                value={settings.advanceDays?.toString() || '30'}
                onValueChange={(v) => setSettings({ ...settings, advanceDays: parseInt(v) })}
              >
                <SelectTrigger>
                  <span>
                    {settings.advanceDays === 7 ? '1주' : settings.advanceDays === 14 ? '2주' : settings.advanceDays === 30 ? '1개월' : settings.advanceDays === 60 ? '2개월' : '1개월'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">1주</SelectItem>
                  <SelectItem value="14">2주</SelectItem>
                  <SelectItem value="30">1개월</SelectItem>
                  <SelectItem value="60">2개월</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            설정 저장
          </Button>
        </CardContent>
      </Card>

      {/* 운영 시간 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            요일별 운영 시간
          </CardTitle>
          <CardDescription>
            상담 가능한 요일과 시간을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 기본 시간 일괄 설정 */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-3">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">기본 시간 일괄 설정</p>
            <div className="flex items-center gap-3 flex-wrap">
              <Select
                value={defaultStartTime}
                onValueChange={setDefaultStartTime}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.slice(0, -1).map(t => (
                    <SelectItem key={t} value={t}>{t.substring(0, 5)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>~</span>
              <Select
                value={defaultEndTime}
                onValueChange={setDefaultEndTime}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.slice(1).map(t => (
                    <SelectItem key={t} value={t}>{t === '24:00:00' ? '24:00' : t.substring(0, 5)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="secondary" size="sm" onClick={applyDefaultTimeToAll}>
                전체 적용
              </Button>
              <Button variant="outline" size="sm" onClick={applyDefaultTimeToWeekdays}>
                평일만 적용
              </Button>
            </div>
          </div>

          {/* 개별 요일 설정 */}
          {weeklyHours.map((hour) => (
            <div key={hour.dayOfWeek} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
              <div className="w-12 text-center font-medium">
                {DAY_LABELS[hour.dayOfWeek]}
              </div>
              <Switch
                checked={hour.isAvailable}
                onCheckedChange={(checked) => updateHour(hour.dayOfWeek, 'isAvailable', checked)}
              />
              {hour.isAvailable ? (
                <>
                  <Select
                    value={hour.startTime || '09:00:00'}
                    onValueChange={(v) => updateHour(hour.dayOfWeek, 'startTime', v)}
                  >
                    <SelectTrigger className="w-28">
                      <span>{(hour.startTime || '09:00:00').substring(0, 5)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.slice(0, -1).map(t => (
                        <SelectItem key={t} value={t}>{t.substring(0, 5)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span>~</span>
                  <Select
                    value={hour.endTime || '18:00:00'}
                    onValueChange={(v) => updateHour(hour.dayOfWeek, 'endTime', v)}
                  >
                    <SelectTrigger className="w-28">
                      <span>{(hour.endTime || '18:00:00') === '24:00:00' ? '24:00' : (hour.endTime || '18:00:00').substring(0, 5)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.slice(1).map(t => (
                        <SelectItem key={t} value={t}>{t === '24:00:00' ? '24:00' : t.substring(0, 5)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <span className="text-muted-foreground">휴무</span>
              )}
            </div>
          ))}

          <Button onClick={handleSaveWeeklyHours} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            운영 시간 저장
          </Button>
        </CardContent>
      </Card>

      {/* 차단된 날짜 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            차단된 날짜
          </CardTitle>
          <CardDescription>
            특정 날짜에 상담 예약을 받지 않습니다. (공휴일, 행사 등)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setBlockModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              날짜 추가
            </Button>
            <Button
              variant="outline"
              onClick={handleAddAllHolidays}
              disabled={addingHolidays}
            >
              {addingHolidays ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              공휴일 차단
            </Button>
          </div>

          {blockedSlots.length > 0 && (
            <div className="space-y-2">
              {blockedSlots.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <span className="font-medium">
                      {format(parseISO(slot.blocked_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                    </span>
                    {slot.reason && (
                      <span className="text-sm text-gray-500 ml-2">- {slot.reason}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleRemoveBlockedSlot(slot.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 알게 된 경로 */}
      <Card>
        <CardHeader>
          <CardTitle>알게 된 경로 옵션</CardTitle>
          <CardDescription>
            상담 신청 시 선택할 수 있는 "학원을 알게 된 경로" 옵션입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.referralSources?.map((source) => (
              <Badge key={source} variant="secondary" className="gap-1 py-1.5 px-3">
                {source}
                <button
                  onClick={() => removeReferralSource(source)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newReferralSource}
              onChange={(e) => setNewReferralSource(e.target.value)}
              placeholder="새 항목 추가"
              onKeyPress={(e) => e.key === 'Enter' && addReferralSource()}
            />
            <Button variant="outline" onClick={addReferralSource}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            저장
          </Button>
        </CardContent>
      </Card>

      {/* 상담 체크리스트 템플릿 */}
      <Card>
        <CardHeader>
          <CardTitle>상담 체크리스트 템플릿</CardTitle>
          <CardDescription>
            상담 진행 시 체크할 항목들을 관리합니다. 상담 진행 페이지에서 사용됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 카테고리별 체크리스트 표시 */}
          {checklistCategories.map((category) => (
            <div key={category} className="border border-border rounded-lg p-4">
              <h4 className="font-medium text-foreground mb-3">{category}</h4>
              <div className="space-y-2">
                {checklistTemplate
                  .filter(item => item.category === category)
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex-1">
                        <span className="text-sm">{item.text}</span>
                        {item.input && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({item.input.type === 'text' ? '텍스트 입력' : `선택: ${item.input.options?.join(', ')}`})
                          </span>
                        )}
                        {item.inputs && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (다중 입력)
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => removeChecklistItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {/* 버튼들 */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddChecklistModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              항목 추가
            </Button>
            <Button variant="outline" onClick={resetToDefaultChecklist}>
              기본값으로 초기화
            </Button>
            <Button onClick={saveChecklist} disabled={savingChecklist}>
              {savingChecklist ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 체크리스트 항목 추가 모달 */}
      <Dialog open={addChecklistModalOpen} onOpenChange={setAddChecklistModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>체크리스트 항목 추가</DialogTitle>
            <DialogDescription>
              상담 진행 시 체크할 새 항목을 추가합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6 px-6">
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select
                value={newChecklistItem.category}
                onValueChange={(v) => setNewChecklistItem({ ...newChecklistItem, category: v })}
              >
                <SelectTrigger>
                  <span>{newChecklistItem.category || '카테고리 선택 또는 직접 입력'}</span>
                </SelectTrigger>
                <SelectContent>
                  {checklistCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newChecklistItem.category}
                onChange={(e) => setNewChecklistItem({ ...newChecklistItem, category: e.target.value })}
                placeholder="새 카테고리 입력"
              />
            </div>

            <div className="space-y-2">
              <Label>항목명</Label>
              <Input
                value={newChecklistItem.text}
                onChange={(e) => setNewChecklistItem({ ...newChecklistItem, text: e.target.value })}
                placeholder="예: 타학원 경험 확인"
              />
            </div>

            <div className="space-y-2">
              <Label>입력 필드 타입</Label>
              <Select
                value={newChecklistItem.inputType}
                onValueChange={(v) => setNewChecklistItem({ ...newChecklistItem, inputType: v as 'none' | 'text' | 'radio' })}
              >
                <SelectTrigger>
                  <span>
                    {newChecklistItem.inputType === 'none' ? '없음 (체크만)' :
                     newChecklistItem.inputType === 'text' ? '텍스트 입력' : '라디오 선택'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음 (체크만)</SelectItem>
                  <SelectItem value="text">텍스트 입력</SelectItem>
                  <SelectItem value="radio">라디오 선택</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newChecklistItem.inputType !== 'none' && (
              <div className="space-y-2">
                <Label>입력 필드 라벨</Label>
                <Input
                  value={newChecklistItem.inputLabel}
                  onChange={(e) => setNewChecklistItem({ ...newChecklistItem, inputLabel: e.target.value })}
                  placeholder="예: 학원명, 체력"
                />
              </div>
            )}

            {newChecklistItem.inputType === 'radio' && (
              <div className="space-y-2">
                <Label>선택 옵션 (쉼표로 구분)</Label>
                <Input
                  value={newChecklistItem.radioOptions}
                  onChange={(e) => setNewChecklistItem({ ...newChecklistItem, radioOptions: e.target.value })}
                  placeholder="예: 상, 중, 하"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddChecklistModalOpen(false)}>
              취소
            </Button>
            <Button onClick={addChecklistItem}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 차단 날짜 추가 모달 */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>날짜 차단</DialogTitle>
            <DialogDescription>
              해당 날짜에는 상담 예약을 받지 않습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-6 px-6">
            <div className="space-y-2">
              <Label>날짜</Label>
              <Input
                type="date"
                value={newBlockedDate}
                onChange={(e) => setNewBlockedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>사유 (선택)</Label>
              <Input
                value={newBlockReason}
                onChange={(e) => setNewBlockReason(e.target.value)}
                placeholder="예: 공휴일, 학원 행사"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddBlockedSlot} disabled={addingBlock}>
              {addingBlock ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
