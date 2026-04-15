'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, User, Building, Shield, DollarSign, Calendar, Clock, Banknote, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';

// 학원비 설정 타입
interface TuitionByWeeklyCount {
  weekly_1: number;
  weekly_2: number;
  weekly_3: number;
  weekly_4: number;
  weekly_5: number;
  weekly_6: number;
  weekly_7: number;
}

interface SeasonFees {
  exam_early: number;      // 입시-수시
  exam_regular: number;    // 입시-정시
  civil_service: number;   // 공무원
}

interface AcademySettings {
  academy_name: string;
  phone: string;
  address: string;
  business_number: string;
  tuition_due_day: number;  // 기본 납부일 (1~31)
  // 급여 설정
  salary_payment_day: number;  // 급여 지급일 (1~31)
  salary_month_type: 'current' | 'next';  // 당월/익월 정산
  // 시간대별 수업 시간 (HH:MM-HH:MM 형식)
  morning_class_time: string;
  afternoon_class_time: string;
  evening_class_time: string;
  // 입시반 학원비 (주1~7회)
  exam_tuition: TuitionByWeeklyCount;
  // 성인/공무원반 학원비 (주1~7회)
  adult_tuition: TuitionByWeeklyCount;
  // 시즌비
  season_fees: SeasonFees;
}

const DEFAULT_TUITION: TuitionByWeeklyCount = {
  weekly_1: 0,
  weekly_2: 0,
  weekly_3: 0,
  weekly_4: 0,
  weekly_5: 0,
  weekly_6: 0,
  weekly_7: 0,
};

const DEFAULT_SEASON_FEES: SeasonFees = {
  exam_early: 0,
  exam_regular: 0,
  civil_service: 0,
};

// 시간 옵션 생성 (00:00 ~ 23:30, 30분 단위)
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

// HH:MM-HH:MM 형식 파싱
function parseTimeRange(timeRange: string): { start: string; end: string } {
  const [start, end] = timeRange.split('-');
  return { start: start || '09:00', end: end || '12:00' };
}

