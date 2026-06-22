'use client';

import { useEffect, useMemo, useState } from 'react';
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
      <section className="rounded-md border border-border bg-background p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{dateLabel}</p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">태블릿 운영 홈</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {academyName}의 출석, 학생, 결제, 상담 업무를 빠르게 시작합니다.
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-sm">
            <p className="font-semibold text-foreground">{user?.name || '사용자'}</p>
            <p className="text-xs text-muted-foreground">{academyName}</p>
          </div>
        </div>
      </section>

      <TabletHomeActionGrid actions={priorityActions} title="오늘 빠른 업무" />
      <TabletHomeActionGrid actions={secondaryActions} title="전체 업무" />

      <section className="rounded-md border border-border bg-background p-4">
        <h2 className="text-base font-semibold text-foreground">업무 흐름</h2>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
          <FlowItem title="학생 기준" body="학생을 먼저 열면 상세, 결제, 문자, 수업 정보를 이어서 처리합니다." />
          <FlowItem title="오늘 기준" body="출석과 스케줄에서 오늘 수업 운영을 먼저 정리합니다." />
          <FlowItem title="상담 기준" body="상담예약에서 상담 진행, 연결 학생, 후속 문자를 확인합니다." />
        </div>
      </section>
    </div>
  );
}

function FlowItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-3">
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}
