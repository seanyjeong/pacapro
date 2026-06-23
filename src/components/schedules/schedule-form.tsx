'use client';

/**
 * 수업 등록/수정 폼 컴포넌트
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClassSchedule, ScheduleFormData, TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';
import { cn } from '@/lib/utils';
import { formatDateToString } from '@/lib/utils/schedule-helpers';

const scheduleFormSchema = z.object({
  class_date: z.string().min(1, '수업 날짜를 선택해주세요'),
  time_slot: z.enum(['morning', 'afternoon', 'evening'], {
    required_error: '시간대를 선택해주세요',
  }),
  instructor_id: z.number({
    required_error: '강사를 선택해주세요',
  }),
  title: z.string().optional(),
  content: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof scheduleFormSchema>;

const TIME_SLOT_OPTIONS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

interface Instructor {
  id: number;
  name: string;
}

interface ScheduleFormProps {
  schedule?: ClassSchedule;
  defaultClassDate?: string;
  instructors: Instructor[];
  onSubmit: (data: ScheduleFormData) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  loadError?: string | null;
  submitError?: string | null;
}

export function ScheduleForm({
  schedule,
  defaultClassDate,
  instructors,
  onSubmit,
  onCancel,
  isSubmitting,
  loadError,
  submitError,
}: ScheduleFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: schedule
      ? {
          class_date: schedule.class_date,
          time_slot: schedule.time_slot,
          instructor_id: schedule.instructor_id,
          title: schedule.title || '',
          content: schedule.content || '',
          notes: schedule.notes || '',
        }
      : {
          class_date: defaultClassDate || formatDateToString(new Date()),
          time_slot: 'afternoon',
          title: '',
          content: '',
          notes: '',
        },
  });

  const timeSlot = watch('time_slot');
  const instructorId = watch('instructor_id');

  const handleFormSubmit = (data: FormData) => {
    onSubmit(data);
  };

  return (
    <Card className="rounded-md">
      <CardHeader className="border-b border-border px-4 py-3">
        <CardTitle className="text-base tracking-normal">{schedule ? '수업 수정' : '수업 등록'}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
          {loadError && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">강사 목록 확인 필요</h2>
                  <p className="text-sm">{loadError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="class_date">
              수업 날짜 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="class_date"
              type="date"
              {...register('class_date')}
              className={errors.class_date ? 'border-red-500' : ''}
            />
            {errors.class_date && (
              <p className="text-sm text-red-500">{errors.class_date.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="time_slot">
              시간대 <span className="text-red-500">*</span>
            </Label>
            <div id="time_slot" className="grid grid-cols-3 gap-2" role="group" aria-label="시간대 선택">
              {TIME_SLOT_OPTIONS.map((slot) => (
                <Button
                  key={slot}
                  type="button"
                  variant={timeSlot === slot ? 'default' : 'outline'}
                  className={cn('h-10', errors.time_slot && 'border-red-500')}
                  aria-pressed={timeSlot === slot}
                  onClick={() => setValue('time_slot', slot, { shouldDirty: true, shouldValidate: true })}
                >
                  {TIME_SLOT_LABELS[slot]}
                </Button>
              ))}
            </div>
            {errors.time_slot && (
              <p className="text-sm text-red-500">{errors.time_slot.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructor">
              강사 <span className="text-red-500">*</span>
            </Label>
            <Select
              value={instructorId?.toString()}
              onValueChange={(value) => setValue('instructor_id', parseInt(value), { shouldDirty: true, shouldValidate: true })}
            >
              <SelectTrigger
                id="instructor"
                className={errors.instructor_id ? 'border-red-500' : ''}
              >
                <SelectValue placeholder="강사를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {instructors.map((instructor) => (
                  <SelectItem key={instructor.id} value={instructor.id.toString()}>
                    {instructor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.instructor_id && (
              <p className="text-sm text-red-500">{errors.instructor_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">수업 제목</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="예: 소방수업"
            />
            <p className="text-sm text-muted-foreground">
              입력하지 않으면 자동으로 생성됩니다
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">수업 내용</Label>
            <Textarea
              id="content"
              {...register('content')}
              placeholder="수업 내용을 입력하세요"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">메모</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="메모를 입력하세요"
              rows={3}
            />
          </div>

          {submitError && (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">저장 실패</h2>
                  <p className="text-sm">{submitError}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                취소
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : schedule ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
