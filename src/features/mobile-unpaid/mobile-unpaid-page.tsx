'use client';

import { RefreshCw } from 'lucide-react';
import { BranchChecks } from '@/features/branches/branch-checks';
import { useBranchTree } from '@/hooks/use-branches';
import { MobileIconButton, MobileLoading, MobileScreen } from '../mobile-home/mobile-screen';
import { MobileUnpaidFilters } from './mobile-unpaid-filters';
import { getMobileUnpaidHeading } from './mobile-unpaid-header';
import { MobileUnpaidList } from './mobile-unpaid-list';
import { MobileUnpaidPaySheet } from './mobile-unpaid-pay-sheet';
import { MobileUnpaidSummary } from './mobile-unpaid-summary';
import { useMobileUnpaidState } from './use-mobile-unpaid-state';

export function MobileUnpaidPage() {
  const state = useMobileUnpaidState();
  const { branches } = useBranchTree();

  if (state.hasPermission === null) {
    return <MobileLoading />;
  }

  const heading = getMobileUnpaidHeading(state.scope, state.selectedMonth, state.dayName);

  return (
    <MobileScreen
      testId="mobile-unpaid-workspace"
      title={<span aria-live="polite">{heading.title}</span>}
      description={heading.description}
      actions={(
        <MobileIconButton label="미납 목록 새로고침" onClick={state.reload} disabled={state.loading}>
          <RefreshCw className={`h-5 w-5 ${state.loading ? 'animate-spin' : ''}`} />
        </MobileIconButton>
      )}
    >
      <MobileUnpaidFilters
        query={state.query}
        scope={state.scope}
        selectedMonth={state.selectedMonth}
        onMonthChange={state.setSelectedMonth}
        onQueryChange={state.setQuery}
        onScopeChange={state.setScope}
      />
      <BranchChecks branches={branches} selected={state.branchIds} onChange={state.setBranchIds} />
      {!state.loading && !state.loadError && (
        <MobileUnpaidSummary canViewAmount={state.canViewAmount} stats={state.stats} />
      )}
      <MobileUnpaidList
        canMarkPaid={state.canMarkPaid}
        canViewAmount={state.canViewAmount}
        dayName={state.dayName}
        error={state.loadError}
        loading={state.loading}
        payments={state.filteredPayments}
        processing={state.processing}
        query={state.query}
        scope={state.scope}
        selectedMonth={state.selectedMonth}
        totalCount={state.stats.count}
        onCall={state.callPaymentContact}
        onPay={state.openPaySheet}
        onRetry={state.reload}
      />

      <MobileUnpaidPaySheet
        canViewAmount={state.canViewAmount}
        paySheet={state.paySheet}
        processing={state.processing}
        onCancel={() => state.setPaySheet(null)}
        onConfirm={state.confirmPayment}
        onMethodChange={state.setPaymentMethod}
      />
    </MobileScreen>
  );
}
