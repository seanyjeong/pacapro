'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Plus, X, Calendar } from 'lucide-react';
import type { TrialDate } from '@/lib/types/student';

interface TrialSectionProps {
  mode: 'create' | 'edit';
  isTrial: boolean;
  setIsTrial: (v: boolean) => void;
  trialDates: TrialDate[];
  timeSlotLabels: Record<string, string>;
  minimumDate: string;
  error?: string;
  addTrialDate: () => void;
  removeTrialDate: (index: number) => void;
  updateTrialDate: (index: number, field: keyof TrialDate, value: string) => void;
}

export function TrialSection({
  mode, isTrial, setIsTrial, trialDates, timeSlotLabels, minimumDate, error,
  addTrialDate, removeTrialDate, updateTrialDate,
}: TrialSectionProps) {
  if (mode === 'create') {
    return (
      <Card data-testid="trial-section" className={isTrial ? 'bg-primary-soft' : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className={`w-5 h-5 mr-2 ${isTrial ? 'text-primary' : 'text-muted-foreground'}`} />
            체험생 등록
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isTrial"
              checked={isTrial}
              onChange={(e) => {
                setIsTrial(e.target.checked);
                if (e.target.checked && trialDates.length === 0) addTrialDate();
              }}
              className="h-4 w-4 accent-primary"
            />
            <label htmlFor="isTrial" className="text-sm font-medium text-foreground">
              체험 수업 학생으로 등록 (2회 무료 체험)
            </label>
          </div>

          {isTrial && (
            <div id="field-trial_dates" className="ml-6 space-y-3" tabIndex={-1}>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">체험 일정</label>
                <Button type="button" variant="secondary" size="sm" onClick={addTrialDate}>
                  <Plus className="w-4 h-4" />일정 추가
                </Button>
              </div>

              {trialDates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  오늘 또는 이후의 체험 일정을 추가해주세요.
                </p>
              ) : (
                <div className="space-y-2">
                  {trialDates.map((td, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">{idx + 1}회차</span>
                      <input type="date" value={td.date}
                        min={td.date && td.date < minimumDate ? undefined : minimumDate}
                        onChange={(e) => updateTrialDate(idx, 'date', e.target.value)}
                        className="h-10 min-w-0 flex-1 rounded-lg bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                      <select value={td.time_slot}
                        onChange={(e) => updateTrialDate(idx, 'time_slot', e.target.value as TrialDate['time_slot'])}
                        className="h-10 rounded-lg bg-muted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                        {Object.entries(timeSlotLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeTrialDate(idx)}
                        className="p-1 text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}

              <div className="rounded-xl bg-card p-3 text-sm text-foreground">
                <p className="font-medium">체험생 안내</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-secondary-foreground">
                  <li>체험 수업은 무료로 진행됩니다 (학원비 0원)</li>
                  <li>출석 체크 시 남은 체험 횟수가 자동으로 차감됩니다</li>
                  <li>체험 완료 후 정식 등록으로 전환할 수 있습니다</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // edit mode + isTrial
  if (!isTrial) return null;

  return (
    <Card data-testid="trial-section" className="bg-primary-soft">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-primary" />
          체험 일정 수정
        </CardTitle>
      </CardHeader>
      <CardContent id="field-trial_dates" className="space-y-4" tabIndex={-1}>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground">체험 일정</label>
          <Button type="button" variant="secondary" size="sm" onClick={addTrialDate}>
            <Plus className="w-4 h-4" />일정 추가
          </Button>
        </div>

        {trialDates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">체험 일정을 추가하세요.</p>
        ) : (
          <div className="space-y-2">
            {trialDates.map((td, idx) => {
              const isAttended = td.attended === true;
              return (
                <div key={idx} className={`flex flex-wrap items-center gap-2 rounded-xl p-3 ${
                  isAttended ? 'bg-success-soft' : 'bg-card'
                }`}>
                  <Calendar className={`w-4 h-4 ${isAttended ? 'text-success' : 'text-primary'}`} />
                  <span className={`text-sm font-semibold ${isAttended ? 'text-success' : 'text-primary'}`}>
                    {idx + 1}회차{isAttended && ' (출석완료)'}
                  </span>
                  <input type="date" value={td.date}
                    min={td.date && td.date < minimumDate ? undefined : minimumDate}
                    onChange={(e) => updateTrialDate(idx, 'date', e.target.value)}
                    disabled={isAttended}
                    className={`h-10 min-w-0 flex-1 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      isAttended ? 'bg-card/60 text-muted-foreground cursor-not-allowed' : 'bg-muted text-foreground'
                    }`} />
                  <select value={td.time_slot}
                    onChange={(e) => updateTrialDate(idx, 'time_slot', e.target.value as TrialDate['time_slot'])}
                    disabled={isAttended}
                    className={`h-10 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      isAttended ? 'bg-card/60 text-muted-foreground cursor-not-allowed' : 'bg-muted text-foreground'
                    }`}>
                    {Object.entries(timeSlotLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  {!isAttended && (
                    <button type="button" onClick={() => removeTrialDate(idx)}
                      className="p-1 text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}

        <div className="text-xs text-primary">
          * 일정 수정 시 기존 미출석 스케줄은 삭제되고 새 일정으로 재배정됩니다.
        </div>
      </CardContent>
    </Card>
  );
}
