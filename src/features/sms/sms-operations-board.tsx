import Link from 'next/link';
import type { ReactNode } from 'react';
import { History, MessageSquare, RadioTower, Send, Settings, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SendMode } from './sms-types';
import type { UseSmsPageState } from './use-sms-page-state';

interface SmsOperationsBoardProps {
  sms: UseSmsPageState;
}

const MODE_ACTIONS: Array<{ mode: SendMode; label: string }> = [
  { mode: 'all', label: '전체' },
  { mode: 'individual', label: '개별' },
  { mode: 'custom', label: '직접' },
];

export function SmsOperationsBoard({ sms }: SmsOperationsBoardProps) {
  const canSend = !sms.sending && sms.content.trim().length > 0;

  return (
    <aside
      aria-label="문자 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="sms-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Messaging Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">문자 작업 보드</h2>
        <p className="text-sm text-slate-600">발송 대상, 발신번호, 메시지 용량을 확인하고 바로 발송합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<Send className="h-4 w-4" />} label="유형" testId="sms-board-metric-type" value={sms.messageType} />
        <Metric icon={<Users className="h-4 w-4" />} label="대상" testId="sms-board-metric-recipients" value={`${sms.recipientCount}명`} />
        <Metric icon={<RadioTower className="h-4 w-4" />} label="발신" testId="sms-board-metric-senders" value={`${sms.senderNumbers.length}개`} />
        <Metric icon={<MessageSquare className="h-4 w-4" />} label="용량" testId="sms-board-metric-bytes" value={`${sms.contentBytes}B`} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MODE_ACTIONS.map((action) => (
          <Button
            key={action.mode}
            type="button"
            variant={sms.sendMode === action.mode ? 'default' : 'outline'}
            onClick={() => sms.handleModeChange(action.mode)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-2">
        <BoardLink href="#sms-compose" icon={<MessageSquare className="h-4 w-4" />} label="문자 작성으로 이동" />
        <BoardLink href="#sms-logs" icon={<History className="h-4 w-4" />} label="발송 내역으로 이동" />
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-medium text-slate-500">발송 전 상태</p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          {sms.selectedSenderId ? '발신번호 선택됨' : '발신번호 확인 필요'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {sms.images.length > 0 ? `이미지 ${sms.images.length}장 첨부` : '이미지 없음'}
        </p>
      </div>

      {sms.senderNumbersError || sms.recipientsError ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {sms.senderNumbersError || sms.recipientsError}
        </div>
      ) : null}

      <Button className="w-full justify-center gap-2" disabled={!canSend} type="button" onClick={sms.handleSend}>
        <Send className="h-4 w-4" />
        {sms.sending ? '발송 중...' : `${sms.messageType} 발송`}
      </Button>

      <Link
        className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
        href="/settings/notifications"
      >
        <Settings className="h-4 w-4" />
        알림톡 및 SMS 설정
      </Link>
    </aside>
  );
}

function BoardLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link
      className="flex h-9 items-center justify-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
      href={href}
    >
      {icon}
      {label}
    </Link>
  );
}

function Metric({ icon, label, testId, value }: { icon: ReactNode; label: string; testId: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid={testId}>
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-lg font-semibold tracking-normal text-slate-950">{value}</p>
    </div>
  );
}
