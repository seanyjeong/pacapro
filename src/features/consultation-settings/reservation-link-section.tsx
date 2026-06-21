import Link from 'next/link';
import { Check, Copy, ExternalLink, Link2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ReservationLinkSectionProps {
  isEnabled?: boolean;
  slug: string;
  originalSlug: string;
  slugAvailable: boolean | null;
  checkingSlug: boolean;
  savingSlug: boolean;
  copied: boolean;
  onEnabledChange: (checked: boolean) => void;
  onSlugChange: (value: string) => void;
  onCheckSlug: () => void;
  onSaveSlug: () => void;
  onCopyLink: () => void;
}

export function ReservationLinkSection({
  isEnabled,
  slug,
  originalSlug,
  slugAvailable,
  checkingSlug,
  savingSlug,
  copied,
  onEnabledChange,
  onSlugChange,
  onCheckSlug,
  onSaveSlug,
  onCopyLink,
}: ReservationLinkSectionProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          상담 예약 링크
        </CardTitle>
        <CardDescription>학부모에게 공유할 상담 예약 페이지 링크입니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Switch checked={isEnabled} onCheckedChange={onEnabledChange} />
          <Label>상담 예약 활성화</Label>
        </div>

        <div className="space-y-1">
          <Label>페이지 주소 (slug)</Label>
          <div className="flex flex-col gap-2 lg:flex-row">
            <div className="flex min-w-0 flex-1">
              <div className="flex items-center rounded-l-md border border-r-0 border-border bg-muted px-3 text-sm text-muted-foreground">
                {origin}/c/
              </div>
              <Input
                value={slug}
                onChange={(event) => onSlugChange(event.target.value)}
                placeholder="my-academy"
                className="min-w-0 flex-1 rounded-l-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCheckSlug} disabled={checkingSlug || !slug || slug.length < 3}>
                {checkingSlug ? <Loader2 className="h-4 w-4 animate-spin" /> : '중복 확인'}
              </Button>
              <Button onClick={onSaveSlug} disabled={savingSlug || slugAvailable !== true || slug === originalSlug}>
                {savingSlug ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                주소 저장
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">영문 소문자, 숫자, 하이픈(-)만 사용 가능 (3자 이상)</p>
          {slugAvailable === true && slug !== originalSlug && (
            <p className="text-xs text-green-600">사용 가능한 주소입니다. &quot;주소 저장&quot;을 눌러주세요.</p>
          )}
          {!slug && !originalSlug && (
            <p className="text-xs text-orange-600">페이지 주소를 설정해야 상담 예약 링크를 사용할 수 있습니다.</p>
          )}
        </div>

        {slug && originalSlug && (
          <div className="flex flex-col gap-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-950 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 break-all text-sm text-blue-800 dark:text-blue-200">
              {origin}/c/{originalSlug}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onCopyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Link href={`/c/${originalSlug}`} target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
