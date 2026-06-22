'use client';

import { MobileUnpaidHeader } from './mobile-unpaid-header';
import { MobileUnpaidList } from './mobile-unpaid-list';
import { MobileUnpaidPaySheet } from './mobile-unpaid-pay-sheet';
import { MobileUnpaidSummary } from './mobile-unpaid-summary';
import { useMobileUnpaidState } from './use-mobile-unpaid-state';

export function MobileUnpaidPage() {
  const state = useMobileUnpaidState();

  if (state.hasPermission === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-950">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50" data-testid="mobile-unpaid-workspace">
      <MobileUnpaidHeader
        dayName={state.dayName}
        loading={state.loading}
        query={state.query}
        onBack={() => state.router.push('/m')}
        onQueryChange={state.setQuery}
        onRefresh={state.reload}
      />

      <main className="mx-auto w-full max-w-md space-y-4 px-4 py-4 pb-10">
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
          totalCount={state.stats.count}
          onCall={state.callPaymentContact}
          onPay={state.openPaySheet}
          onRetry={state.reload}
        />
      </main>

      <MobileUnpaidPaySheet
        canViewAmount={state.canViewAmount}
        paySheet={state.paySheet}
        processing={state.processing}
        onCancel={() => state.setPaySheet(null)}
        onConfirm={state.confirmPayment}
        onMethodChange={state.setPaymentMethod}
      />
    </div>
  );
}
