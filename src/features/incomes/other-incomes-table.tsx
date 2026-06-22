import { Banknote, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card className="rounded-lg border-border/70 shadow-none">
      <CardHeader className="border-b border-border/60 px-5 py-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-normal">
          <Banknote className="h-4 w-4" />
          기타 수입 내역
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">날짜</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">카테고리</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">설명</th>
                <th className="px-5 py-3 text-right font-medium text-muted-foreground">금액</th>
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">결제</th>
                {canEdit ? <th className="px-5 py-3 text-right font-medium text-muted-foreground">관리</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incomes.map((income) => (
                <tr
                  key={`other-${income.id}`}
                  className="cursor-pointer hover:bg-muted/35"
                  onClick={() => onSelect(income)}
                >
                  <td className="px-5 py-3 text-muted-foreground">{income.income_date.split('T')[0]}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-md border border-border bg-muted/35 px-2 py-1 text-xs font-medium text-foreground">
                      {CATEGORY_LABELS[income.category] || income.category}
                    </span>
                  </td>
                  <td className="max-w-[260px] truncate px-5 py-3 text-foreground">{income.description || '-'}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums text-foreground">
                    +{formatAmount(income.amount)}원
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[income.payment_method || 'cash']}
                  </td>
                  {canEdit ? (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          aria-label="기타 수입 수정"
                          onClick={() => onEdit(income)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="기타 수입 삭제"
                          onClick={() => onDelete(income.id)}
                          className="rounded-md p-2 text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
