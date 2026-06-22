import { Calendar, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClassDaysControlBarProps {
  changedCount: number;
  effectiveFrom: string;
  monthOptions: { value: string; label: string }[];
  onEffectiveFromChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  scheduledCount: number;
}

export function ClassDaysControlBar({
  changedCount,
  effectiveFrom,
  monthOptions,
  onEffectiveFromChange,
  onSave,
  saving,
  scheduledCount,
}: ClassDaysControlBarProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardContent className="px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">적용 시작월:</span>
            <Select value={effectiveFrom} onValueChange={onEffectiveFromChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            {changedCount > 0 ? <Badge variant="secondary">{changedCount}명 변경됨</Badge> : null}
            {scheduledCount > 0 ? (
              <Badge variant="outline" className="border-orange-300 text-orange-600">
                {scheduledCount}명 변경 예정
              </Badge>
            ) : null}
            <Button disabled={changedCount === 0 || saving} onClick={onSave}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              저장 ({changedCount}명)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
