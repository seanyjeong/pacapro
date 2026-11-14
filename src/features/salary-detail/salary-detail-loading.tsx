import { SalaryDetailTitleBar } from './salary-detail-header';

interface SalaryDetailLoadingProps {
  onBack: () => void;
}

export function SalaryDetailLoading({ onBack }: SalaryDetailLoadingProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-4" aria-busy="true">
      <SalaryDetailTitleBar onBack={onBack} />
      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-16 rounded-xl bg-muted" />
          ))}
        </div>
      </section>
      <section className="rounded-2xl bg-card p-5 sm:p-6">
        <div className="h-6 w-32 rounded-lg bg-muted" />
        <div className="mt-4 h-40 rounded-xl bg-muted/70" />
      </section>
    </div>
  );
}
