import { Banknote, Eye, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
    <section aria-label="기타 수입 내역">
      <div className="flex items-center gap-2 px-4 pb-1 pt-4 sm:px-6">
        <Banknote className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[15px] font-bold text-foreground">기타 수입 내역</h2>
      </div>

      <div className="divide-y divide-border/60 lg:hidden">
        {incomes.map((income) => (
          <article
            key={`other-${income.id}`}
            className="px-4 py-4 text-left sm:px-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-foreground">{income.description || '-'}</p>
                <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">{income.income_date.split('T')[0]}</p>
              </div>
              <p className="shrink-0 text-base font-bold tabular-nums text-success">
                +{formatAmount(income.amount)}원
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <Badge variant="secondary">{CATEGORY_LABELS[income.category] || income.category}</Badge>
              <span>{PAYMENT_METHOD_LABELS[income.payment_method || 'cash']}</span>
            </div>

            {income.notes ? (
              <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-[13px] text-secondary-foreground">{income.notes}</p>
            ) : null}

            <div className="mt-3">{renderIncomeActions(income, canEdit, onSelect, onEdit, onDelete)}</div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto px-6 pb-2 lg:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-[13px] font-semibold text-muted-foreground">
              <th className="px-3 py-3 text-left">날짜</th>
              <th className="px-3 py-3 text-left">카테고리</th>
              <th className="px-3 py-3 text-left">설명</th>
              <th className="px-3 py-3 text-right">금액</th>
              <th className="px-3 py-3 text-left">결제</th>
              <th className="px-3 py-3 text-right">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {incomes.map((income) => (
              <tr
                key={`other-${income.id}`}
                className="transition-colors hover:bg-muted/50"
              >
                <td className="px-3 py-3.5 text-muted-foreground">{income.income_date.split('T')[0]}</td>
                <td className="px-3 py-3.5">
                  <Badge variant="secondary">{CATEGORY_LABELS[income.category] || income.category}</Badge>
                </td>
                <td className="max-w-[260px] truncate px-5 py-3 text-foreground">{income.description || '-'}</td>
                <td className="px-3 py-3.5 text-right text-[15px] font-bold tabular-nums text-success">
                  +{formatAmount(income.amount)}원
                </td>
                <td className="px-3 py-3.5 text-muted-foreground">
                  {PAYMENT_METHOD_LABELS[income.payment_method || 'cash']}
                </td>
                <td className="px-3 py-3.5">{renderIncomeActions(income, canEdit, onSelect, onEdit, onDelete)}</td>
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
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-secondary px-3 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
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
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="기타 수입 삭제"
            onClick={() => onDelete(income.id)}
            className="rounded-lg p-2 text-destructive hover:bg-destructive-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}
