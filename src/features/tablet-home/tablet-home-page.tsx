'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, SectionCard } from '@/components/ui/page';
import { TABLET_HOME_ACTIONS } from './tablet-home-actions';
import { TabletHomeActionGrid } from './tablet-home-action-grid';
import {
  canUseTabletHomeAction,
  getTabletHomeAcademyName,
  getTabletHomeDateLabel,
  getTabletHomeUser,
} from './tablet-home-utils';
import type { TabletHomeUser } from './tablet-home-types';

export function TabletHomePage() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<TabletHomeUser | null>(null);

  useEffect(() => {
    setUser(getTabletHomeUser());
    setMounted(true);
  }, []);

  const visibleActions = useMemo(
    () => mounted ? TABLET_HOME_ACTIONS.filter((action) => canUseTabletHomeAction(action, user)) : [],
    [mounted, user]
  );
  const priorityActions = visibleActions.filter((action) => action.priority);
  const secondaryActions = visibleActions.filter((action) => !action.priority);
  const academyName = mounted ? getTabletHomeAcademyName(user) : 'P-ACA';
  const dateLabel = mounted ? getTabletHomeDateLabel() : '오늘';

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <PageHeader
        title="태블릿 운영 홈"
        description={`${dateLabel} · ${academyName}의 출석, 학생, 결제, 상담 업무를 바로 시작해요.`}
        actions={(
          <span className="flex items-center gap-2.5 rounded-2xl bg-card px-3 py-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
              {(user?.name || '사용자').charAt(0)}
            </span>
            <span className="text-sm">
              <span className="block font-semibold text-foreground">{user?.name || '사용자'}</span>
              <span className="block text-xs text-muted-foreground">{academyName}</span>
            </span>
          </span>
        )}
      />

      <TabletHomeActionGrid actions={priorityActions} title="오늘 빠른 업무" />
      <TabletHomeActionGrid actions={secondaryActions} title="전체 업무" />

      <SectionCard title="업무 흐름">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <FlowItem title="학생 기준" body="학생을 먼저 열면 상세, 결제, 문자, 수업 정보를 이어서 처리해요." />
          <FlowItem title="오늘 기준" body="출석과 스케줄에서 오늘 수업 운영을 먼저 정리해요." />
          <FlowItem title="상담 기준" body="상담예약에서 상담 진행, 연결 학생, 후속 문자를 확인해요." />
        </div>
      </SectionCard>
    </div>
  );
}

function FlowItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl bg-muted px-4 py-3.5">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}
