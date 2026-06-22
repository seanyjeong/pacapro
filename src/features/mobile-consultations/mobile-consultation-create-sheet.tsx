import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GRADE_OPTIONS, generateTimeSlots } from './mobile-consultations-constants';
import type { CreateConsultationForm } from './mobile-consultations-types';

interface MobileConsultationCreateSheetProps {
  open: boolean;
  bookedTimes: string[];
  creating: boolean;
  form: CreateConsultationForm;
  onChange: (patch: Partial<CreateConsultationForm>) => void;
  onClose: () => void;
  onDateChange: (date: string) => void;
  onSubmit: () => void;
}

export function MobileConsultationCreateSheet({
  open,
  bookedTimes,
  creating,
  form,
  onChange,
  onClose,
  onDateChange,
  onSubmit,
}: MobileConsultationCreateSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-0" onClick={onClose}>
      <form
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-8 shadow-2xl dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        <div className="space-y-4 px-5 pb-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">신규 상담 등록</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">학생, 날짜, 시간을 입력하세요.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="신규 상담 등록 닫기">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">학생명 *</span>
            <input
              type="text"
              value={form.studentName}
              onChange={(event) => onChange({ studentName: event.target.value })}
              placeholder="학생 이름"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-200"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">연락처 *</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-200"
            />
          </label>

          <div>
            <span className="mb-2 block text-sm font-medium text-zinc-600 dark:text-zinc-300">학년 *</span>
            <div className="grid grid-cols-3 gap-2">
              {GRADE_OPTIONS.map((grade) => (
                <button
                  type="button"
                  key={grade}
                  onClick={() => onChange({ grade: form.grade === grade ? '' : grade })}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition
                    ${form.grade === grade
                      ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'}`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">상담일 *</span>
            <input
              type="date"
              value={form.preferredDate}
              onChange={(event) => onDateChange(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-200"
            />
          </label>

          {form.preferredDate && (
            <div>
              <span className="mb-2 block text-sm font-medium text-zinc-600 dark:text-zinc-300">시간 *</span>
              <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
                {generateTimeSlots().map((slot) => {
                  const booked = bookedTimes.includes(slot);
                  const selected = form.preferredTime === slot;
                  return (
                    <button
                      type="button"
                      key={slot}
                      disabled={booked}
                      onClick={() => onChange({ preferredTime: slot })}
                      className={`rounded-lg border py-2 text-sm font-medium transition
                        ${selected ? 'border-emerald-700 bg-emerald-600 text-white' : ''}
                        ${booked ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 line-through dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600' : ''}
                        ${!selected && !booked ? 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200' : ''}`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-zinc-600 dark:text-zinc-300">메모</span>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="상담 관련 메모"
              rows={2}
              className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:ring-zinc-200"
            />
          </label>

          <Button type="submit" className="w-full gap-2" disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            {creating ? '등록 중...' : '상담 등록'}
          </Button>
        </div>
      </form>
    </div>
  );
}
