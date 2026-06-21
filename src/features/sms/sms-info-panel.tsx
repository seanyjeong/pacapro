import { AlertCircle, RadioTower } from 'lucide-react';

interface SmsInfoPanelProps {
  senderCount: number;
  selectedSenderId: number | null;
}

export function SmsInfoPanel({ senderCount, selectedSenderId }: SmsInfoPanelProps) {
  return (
    <section className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">발송 전 확인</h2>
            <p className="mt-1 text-sm text-sky-800">문자는 설정에 연결된 서비스의 발신번호로 발송됩니다.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-background/70 px-3 py-2">
              <span className="flex items-center gap-1 text-sky-700">
                <RadioTower className="h-3.5 w-3.5" />
                발신번호
              </span>
              <strong className="mt-1 block text-sm text-sky-950">{senderCount}개</strong>
            </div>
            <div className="rounded-md bg-background/70 px-3 py-2">
              <span className="text-sky-700">선택 상태</span>
              <strong className="mt-1 block text-sm text-sky-950">
                {selectedSenderId ? '선택됨' : '확인 필요'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
