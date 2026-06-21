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
  addTrialDate: () => void;
  removeTrialDate: (index: number) => void;
  updateTrialDate: (index: number, field: keyof TrialDate, value: string) => void;
}

export function TrialSection({
  mode, isTrial, setIsTrial, trialDates, timeSlotLabels,
  addTrialDate, removeTrialDate, updateTrialDate,
}: TrialSectionProps) {
  if (mode === 'create') {
    return (
      <Card className={isTrial ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className={`w-5 h-5 mr-2 ${isTrial ? 'text-purple-600' : 'text-gray-400'}`} />
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
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="isTrial" className="text-sm font-medium text-foreground">
              체험 수업 학생으로 등록 (2회 무료 체험)
            </label>
          </div>

          {isTrial && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-foreground">체험 일정</label>
                <Button type="button" variant="outline" size="sm" onClick={addTrialDate}
                  className="text-purple-600 border-purple-300 hover:bg-purple-50">
                  <Plus className="w-4 h-4 mr-1" />일정 추가
                </Button>
              </div>

              {trialDates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  체험 일정을 추가하세요. 일정은 나중에 추가할 수도 있습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {trialDates.map((td, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 bg-card rounded-lg border border-purple-200 dark:border-purple-700">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-700">{idx + 1}회차</span>
                      <input type="date" value={td.date}
                        onChange={(e) => updateTrialDate(idx, 'date', e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-border bg-background text-foreground rounded-md text-sm focus:ring-purple-500 focus:border-purple-500" />
                      <select value={td.time_slot}
                        onChange={(e) => updateTrialDate(idx, 'time_slot', e.target.value as TrialDate['time_slot'])}
                        className="px-3 py-1.5 border border-border bg-background text-foreground rounded-md text-sm focus:ring-purple-500 focus:border-purple-500">
                        {Object.entries(timeSlotLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeTrialDate(idx)}
                        className="p-1 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-purple-100 dark:bg-purple-900 border border-purple-200 dark:border-purple-700 rounded-md p-3 text-sm text-purple-800 dark:text-purple-200">
                <p className="font-medium">체험생 안내</p>
                <ul className="mt-1 text-xs text-purple-700 dark:text-purple-300 list-disc list-inside space-y-0.5">
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
    <Card className="border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
          체험 일정 수정
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground">체험 일정</label>
          <Button type="button" variant="outline" size="sm" onClick={addTrialDate}
            className="text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900">
            <Plus className="w-4 h-4 mr-1" />일정 추가
          </Button>
        </div>

        {trialDates.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">체험 일정을 추가하세요.</p>
        ) : (
          <div className="space-y-2">
            {trialDates.map((td, idx) => {
              const isAttended = td.attended === true;
              return (
                <div key={idx} className={`flex items-center gap-2 p-3 bg-card rounded-lg border ${
                  isAttended
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950'
                    : 'border-purple-200 dark:border-purple-700'
                }`}>
                  <Calendar className={`w-4 h-4 ${isAttended ? 'text-green-500' : 'text-purple-500'}`} />
                  <span className={`text-sm font-medium ${isAttended ? 'text-green-700 dark:text-green-300' : 'text-purple-700 dark:text-purple-300'}`}>
                    {idx + 1}회차{isAttended && ' (출석완료)'}
                  </span>
                  <input type="date" value={td.date}
                    onChange={(e) => updateTrialDate(idx, 'date', e.target.value)}
                    disabled={isAttended}
                    className={`flex-1 px-3 py-1.5 border border-border rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 ${
                      isAttended ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground'
                    }`} />
                  <select value={td.time_slot}
                    onChange={(e) => updateTrialDate(idx, 'time_slot', e.target.value as TrialDate['time_slot'])}
                    disabled={isAttended}
                    className={`px-3 py-1.5 border border-border rounded-md text-sm focus:ring-purple-500 focus:border-purple-500 ${
                      isAttended ? 'bg-muted text-muted-foreground cursor-not-allowed' : 'bg-background text-foreground'
                    }`}>
                    {Object.entries(timeSlotLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  {!isAttended && (
                    <button type="button" onClick={() => removeTrialDate(idx)}
                      className="p-1 text-muted-foreground hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="text-xs text-purple-600 dark:text-purple-400">
          * 일정 수정 시 기존 미출석 스케줄은 삭제되고 새 일정으로 재배정됩니다.
        </div>
      </CardContent>
    </Card>
  );
}
