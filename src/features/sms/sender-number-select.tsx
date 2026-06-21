import { Phone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import type { SmsSenderNumber } from './sms-types';

interface SenderNumberSelectProps {
  senderNumbers: SmsSenderNumber[];
  selectedSenderId: number | null;
  onSelectedSenderIdChange: (value: number | null) => void;
}

export function SenderNumberSelect({
  senderNumbers,
  selectedSenderId,
  onSelectedSenderIdChange,
}: SenderNumberSelectProps) {
  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <Label htmlFor="sms-sender-number" className="text-sm font-semibold">
          발신번호
        </Label>
      </div>

      {senderNumbers.length > 0 ? (
        <>
          <select
            id="sms-sender-number"
            value={selectedSenderId ?? ''}
            onChange={(event) => onSelectedSenderIdChange(event.target.value ? Number(event.target.value) : null)}
            className="mt-3 h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {senderNumbers.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.phone}
                {sender.label ? ` (${sender.label})` : ''}
                {sender.is_default === 1 ? ' 기본' : ''}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">설정의 알림톡 및 SMS 메뉴에서 관리합니다.</p>
        </>
      ) : (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          등록된 발신번호를 확인하지 못했습니다. 설정을 확인한 뒤 발송해주세요.
        </p>
      )}
    </section>
  );
}
