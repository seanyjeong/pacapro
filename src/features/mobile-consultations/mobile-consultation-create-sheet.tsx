import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import { MobileSheet, mobileChoiceClass } from '../mobile-home/mobile-screen';
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

const labelClass = 'mb-1.5 block text-sm font-semibold text-secondary-foreground';

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
    <MobileSheet
      title="신규 상담 등록"
      description="학생, 날짜, 시간을 입력해 주세요."
      closeLabel="신규 상담 등록 닫기"
      onClose={onClose}
      onOverlayClick={onClose}
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="block">
          <span className={labelClass}>학생명 *</span>
          <Input
            type="text"
            value={form.studentName}
            onChange={(event) => onChange({ studentName: event.target.value })}
            placeholder="학생 이름"
          />
        </label>

        <label className="block">
          <span className={labelClass}>연락처 *</span>
          <Input
            type="tel"
            value={form.phone}
            onChange={(event) => onChange({ phone: event.target.value })}
            placeholder="010-0000-0000"
          />
        </label>

        <div>
          <span className={labelClass}>학년 *</span>
          <div className="grid grid-cols-3 gap-2">
            {GRADE_OPTIONS.map((grade) => (
              <button
                type="button"
                key={grade}
                aria-pressed={form.grade === grade}
                onClick={() => onChange({ grade: form.grade === grade ? '' : grade })}
                className={mobileChoiceClass(form.grade === grade)}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className={labelClass}>상담일 *</span>
          <Input
            type="date"
            value={form.preferredDate}
            onChange={(event) => onDateChange(event.target.value)}
            className="dark:[color-scheme:dark]"
          />
        </label>

        {form.preferredDate && (
          <div>
            <span className={labelClass}>시간 *</span>
            <div className="grid max-h-52 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
              {generateTimeSlots().map((slot) => {
                const booked = bookedTimes.includes(slot);
                const selected = form.preferredTime === slot;
                return (
                  <button
                    type="button"
                    key={slot}
                    disabled={booked}
                    aria-pressed={selected}
                    onClick={() => onChange({ preferredTime: slot })}
                    className={cn(
                      'h-11 rounded-xl text-sm font-semibold tabular-nums transition-colors',
                      selected && 'bg-primary text-primary-foreground',
                      booked && 'cursor-not-allowed bg-muted text-muted-foreground/60 line-through',
                      !selected && !booked && 'bg-muted text-foreground hover:bg-primary-soft hover:text-primary'
                    )}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="block">
          <span className={labelClass}>메모</span>
          <Textarea
            value={form.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="상담 관련 메모"
            rows={2}
            className="resize-none"
          />
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={creating}>
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          {creating ? '등록 중...' : '상담 등록'}
        </Button>
      </form>
    </MobileSheet>
  );
}
