'use client';

import type { FormEvent } from 'react';
import { Banknote, Calendar, Calculator, Hash, AlertTriangle } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { CreditCalculation, CreditInputMode, DateCreditCalculation } from './manual-credit-types';
import { REASON_PRESETS } from './manual-credit-utils';

interface ManualCreditCreateFormProps {
  monthlyTuition: number;
  weeklyCount: number;
  classDaysText: string;
  perClassFee: number;
  inputMode: CreditInputMode;
  startDate: string;
  endDate: string;
  classCount: number;
  directAmount: number;
  reason: string;
  customReason: string;
  notes: string;
  error: string;
  processing: boolean;
  dateCalculation: DateCreditCalculation;
  countCalculation: CreditCalculation;
  currentCalculation: CreditCalculation;
  onInputModeChange: (value: CreditInputMode) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClassCountChange: (value: number) => void;
  onDirectAmountChange: (value: number) => void;
  onReasonChange: (value: string) => void;
  onCustomReasonChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

export function ManualCreditCreateForm({
  monthlyTuition,
  weeklyCount,
  classDaysText,
  perClassFee,
  inputMode,
  startDate,
  endDate,
  classCount,
  directAmount,
  reason,
  customReason,
  notes,
  error,
  processing,
  dateCalculation,
  countCalculation,
  currentCalculation,
  onInputModeChange,
  onStartDateChange,
  onEndDateChange,
  onClassCountChange,
  onDirectAmountChange,
  onReasonChange,
  onCustomReasonChange,
  onNotesChange,
  onSubmit,
  onCancel,
}: ManualCreditCreateFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <div className="py-6 px-6 space-y-4">
        <div className="p-3 bg-muted/50 rounded-lg text-sm space-y-1">
          <div>월 수강료: <span className="font-medium">{monthlyTuition.toLocaleString()}원</span></div>
          <div>주당 횟수: <span className="font-medium">{weeklyCount}회</span> (월 {weeklyCount * 4}회)</div>
          <div>수업 요일: <span className="font-medium">{classDaysText}</span></div>
          <div className="pt-1 border-t border-border mt-2">
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              1회 금액: {perClassFee.toLocaleString()}원
            </span>
          </div>
        </div>

        <Tabs value={inputMode} onValueChange={(value) => onInputModeChange(value as CreditInputMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="date" className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              날짜로
            </TabsTrigger>
            <TabsTrigger value="count" className="flex items-center gap-1">
              <Hash className="w-4 h-4" />
              회차로
            </TabsTrigger>
            <TabsTrigger value="amount" className="flex items-center gap-1">
              <Banknote className="w-4 h-4" />
              금액 직접
            </TabsTrigger>
          </TabsList>

          <TabsContent value="date" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="startDate">시작일</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => onStartDateChange(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate">종료일</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => onEndDateChange(event.target.value)}
                  min={startDate}
                />
              </div>
            </div>

            {startDate && endDate && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 mb-1">
                  <Calculator className="w-4 h-4" />
                  계산 결과
                </div>
                {dateCalculation.count > 0 ? (
                  <>
                    <div className="text-blue-600 dark:text-blue-500">
                      해당 기간 수업일: {dateCalculation.dates.join(', ')}
                    </div>
                    <div className="text-blue-600 dark:text-blue-500">
                      수업 횟수: <span className="font-medium">{dateCalculation.count}회</span>
                    </div>
                    <div className="text-blue-700 dark:text-blue-400 font-medium mt-1">
                      총 크레딧: {dateCalculation.totalCredit.toLocaleString()}원
                    </div>
                  </>
                ) : (
                  <div className="text-orange-600 dark:text-orange-400">
                    해당 기간에 수업일이 없습니다.
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="count" className="space-y-3 mt-3">
            <div className="space-y-1">
              <Label htmlFor="classCount">회차</Label>
              <Input
                id="classCount"
                type="number"
                min={1}
                max={12}
                value={classCount || ''}
                onChange={(event) => onClassCountChange(event.target.value === '' ? 0 : parseInt(event.target.value, 10))}
                onBlur={() => {
                  if (!classCount || classCount < 1) onClassCountChange(1);
                  if (classCount > 12) onClassCountChange(12);
                }}
                className="text-right"
              />
              <p className="text-xs text-muted-foreground">1~12 사이의 값을 입력하세요.</p>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
              <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 mb-1">
                <Calculator className="w-4 h-4" />
                계산 결과
              </div>
              <div className="text-blue-600 dark:text-blue-500">
                {perClassFee.toLocaleString()}원 x {classCount}회
              </div>
              <div className="text-blue-700 dark:text-blue-400 font-medium mt-1">
                총 크레딧: {countCalculation.totalCredit.toLocaleString()}원
              </div>
            </div>
          </TabsContent>

          <TabsContent value="amount" className="space-y-3 mt-3">
            <div className="space-y-1">
              <Label htmlFor="directAmount">크레딧 금액 (원)</Label>
              <MoneyInput
                id="directAmount"
                value={directAmount}
                onChange={(value) => onDirectAmountChange(Math.min(10000000, value))}
                placeholder="50000"
              />
              <p className="text-xs text-muted-foreground">1,000원 ~ 10,000,000원 (1,000원 단위 권장)</p>
            </div>

            {directAmount > 0 && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                <div className="flex items-center gap-1 font-medium text-blue-700 dark:text-blue-400 mb-1">
                  <Banknote className="w-4 h-4" />
                  입력 금액
                </div>
                <div className="text-blue-700 dark:text-blue-400 font-medium">
                  크레딧: {directAmount.toLocaleString()}원
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label>사유</Label>
          <div className="flex flex-wrap gap-2">
            {REASON_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={reason === preset.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => onReasonChange(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {reason === '기타' && (
            <Input
              placeholder="사유를 직접 입력하세요"
              value={customReason}
              onChange={(event) => onCustomReasonChange(event.target.value)}
              className="mt-2"
            />
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="notes">추가 메모 (선택)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="추가 설명이 필요한 경우 입력하세요"
            rows={2}
          />
        </div>

        {error && (
          <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button
          type="submit"
          disabled={processing || currentCalculation.totalCredit <= 0}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {processing ? '생성 중...' : `${currentCalculation.totalCredit?.toLocaleString() || 0}원 크레딧 생성`}
        </Button>
      </DialogFooter>
    </form>
  );
}
