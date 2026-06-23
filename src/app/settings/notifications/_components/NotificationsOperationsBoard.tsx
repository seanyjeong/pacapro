'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { BellRing, CheckCircle2, Radio, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TemplateType } from '../_types';
import type { useNotificationSettings } from '../_hooks/useNotificationSettings';

type NotificationState = ReturnType<typeof useNotificationSettings>;

interface Props {
  state: NotificationState;
}

const TEMPLATE_ACTIONS: Array<{ type: TemplateType; label: string; ariaLabel: string }> = [
  { type: 'unpaid', label: '미납', ariaLabel: '미납 템플릿 열기' },
  { type: 'consultation', label: '상담', ariaLabel: '상담확정 템플릿 열기' },
  { type: 'trial', label: '체험', ariaLabel: '체험수업 템플릿 열기' },
  { type: 'overdue', label: '재안내', ariaLabel: '미납 재안내 템플릿 열기' },
  { type: 'reminder', label: '리마인드', ariaLabel: '리마인드 템플릿 열기' },
  { type: 'attendance', label: '출결관리', ariaLabel: '출결관리 템플릿 열기' },
];

export default function NotificationsOperationsBoard({ state }: Props) {
  const serviceLabel = state.activeTab === 'solapi' ? '솔라피' : '네이버 SENS';
  const isEnabled = state.activeTab === 'solapi' ? state.settings.solapi_enabled : state.settings.is_enabled;
  const activeTemplate = state.activeTab === 'solapi' ? state.activeTemplate : state.activeSensTemplate;

  const openTemplate = (type: TemplateType) => {
    if (state.activeTab === 'solapi') state.setActiveTemplate(type);
    else state.setActiveSensTemplate(type);
  };

  return (
    <aside
      aria-label="알림톡 작업 보드"
      className="space-y-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="notifications-operations-board"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">Notification Desk</p>
        <h2 className="text-lg font-semibold tracking-normal text-slate-950">알림톡 작업 보드</h2>
        <p className="text-sm text-slate-600">발송 채널, 템플릿, 테스트 위치를 빠르게 전환합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric icon={<Radio className="h-4 w-4" />} label="채널" testId="notifications-board-metric-service" value={serviceLabel} />
        <Metric
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="상태"
          testId="notifications-board-metric-status"
          value={isEnabled ? '발송 가능' : '비활성'}
        />
        <Metric icon={<BellRing className="h-4 w-4" />} label="발신" testId="notifications-board-metric-senders" value={`${state.senderNumbers.length}개`} />
        <Metric icon={<Send className="h-4 w-4" />} label="내역" testId="notifications-board-metric-logs" value={`${state.logs.length}건`} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={state.activeTab === 'sens' ? 'default' : 'outline'} onClick={() => state.handleServiceTypeChange('sens')}>
          네이버 SENS
        </Button>
        <Button type="button" variant={state.activeTab === 'solapi' ? 'default' : 'outline'} onClick={() => state.handleServiceTypeChange('solapi')}>
          솔라피
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {TEMPLATE_ACTIONS.map((item) => (
          <Button
            key={item.type}
            aria-label={item.ariaLabel}
            type="button"
            variant={activeTemplate === item.type ? 'default' : 'outline'}
            onClick={() => openTemplate(item.type)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {state.loadErrors.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          준비 정보 일부를 불러오지 못했습니다. 저장 전 설정을 확인해주세요.
        </div>
      ) : null}

      <Button className="w-full justify-center gap-2" disabled={state.saving} type="button" onClick={state.handleSave}>
        <Save className="h-4 w-4" />
        {state.saving ? '저장 중' : '설정 저장'}
      </Button>

      <Link
        className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/20"
        href="/sms"
      >
        <Send className="h-4 w-4" />
        문자 보내기
      </Link>
    </aside>
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
