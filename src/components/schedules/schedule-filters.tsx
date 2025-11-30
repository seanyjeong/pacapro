'use client';

/**
 * 수업 필터 컴포넌트
 */

import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { ScheduleFilters, TimeSlot } from '@/lib/types/schedule';
import { TIME_SLOT_LABELS } from '@/lib/types/schedule';

interface Instructor {
  id: number;
  name: string;
}

interface ScheduleFiltersProps {
  filters: ScheduleFilters;
  instructors: Instructor[];
  onFiltersChange: (filters: ScheduleFilters) => void;
}

export function ScheduleFiltersComponent({
  filters,
  instructors,
  onFiltersChange,
}: ScheduleFiltersProps) {
  const handleTimeSlotChange = (value: string) => {
    onFiltersChange({
      ...filters,
      time_slot: value === 'all' ? undefined : (value as TimeSlot),
    });
  };

  const handleInstructorChange = (value: string) => {
    onFiltersChange({
      ...filters,
      instructor_id: value === 'all' ? undefined : parseInt(value),
    });
  };

  const handleAttendanceTakenChange = (value: string) => {
    onFiltersChange({
      ...filters,
      attendance_taken: value === 'all' ? undefined : value === 'true',
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      start_date: filters.start_date,
      end_date: filters.end_date,
    });
  };

  const hasActiveFilters =
    filters.time_slot !== undefined ||
    filters.instructor_id !== undefined ||
    filters.attendance_taken !== undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 시간대 필터 */}
          <div className="space-y-2">
            <Label htmlFor="time-slot">시간대</Label>
            <Select
              value={filters.time_slot || 'all'}
              onValueChange={handleTimeSlotChange}
            >
              <SelectTrigger id="time-slot">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="morning">{TIME_SLOT_LABELS.morning}</SelectItem>
                <SelectItem value="afternoon">{TIME_SLOT_LABELS.afternoon}</SelectItem>
                <SelectItem value="evening">{TIME_SLOT_LABELS.evening}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 강사 필터 */}
          <div className="space-y-2">
            <Label htmlFor="instructor">강사</Label>
            <Select
              value={filters.instructor_id?.toString() || 'all'}
              onValueChange={handleInstructorChange}
            >
              <SelectTrigger id="instructor">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {instructors.map((instructor) => (
                  <SelectItem key={instructor.id} value={instructor.id.toString()}>
                    {instructor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 출석 완료 여부 필터 */}
          <div className="space-y-2">
            <Label htmlFor="attendance-taken">출석 완료</Label>
            <Select
              value={
                filters.attendance_taken === undefined
                  ? 'all'
                  : filters.attendance_taken.toString()
              }
              onValueChange={handleAttendanceTakenChange}
            >
              <SelectTrigger id="attendance-taken">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="true">완료</SelectItem>
                <SelectItem value="false">미완료</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 필터 초기화 버튼 */}
        {hasActiveFilters && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              필터 초기화
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
