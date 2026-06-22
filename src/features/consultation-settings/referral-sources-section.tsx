import { Loader2, Plus, Save, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { ConsultationSettings } from '@/lib/types/consultation';

interface ReferralSourcesSectionProps {
  settings: Partial<ConsultationSettings>;
  newReferralSource: string;
  saving: boolean;
  onNewReferralSourceChange: (value: string) => void;
  onAddReferralSource: () => void;
  onRemoveReferralSource: (source: string) => void;
  onSave: () => void;
}

export function ReferralSourcesSection({
  settings,
  newReferralSource,
  saving,
  onNewReferralSourceChange,
  onAddReferralSource,
  onRemoveReferralSource,
  onSave,
}: ReferralSourcesSectionProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle>알게 된 경로 옵션</CardTitle>
        <CardDescription>상담 신청 시 선택할 수 있는 &quot;학원을 알게 된 경로&quot; 옵션입니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {settings.referralSources?.map((source) => (
            <Badge key={source} variant="secondary" className="gap-1 px-3 py-1.5">
              {source}
              <button onClick={() => onRemoveReferralSource(source)} className="ml-1 hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            aria-label="새 경로"
            value={newReferralSource}
            onChange={(event) => onNewReferralSourceChange(event.target.value)}
            placeholder="새 항목 추가"
            onKeyDown={(event) => {
              if (event.key === 'Enter') onAddReferralSource();
            }}
          />
          <Button variant="outline" onClick={onAddReferralSource}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          경로 저장
        </Button>
      </CardContent>
    </Card>
  );
}
