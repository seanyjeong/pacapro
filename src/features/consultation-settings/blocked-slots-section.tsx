import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BlockedSlot } from '@/lib/types/consultation';

interface BlockedSlotsSectionProps {
  blockedSlots: BlockedSlot[];
  addingHolidays: boolean;
  onOpenBlockModal: () => void;
  onAddAllHolidays: () => void;
  onRemoveBlockedSlot: (id: number) => void;
}

export function BlockedSlotsSection({
  blockedSlots,
  addingHolidays,
  onOpenBlockModal,
  onAddAllHolidays,
  onRemoveBlockedSlot,
}: BlockedSlotsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          차단된 날짜
        </CardTitle>
        <CardDescription>특정 날짜에 상담 예약을 받지 않습니다. (공휴일, 행사 등)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenBlockModal}>
            <Plus className="mr-2 h-4 w-4" />
            날짜 추가
          </Button>
          <Button variant="outline" onClick={onAddAllHolidays} disabled={addingHolidays}>
            {addingHolidays ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            공휴일 차단
          </Button>
        </div>

        {blockedSlots.length > 0 && (
          <div className="space-y-2">
            {blockedSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex flex-col gap-2 rounded-lg bg-red-50 p-3 dark:bg-red-950 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="font-medium text-foreground">
                    {format(parseISO(slot.blocked_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                  </span>
                  {slot.reason && <span className="ml-2 text-sm text-muted-foreground">- {slot.reason}</span>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start text-red-600 hover:text-red-700 sm:self-center"
                  onClick={() => onRemoveBlockedSlot(slot.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