// 시간 범위 합치기
function formatTimeRange(start: string, end: string): string {
  return `${start}-${end}`;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [academySettings, setAcademySettings] = useState<AcademySettings>({
    academy_name: '',
    phone: '',
    address: '',
    business_number: '',
    tuition_due_day: 5,  // 기본값 5일
    salary_payment_day: 10,  // 급여 지급일 기본값 10일
    salary_month_type: 'next',  // 익월 정산 기본값
    morning_class_time: '09:30-12:00',
    afternoon_class_time: '14:00-18:00',
    evening_class_time: '18:30-21:00',
    exam_tuition: { ...DEFAULT_TUITION },
    adult_tuition: { ...DEFAULT_TUITION },
    season_fees: { ...DEFAULT_SEASON_FEES },
  });
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // 사용자 정보 로드
      const userResponse = await apiClient.get<{user: any}>('/auth/me');
      setUser(userResponse.user);

      // 학원 설정 로드
      try {
        const settingsResponse = await apiClient.get<{settings: any}>('/settings/academy');
        if (settingsResponse.settings) {
          setAcademySettings(prev => ({
            ...prev,
            ...settingsResponse.settings,
          }));
        }
      } catch {
        // 설정이 없으면 기본값 사용
      }

      // 시간대/급여 설정 로드 (별도 API)
      try {
        const timeResponse = await apiClient.get<{settings: any}>('/settings');
        if (timeResponse.settings) {
          setAcademySettings(prev => ({
            ...prev,
            morning_class_time: timeResponse.settings.morning_class_time || '09:30-12:00',
            afternoon_class_time: timeResponse.settings.afternoon_class_time || '14:00-18:00',
            evening_class_time: timeResponse.settings.evening_class_time || '18:30-21:00',
            salary_payment_day: timeResponse.settings.salary_payment_day || 10,
            salary_month_type: timeResponse.settings.salary_month_type || 'next',
          }));
        }
      } catch {
        // 시간 설정이 없으면 기본값 사용
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const handleSaveAcademySettings = async () => {
    try {
      setLoading(true);
      // 학원 기본 정보 + 학원비 저장
      await apiClient.put('/settings/academy', academySettings);
      // 시간대/급여 설정 저장
      await apiClient.put('/settings', {
        morning_class_time: academySettings.morning_class_time,
        afternoon_class_time: academySettings.afternoon_class_time,
        evening_class_time: academySettings.evening_class_time,
        salary_payment_day: academySettings.salary_payment_day,
        salary_month_type: academySettings.salary_month_type,
      });
      toast.success('학원 설정이 저장되었습니다.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || '설정 저장에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 학원비 입력 핸들러
  const handleTuitionChange = (
    type: 'exam_tuition' | 'adult_tuition',
    weeklyKey: keyof TuitionByWeeklyCount,
    value: number
  ) => {
    setAcademySettings(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [weeklyKey]: value,
      },
    }));
  };

  // 시즌비 입력 핸들러
  const handleSeasonFeeChange = (key: keyof SeasonFees, value: number) => {
    setAcademySettings(prev => ({
      ...prev,
      season_fees: {
        ...prev.season_fees,
        [key]: value,
      },
    }));
  };

  const weeklyLabels = ['주1회', '주2회', '주3회', '주4회', '주5회', '주6회', '주7회'];
  const weeklyKeys: (keyof TuitionByWeeklyCount)[] = [
    'weekly_1', 'weekly_2', 'weekly_3', 'weekly_4', 'weekly_5', 'weekly_6', 'weekly_7'
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground">설정</h1>
        <p className="text-muted-foreground mt-1">학원 및 계정 설정 관리</p>
      </div>

      {/* 내 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5" />
            <CardTitle>내 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">이름</label>
              <input
                type="text"
                value={user?.name || ''}
                className="w-full px-3 py-2 border border-border rounded-md bg-muted text-foreground"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">이메일</label>
              <input
                type="email"
                value={user?.email || ''}
                className="w-full px-3 py-2 border border-border rounded-md bg-muted text-foreground"
                disabled
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">권한</label>
              <input
                type="text"
                value={user?.role === 'owner' ? '원장' : user?.role === 'admin' ? '관리자' : '강사'}
                className="w-full px-3 py-2 border border-border rounded-md bg-muted text-foreground"
                disabled
              />
            </div>
          </div>
          <div className="pt-4 border-t">
            <Button variant="outline">비밀번호 변경</Button>
          </div>
        </CardContent>
      </Card>

      {/* 학원 기본 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            <CardTitle>학원 기본 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">학원명</label>
              <input
                type="text"
                value={academySettings.academy_name}
                onChange={(e) => setAcademySettings({ ...academySettings, academy_name: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                placeholder="예: 파카학원"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">전화번호</label>
              <input
                type="tel"
                value={academySettings.phone}
                onChange={(e) => setAcademySettings({ ...academySettings, phone: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                placeholder="010-0000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">주소</label>
              <input
                type="text"
                value={academySettings.address}
                onChange={(e) => setAcademySettings({ ...academySettings, address: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                placeholder="학원 주소"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">사업자등록번호</label>
              <input
                type="text"
                value={academySettings.business_number}
                onChange={(e) => setAcademySettings({ ...academySettings, business_number: e.target.value })}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                placeholder="000-00-00000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                기본 납부일 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={academySettings.tuition_due_day}
                  onChange={(e) => setAcademySettings({ ...academySettings, tuition_due_day: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                    <option key={day} value={day}>
                      매월 {day}일
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-muted-foreground mt-1">학생별로 다른 납부일을 설정할 수 있습니다</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 수업 시간대 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <CardTitle>수업 시간대 설정</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">오전/오후/저녁 수업 시간을 설정합니다.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 오전반 */}
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <label className="block text-sm font-medium text-orange-800 dark:text-orange-200 mb-3">
                🌅 오전반
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={parseTimeRange(academySettings.morning_class_time).start}
                  onChange={(e) => {
                    const { end } = parseTimeRange(academySettings.morning_class_time);
                    setAcademySettings({ ...academySettings, morning_class_time: formatTimeRange(e.target.value, end) });
                  }}
                  className="flex-1 px-2 py-2 border border-orange-200 dark:border-orange-800 rounded-md text-sm bg-background text-foreground"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <span className="text-muted-foreground">~</span>
                <select
                  value={parseTimeRange(academySettings.morning_class_time).end}
                  onChange={(e) => {
                    const { start } = parseTimeRange(academySettings.morning_class_time);
                    setAcademySettings({ ...academySettings, morning_class_time: formatTimeRange(start, e.target.value) });
                  }}
                  className="flex-1 px-2 py-2 border border-orange-200 dark:border-orange-800 rounded-md text-sm bg-background text-foreground"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 오후반 */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
                ☀️ 오후반
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={parseTimeRange(academySettings.afternoon_class_time).start}
                  onChange={(e) => {
                    const { end } = parseTimeRange(academySettings.afternoon_class_time);
                    setAcademySettings({ ...academySettings, afternoon_class_time: formatTimeRange(e.target.value, end) });
                  }}
                  className="flex-1 px-2 py-2 border border-blue-200 dark:border-blue-800 rounded-md text-sm bg-background text-foreground"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <span className="text-muted-foreground">~</span>
                <select
                  value={parseTimeRange(academySettings.afternoon_class_time).end}
                  onChange={(e) => {
                    const { start } = parseTimeRange(academySettings.afternoon_class_time);
                    setAcademySettings({ ...academySettings, afternoon_class_time: formatTimeRange(start, e.target.value) });
                  }}
                  className="flex-1 px-2 py-2 border border-blue-200 dark:border-blue-800 rounded-md text-sm bg-background text-foreground"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 저녁반 */}
            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-3">
                🌙 저녁반
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={parseTimeRange(academySettings.evening_class_time).start}
                  onChange={(e) => {
                    const { end } = parseTimeRange(academySettings.evening_class_time);
                    setAcademySettings({ ...academySettings, evening_class_time: formatTimeRange(e.target.value, end) });
                  }}
                  className="flex-1 px-2 py-2 border border-purple-200 dark:border-purple-800 rounded-md text-sm bg-background text-foreground"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
                <span className="text-muted-foreground">~</span>
                <select
                  value={parseTimeRange(academySettings.evening_class_time).end}
                  onChange={(e) => {
                    const { start } = parseTimeRange(academySettings.evening_class_time);
                    setAcademySettings({ ...academySettings, evening_class_time: formatTimeRange(start, e.target.value) });
                  }}
                  className="flex-1 px-2 py-2 border border-purple-200 dark:border-purple-800 rounded-md text-sm bg-background text-foreground"
                >
                  {TIME_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 학원비 설정 - 입시반 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <CardTitle>입시반 학원비 설정</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">주 수업 횟수별 월 학원비를 설정합니다. (1만원 단위)</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {weeklyKeys.map((key, index) => (
              <div key={key}>
                <label className="block text-sm font-medium text-foreground mb-1 text-center">
                  {weeklyLabels[index]}
                </label>
                <input
                  type="number"
                  value={academySettings.exam_tuition[key] || ''}
                  onChange={(e) => handleTuitionChange('exam_tuition', key, Number(e.target.value))}
                  className="w-full px-2 py-2 border border-border bg-background text-foreground rounded-md text-center text-sm"
                  min="0"
                  step="10000"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 학원비 설정 - 공무원/성인반 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <CardTitle>공무원/성인반 학원비 설정</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">주 수업 횟수별 월 학원비를 설정합니다. (1만원 단위)</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {weeklyKeys.map((key, index) => (
              <div key={key}>
                <label className="block text-sm font-medium text-foreground mb-1 text-center">
                  {weeklyLabels[index]}
                </label>
                <input
                  type="number"
                  value={academySettings.adult_tuition[key] || ''}
                  onChange={(e) => handleTuitionChange('adult_tuition', key, Number(e.target.value))}
                  className="w-full px-2 py-2 border border-border bg-background text-foreground rounded-md text-center text-sm"
                  min="0"
                  step="10000"
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 시즌비 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-600" />
            <CardTitle>시즌비 설정</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">입시 유형별 시즌비를 설정합니다. (1만원 단위)</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                입시 - 수시
              </label>
              <input
                type="number"
                value={academySettings.season_fees.exam_early || ''}
                onChange={(e) => handleSeasonFeeChange('exam_early', Number(e.target.value))}
                className="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 rounded-md text-center bg-background text-foreground"
                min="0"
                step="10000"
                placeholder="0"
              />
            </div>
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
              <label className="block text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">
                입시 - 정시
              </label>
              <input
                type="number"
                value={academySettings.season_fees.exam_regular || ''}
                onChange={(e) => handleSeasonFeeChange('exam_regular', Number(e.target.value))}
                className="w-full px-3 py-2 border border-indigo-200 dark:border-indigo-800 rounded-md text-center bg-background text-foreground"
                min="0"
                step="10000"
                placeholder="0"
              />
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
              <label className="block text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                공무원
              </label>
              <input
                type="number"
                value={academySettings.season_fees.civil_service || ''}
                onChange={(e) => handleSeasonFeeChange('civil_service', Number(e.target.value))}
                className="w-full px-3 py-2 border border-purple-200 dark:border-purple-800 rounded-md text-center bg-background text-foreground"
                min="0"
                step="10000"
                placeholder="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 급여 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Banknote className="w-5 h-5 text-emerald-600" />
            <CardTitle>급여 설정</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground mt-1">강사 급여 지급 관련 설정입니다.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 급여 지급일 */}
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
              <label className="block text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-2">
                급여 지급일
              </label>
              <select
                value={academySettings.salary_payment_day}
                onChange={(e) => setAcademySettings({ ...academySettings, salary_payment_day: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-emerald-200 dark:border-emerald-800 rounded-md bg-background text-foreground"
              >
                <option value={1}>매월 1일</option>
                <option value={5}>매월 5일</option>
                <option value={10}>매월 10일</option>
                <option value={15}>매월 15일</option>
                <option value={20}>매월 20일</option>
                <option value={0}>매월 말일</option>
              </select>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">모든 강사의 급여 지급일입니다.</p>
            </div>

            {/* 급여 정산 방식 */}
            <div className="p-4 bg-teal-50 dark:bg-teal-950 rounded-lg">
              <label className="block text-sm font-medium text-teal-800 dark:text-teal-200 mb-2">
                급여 정산 방식
              </label>
              <div className="space-y-3">
                <label className="flex items-center p-3 bg-card rounded-md border border-teal-200 dark:border-teal-800 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="radio"
                    name="salary_month_type"
                    value="next"
                    checked={academySettings.salary_month_type === 'next'}
                    onChange={(e) => setAcademySettings({ ...academySettings, salary_month_type: e.target.value as 'current' | 'next' })}
                    className="w-4 h-4 text-teal-600"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-foreground">익월 정산</div>
                    <div className="text-xs text-muted-foreground">10월 근무 → 11월 급여일에 지급</div>
                  </div>
                </label>
                <label className="flex items-center p-3 bg-card rounded-md border border-teal-200 dark:border-teal-800 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="radio"
                    name="salary_month_type"
                    value="current"
                    checked={academySettings.salary_month_type === 'current'}
                    onChange={(e) => setAcademySettings({ ...academySettings, salary_month_type: e.target.value as 'current' | 'next' })}
                    className="w-4 h-4 text-teal-600"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-foreground">당월 정산</div>
                    <div className="text-xs text-muted-foreground">10월 근무 → 10월 급여일에 지급</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 설명 박스 */}
          <div className="mt-4 p-4 bg-muted rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">급여 정산 예시</h4>
            {(() => {
              const payDay = academySettings.salary_payment_day === 0 ? '말일' : `${academySettings.salary_payment_day}일`;
              return academySettings.salary_month_type === 'next' ? (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• <span className="font-medium">11월 {payDay} 급여</span>: 10월 근무분 정산</p>
                  <p>• <span className="font-medium">12월 {payDay} 급여</span>: 11월 근무분 정산</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• <span className="font-medium">11월 {payDay} 급여</span>: 11월 근무분 정산</p>
                  <p>• <span className="font-medium">12월 {payDay} 급여</span>: 12월 근무분 정산</p>
                </div>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* 설정 저장 버튼 */}
      <div className="flex justify-end">
        <Button onClick={handleSaveAcademySettings} disabled={loading} size="lg">
          <Save className="w-4 h-4 mr-2" />
          {loading ? '저장 중...' : '학원 설정 저장'}
        </Button>
      </div>

      {/* 시스템 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <CardTitle>시스템 정보</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>버전</span>
            <span className="font-medium text-foreground">v3.16.0</span>
          </div>
          <div className="flex justify-between">
            <span>마지막 업데이트</span>
            <span className="font-medium text-foreground">2026-04-15</span>
          </div>
          <div className="flex justify-between">
            <span>데이터베이스</span>
            <span className="font-medium text-green-600">정상</span>
          </div>
          <div className="flex justify-between">
            <span>문의사항</span>
            <span className="font-medium text-foreground">010-2144-6755</span>
          </div>
        </CardContent>
      </Card>

      {/* 위험 구역 - 데이터베이스 초기화 */}
      {user?.role === 'owner' && (
        <Card className="border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <CardTitle className="text-red-700 dark:text-red-300">위험 구역</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg border border-red-200 dark:border-red-700">
              <h4 className="font-bold text-red-800 dark:text-red-200 mb-2">데이터베이스 초기화</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                모든 학생, 강사, 학원비, 급여, 스케줄, 시즌 데이터가 삭제됩니다.
                <br />
                <strong>이 작업은 되돌릴 수 없습니다!</strong>
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                    확인을 위해 &quot;초기화&quot;를 입력하세요
                  </label>
                  <input
                    type="text"
                    value={resetConfirmation}
                    onChange={(e) => setResetConfirmation(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 dark:border-red-700 rounded-md bg-background text-foreground"
                    placeholder="초기화"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={resetConfirmation !== '초기화' || isResetting}
                  onClick={async () => {
                    if (!confirm('정말로 모든 데이터를 삭제하시겠습니까?\n\n삭제되는 데이터:\n- 학생 정보\n- 강사 정보\n- 학원비 내역\n- 급여 내역\n- 스케줄\n- 시즌 정보\n\n이 작업은 되돌릴 수 없습니다!')) {
                      return;
                    }
                    try {
                      setIsResetting(true);
                      await apiClient.post('/settings/reset-database', { confirmation: '초기화' });
                      toast.success('데이터베이스가 초기화되었습니다.');
                      setResetConfirmation('');
                      window.location.reload();
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || '초기화에 실패했습니다.');
                    } finally {
                      setIsResetting(false);
                    }
                  }}
                  className="w-full"
                >
                  {isResetting ? '초기화 중...' : '데이터베이스 초기화'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
