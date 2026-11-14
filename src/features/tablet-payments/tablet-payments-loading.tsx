export function TabletPaymentsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4" role="status" aria-label="결제 정보 불러오는 중">
      <div className="space-y-2 pt-2">
        <div className="h-8 w-56 rounded-xl bg-card" />
        <div className="h-4 w-32 rounded-lg bg-card" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl bg-card" />)}
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-card" />
    </div>
  );
}
