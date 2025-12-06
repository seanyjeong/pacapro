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
import type { WeeklyHour, BlockedSlot, ConsultationSettings } from '@/lib/types/consultation';
import { DAY_LABELS } from '@/lib/types/consultation';

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

  // 2025년 한국 공휴일 목록
  const koreanHolidays2025 = [
    { date: '2025-01-01', name: '신정' },
    { date: '2025-01-28', name: '설날 연휴' },
    { date: '2025-01-29', name: '설날' },
    { date: '2025-01-30', name: '설날 연휴' },
    { date: '2025-03-01', name: '삼일절' },
    { date: '2025-05-05', name: '어린이날' },
    { date: '2025-05-06', name: '부처님오신날' },
    { date: '2025-06-06', name: '현충일' },
    { date: '2025-08-15', name: '광복절' },
    { date: '2025-10-03', name: '개천절' },
    { date: '2025-10-05', name: '추석 연휴' },
    { date: '2025-10-06', name: '추석' },
    { date: '2025-10-07', name: '추석 연휴' },
    { date: '2025-10-08', name: '추석 대체공휴일' },
    { date: '2025-10-09', name: '한글날' },
    { date: '2025-12-25', name: '크리스마스' },
  ];

  // 공휴일 모두 차단
  const [addingHolidays, setAddingHolidays] = useState(false);

  const handleAddAllHolidays = async () => {
    const today = new Date();
    const futureHolidays = koreanHolidays2025.filter(h => new Date(h.date) >= today);

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
            <p className="text-gray-500">{academyName}</p>
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
                <div className="flex items-center bg-gray-100 px-3 rounded-l-md border border-r-0 text-gray-500 text-sm">
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
              <p className="text-xs text-gray-500 mt-1">
                영문 소문자, 숫자, 하이픈(-)만 사용 가능
              </p>
            </div>
          </div>

          {slug && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-800 flex-1">
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
          <div className="p-4 bg-blue-50 rounded-lg space-y-3">
            <p className="text-sm font-medium text-blue-900">기본 시간 일괄 설정</p>
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
            <div key={hour.dayOfWeek} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
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
                <span className="text-gray-400">휴무</span>
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
              2025 공휴일 모두 차단
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
