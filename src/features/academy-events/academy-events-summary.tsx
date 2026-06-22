import { Calendar, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { AcademyEvent } from '@/lib/types/academyEvent';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/types/academyEvent';

interface AcademyEventsSummaryProps {
  events: AcademyEvent[];
}

export function AcademyEventsSummary({ events }: AcademyEventsSummaryProps) {
  const eventsByType = events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <Card className="rounded-md">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">전체 일정</p>
              <p className="text-2xl font-semibold tracking-normal text-foreground">{events.length}건</p>
            </div>
            <CalendarDays className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((type) => (
        <Card key={type} className="rounded-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{EVENT_TYPE_LABELS[type]}</p>
                <p className="text-2xl font-semibold tracking-normal" style={{ color: EVENT_TYPE_COLORS[type] }}>
                  {eventsByType[type] || 0}건
                </p>
              </div>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-md"
                style={{ backgroundColor: `${EVENT_TYPE_COLORS[type]}20` }}
              >
                <Calendar className="h-4 w-4" style={{ color: EVENT_TYPE_COLORS[type] }} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
