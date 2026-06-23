'use client';

import { Send } from 'lucide-react';

interface Props {
  enabled: boolean;
  phone: string;
  providerName: string;
  testing: boolean;
  onPhoneChange: (value: string) => void;
  onTest: () => void;
}

export default function AttendanceTestPanel({
  enabled,
  phone,
  providerName,
  testing,
  onPhoneChange,
  onTest,
}: Props) {
  return (
    <div className="md:col-span-2 border-t border-border pt-4 mt-2">
      <div className="mb-3">
        <h4 className="font-medium text-foreground">출결관리 테스트 발송</h4>
        <p className="text-sm text-muted-foreground">보호자에게 나갈 출결 알림톡을 저장 전 확인합니다.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          aria-label={`${providerName} 출결 테스트 전화번호`}
          type="tel"
          value={phone}
          onChange={(event) => onPhoneChange(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:border-teal-500 focus:ring-2 focus:ring-teal-500"
          placeholder="테스트 전화번호 (예: 01012345678)"
        />
        <button
          onClick={onTest}
          disabled={testing || !enabled}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {testing ? '발송 중...' : '출결 테스트'}
        </button>
      </div>
      {!enabled && (
        <p className="mt-1 text-sm text-amber-600">알림톡 활성화와 출결 템플릿 설정이 필요합니다.</p>
      )}
    </div>
  );
}
