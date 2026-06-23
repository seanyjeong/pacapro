import { Banknote, Eye, Pencil, Trash2 } from 'lucide-react';
import { CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from './incomes-constants';
import type { OtherIncome } from './incomes-types';
import { formatAmount } from './incomes-utils';

interface OtherIncomesTableProps {
  incomes: OtherIncome[];
  canEdit: boolean;
  onSelect: (income: OtherIncome) => void;
  onEdit: (income: OtherIncome) => void;
  onDelete: (id: number) => void;
}

export function OtherIncomesTable({ incomes, canEdit, onSelect, onEdit, onDelete }: OtherIncomesTableProps) {
  return (
    <section className="rounded-md border border-border bg-card shadow-none" aria-label="기타 수입 내역">
      <div className="flex items-center gap-2 border-b border-border/70 px-5 py-4">
        <Banknote className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">기타 수입 내역</h2>
      </div>

      <div className="space-y-3 p-3 2xl:hidden">
        {incomes.map((income) => (
          <article
            key={`other-${income.id}`}
            className="rounded-md border border-border bg-background p-4 text-left transition-colors hover:bg-muted/35"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{income.description || '-'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{income.income_date.split('T')[0]}</p>
              </div>
              <p className="shrink-0 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                +{formatAmount(income.amount)}원
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">카테고리</p>
                <span className="mt-1 inline-flex rounded-md border border-border bg-muted/35 px-2 py-1 text-xs font-medium text-foreground">
                  {CATEGORY_LABELS[income.category] || income.category}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">결제</p>
                <p className="mt-1 text-foreground">{PAYMENT_METHOD_LABELS[income.payment_method || 'cash']}</p>
              </div>
            </div>

            {income.notes ? (
              <p className="mt-4 rounded-md bg-muted/35 px-3 py-2 text-xs text-muted-foreground">{income.notes}</p>
            ) : null}

            <div className="mt-4 border-t border-border/70 pt-3">{renderIncomeActions(income, canEdit, onSelect, onEdit, onDelete)}</div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto 2xl:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">날짜</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">카테고리</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">설명</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">금액</th>
              <th className="px-5 py-3 text-left font-medium text-muted-foreground">결제</th>
              <th className="px-5 py-3 text-right font-medium text-muted-foreground">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {incomes.map((income) => (
              <tr
                key={`other-${income.id}`}
                className="transition-colors hover:bg-muted/35"
              >
                <td className="px-5 py-3 text-muted-foreground">{income.income_date.split('T')[0]}</td>
                <td className="px-5 py-3">
                  <span className="rounded-md border border-border bg-muted/35 px-2 py-1 text-xs font-medium text-foreground">
                    {CATEGORY_LABELS[income.category] || income.category}
                  </span>
                </td>
                <td className="max-w-[260px] truncate px-5 py-3 text-foreground">{income.description || '-'}</td>
                <td className="px-5 py-3 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                  +{formatAmount(income.amount)}원
                </td>
                <td className="px-5 py-3 text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[income.payment_method || 'cash']}
                </td>
                <td className="px-5 py-3">{renderIncomeActions(income, canEdit, onSelect, onEdit, onDelete)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderIncomeActions(
  income: OtherIncome,
  canEdit: boolean,
  onSelect: (income: OtherIncome) => void,
  onEdit: (income: OtherIncome) => void,
  onDelete: (id: number) => void
) {
  const description = income.description || '선택한 기타수입';

  return (
    <div className="flex flex-wrap justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`${description} 기타수입 상세 보기`}
        onClick={() => onSelect(income)}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <Eye className="h-3.5 w-3.5" />
        상세
      </button>
      {canEdit ? (
        <>
          <button
            type="button"
            aria-label="기타 수입 수정"
            onClick={() => onEdit(income)}
            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="기타 수입 삭제"
            onClick={() => onDelete(income.id)}
            className="rounded-md p-2 text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 dark:text-red-300 dark:hover:bg-red-950/35"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}
