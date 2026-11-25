import type { ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Switch } from '@/components/ui/switch';
import { PAY_TYPE_LABELS, type PayInstallment, type PayRuleForm, type PayType } from './pay-rule-types';
import { formatWon, installmentTotal, nextInstallmentMonth, SLOT_OPTIONS } from './pay-rule-utils';

interface PayRuleFormFieldsProps {
  form: PayRuleForm;
  fixedOnly?: boolean;
  onChange: (form: PayRuleForm) => void;
}

const PAY_TYPES: PayType[] = ['fixed_total', 'per_class', 'daily', 'monthly'];
const moneyClass = 'h-11 rounded-xl border-transparent bg-muted text-[15px] font-semibold tabular-nums';

export function PayRuleFormFields({ form, fixedOnly = false, onChange }: PayRuleFormFieldsProps) {
  const set = <K extends keyof PayRuleForm>(key: K, value: PayRuleForm[K]) => onChange({ ...form, [key]: value });
  const fixed = form.pay_type === 'fixed_total';
  const noDates = !form.start_date && !form.end_date;

  return (
    <div className="space-y-4">
      {fixedOnly ? null : (
        <Field label="급여 방식">
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="급여 방식">
            {PAY_TYPES.map((type) => (
              <Choice key={type} selected={form.pay_type === type} onClick={() => set('pay_type', type)}>{PAY_TYPE_LABELS[type]}</Choice>
            ))}
          </div>
        </Field>
      )}

      <Field label="규칙 이름" htmlFor="pay-rule-memo">
        <Input id="pay-rule-memo" maxLength={200} placeholder="예: 정시 시즌" value={form.memo} onChange={(event) => set('memo', event.target.value)} />
      </Field>

      <Field label={fixed ? '총액' : `${PAY_TYPE_LABELS[form.pay_type]} 금액`} htmlFor="pay-rule-amount">
        <MoneyInput id="pay-rule-amount" className={moneyClass} value={form.amount} onChange={(value) => set('amount', value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="시작하는 날 (비워도 됨)" htmlFor="pay-rule-start">
          <Input id="pay-rule-start" type="date" value={form.start_date} onChange={(event) => set('start_date', event.target.value)} />
        </Field>
        <Field label="끝나는 날 (비워도 됨)" htmlFor="pay-rule-end">
          <Input id="pay-rule-end" type="date" value={form.end_date} onChange={(event) => set('end_date', event.target.value)} />
        </Field>
      </div>
      <p className="break-keep text-[13px] text-muted-foreground">
        {fixed
          ? noDates
            ? '날짜가 없으면 출근 계산은 그대로 두고 아래 달에 금액만 더해요.'
            : '이 기간의 출근은 횟수·단가 계산에서 빠져요.'
          : noDates ? '날짜가 없으면 이번 달 1일부터 계속 이 규칙을 따라요.' : '이 기간의 출근은 기본 급여 대신 이 규칙을 따라요.'}
      </p>

      {fixed && noDates ? null : (
        <Field label="적용 시간대">
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="적용 시간대">
            {SLOT_OPTIONS.map((slot) => {
              const selected = form.time_slots.includes(slot.value);
              return (
                <Choice key={slot.value} selected={selected} onClick={() => set('time_slots', selected ? form.time_slots.filter((item) => item !== slot.value) : [...form.time_slots, slot.value])}>
                  {slot.label}
                </Choice>
              );
            })}
          </div>
        </Field>
      )}

      {fixed ? (
        <>
          <Installments form={form} onChange={(installments) => set('installments', installments)} />
          <label className="flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3 text-sm" htmlFor="pay-rule-taxable">
            <span className="font-semibold text-foreground">세금 계산에 넣기</span>
            <Switch id="pay-rule-taxable" checked={form.taxable} onCheckedChange={(value) => set('taxable', value)} />
          </label>
        </>
      ) : null}
    </div>
  );
}

function Installments({ form, onChange }: { form: PayRuleForm; onChange: (items: PayInstallment[]) => void }) {
  const total = installmentTotal(form);
  const update = (index: number, patch: Partial<PayInstallment>) => onChange(form.installments.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <Field label="나눠 줄 달과 금액">
      <div className="space-y-2">
        {form.installments.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input aria-label={`${index + 1}번째 지급 달`} type="month" className="min-w-0 flex-1" value={item.pay_year_month} onChange={(event) => update(index, { pay_year_month: event.target.value })} />
            <div className="min-w-0 flex-1">
              <MoneyInput aria-label={`${index + 1}번째 지급 금액`} className={moneyClass} value={item.amount} onChange={(amount) => update(index, { amount })} />
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label={`${index + 1}번째 지급 삭제`} onClick={() => onChange(form.installments.filter((_, i) => i !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" className="w-full" onClick={() => onChange([...form.installments, { pay_year_month: nextInstallmentMonth(form), amount: Math.max(form.amount - total, 0) }])}>
          <Plus className="h-4 w-4" />
          지급 달 추가
        </Button>
        <p className="break-keep text-[13px] text-muted-foreground">
          달은 급여 명세서의 달(일한 달)이에요. 다음 달에 급여를 주는 학원이 1월 급여일에 줄 돈이면 12월을 고르세요.
        </p>
        {form.amount > 0 && total !== form.amount ? (
          <p className="rounded-xl bg-warning/10 px-4 py-2.5 text-[13px] text-foreground" data-testid="pay-rule-mismatch">
            나눈 합계 {formatWon(total)}이 총액 {formatWon(form.amount)}과 달라요.
          </p>
        ) : null}
      </div>
    </Field>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      {htmlFor
        ? <label className="mb-1.5 block text-[13px] font-semibold text-secondary-foreground" htmlFor={htmlFor}>{label}</label>
        : <p className="mb-1.5 text-[13px] font-semibold text-secondary-foreground">{label}</p>}
      {children}
    </div>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`h-11 rounded-xl px-2 text-[14px] font-semibold transition ${selected ? 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50' : 'bg-muted text-secondary-foreground hover:text-foreground'}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
