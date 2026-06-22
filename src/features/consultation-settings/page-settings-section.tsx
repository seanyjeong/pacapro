import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ConsultationSettings } from '@/lib/types/consultation';

interface PageSettingsSectionProps {
  settings: Partial<ConsultationSettings>;
  saving: boolean;
  onSettingChange: <K extends keyof ConsultationSettings>(field: K, value: ConsultationSettings[K]) => void;
  onSave: () => void;
}

export function PageSettingsSection({ settings, saving, onSettingChange, onSave }: PageSettingsSectionProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle>예약 정책</CardTitle>
        <p className="text-sm text-muted-foreground">예약 페이지에 보이는 문구와 신청 가능한 시간 기준을 조정합니다.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="page-title">페이지 제목</Label>
          <Input
            id="page-title"
            value={settings.pageTitle || ''}
            onChange={(event) => onSettingChange('pageTitle', event.target.value)}
            placeholder="상담 예약"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="page-description">안내 문구</Label>
          <Textarea
            id="page-description"
            value={settings.pageDescription || ''}
            onChange={(event) => onSettingChange('pageDescription', event.target.value)}
            placeholder="상담 예약 페이지 상단에 표시될 안내 문구를 입력하세요."
            rows={3}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>상담 시간</Label>
            <Select
              value={settings.slotDuration?.toString() || '30'}
              onValueChange={(value) => onSettingChange('slotDuration', Number.parseInt(value, 10))}
            >
              <SelectTrigger>
                <span>{formatSlotDuration(settings.slotDuration)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30분</SelectItem>
                <SelectItem value="60">1시간</SelectItem>
                <SelectItem value="90">1시간 30분</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>슬롯당 최대 예약</Label>
            <Select
              value={settings.maxReservationsPerSlot?.toString() || '1'}
              onValueChange={(value) => onSettingChange('maxReservationsPerSlot', Number.parseInt(value, 10))}
            >
              <SelectTrigger>
                <span>{settings.maxReservationsPerSlot || 1}명</span>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((count) => (
                  <SelectItem key={count} value={count.toString()}>{count}명</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>예약 가능 기간</Label>
            <Select
              value={settings.advanceDays?.toString() || '30'}
              onValueChange={(value) => onSettingChange('advanceDays', Number.parseInt(value, 10))}
            >
              <SelectTrigger>
                <span>{formatAdvanceDays(settings.advanceDays)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">1주</SelectItem>
                <SelectItem value="14">2주</SelectItem>
                <SelectItem value="30">1개월</SelectItem>
                <SelectItem value="60">2개월</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>최소 예약 시간</Label>
            <Select
              value={settings.minAdvanceHours?.toString() || '4'}
              onValueChange={(value) => onSettingChange('minAdvanceHours', Number.parseInt(value, 10))}
            >
              <SelectTrigger>
                <span>{settings.minAdvanceHours === 0 ? '제한 없음' : `${settings.minAdvanceHours || 4}시간 전`}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">제한 없음</SelectItem>
                <SelectItem value="1">1시간 전</SelectItem>
                <SelectItem value="2">2시간 전</SelectItem>
                <SelectItem value="3">3시간 전</SelectItem>
                <SelectItem value="4">4시간 전</SelectItem>
                <SelectItem value="6">6시간 전</SelectItem>
                <SelectItem value="12">12시간 전</SelectItem>
                <SelectItem value="24">24시간 전</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">예약 시간 기준으로 최소 이 시간 전에 예약해야 합니다</p>
          </div>
        </div>

        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          예약 정책 저장
        </Button>
      </CardContent>
    </Card>
  );
}

function formatSlotDuration(value?: number) {
  if (value === 60) return '1시간';
  if (value === 90) return '1시간 30분';
  return '30분';
}

function formatAdvanceDays(value?: number) {
  if (value === 7) return '1주';
  if (value === 14) return '2주';
  if (value === 60) return '2개월';
  return '1개월';
}
