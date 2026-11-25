import { Edit3, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PAY_TYPE_LABELS, type PayRule } from './pay-rule-types';
import { formatMonth, formatPeriod, formatSlots, formatWon, payRuleTitle } from './pay-rule-utils';

interface PayRuleListProps {
  rules: PayRule[];
  showInstructor?: boolean;
  emptyText: string;
  onEdit: (rule: PayRule) => void;
  onDelete: (rule: PayRule) => void;
}

export function PayRuleList({ rules, showInstructor = false, emptyText, onEdit, onDelete }: PayRuleListProps) {
  if (rules.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <ul className="divide-y divide-border/60">
      {rules.map((rule) => {
        const name = showInstructor ? rule.instructor_name : payRuleTitle(rule);
        return (
          <li key={rule.id} className="flex items-start justify-between gap-3 py-3.5" data-testid="pay-rule-row">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[15px] font-bold text-foreground">{name}</span>
                <Badge variant="secondary">{PAY_TYPE_LABELS[rule.pay_type]}</Badge>
                {rule.pay_type === 'fixed_total' && !rule.taxable ? <Badge variant="secondary">세금 제외</Badge> : null}
              </div>
              <p className="mt-1 text-[17px] font-extrabold tabular-nums text-foreground">{formatWon(rule.amount)}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {formatPeriod(rule)}{rule.pay_type === 'fixed_total' && !rule.start_date && !rule.end_date ? '' : ` · ${formatSlots(rule.time_slots)}`}
              </p>
              {rule.installments.length > 0 ? (
                <p className="mt-1 text-[13px] tabular-nums text-secondary-foreground">
                  {rule.installments.map((item) => `${formatMonth(item.pay_year_month)} ${formatWon(item.amount)}`).join(' · ')}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon" aria-label={`${name} 규칙 수정`} onClick={() => onEdit(rule)}><Edit3 className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`${name} 규칙 삭제`} onClick={() => onDelete(rule)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
