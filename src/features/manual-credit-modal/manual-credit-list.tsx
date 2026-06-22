'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ManualCredit } from './manual-credit-types';
import { CREDIT_STATUS_LABELS, CREDIT_TYPE_LABELS, getCreditStatusClass } from './manual-credit-utils';

interface ManualCreditListProps {
  credits: ManualCredit[];
  loadingCredits: boolean;
  editingCredit: ManualCredit | null;
  editAmount: number;
  editNotes: string;
  processing: boolean;
  onEdit: (credit: ManualCredit) => void;
  onCancelEdit: () => void;
  onEditAmountChange: (value: number) => void;
  onEditNotesChange: (value: string) => void;
  onSaveEdit: () => void;
  onDelete: (credit: ManualCredit) => void;
  onApply: (credit: ManualCredit) => void;
  onClose: () => void;
}

export function ManualCreditList({
  credits,
  loadingCredits,
  editingCredit,
  editAmount,
  editNotes,
  processing,
  onEdit,
  onCancelEdit,
  onEditAmountChange,
  onEditNotesChange,
  onSaveEdit,
  onDelete,
  onApply,
  onClose,
}: ManualCreditListProps) {
  return (
    <>
      <div className="py-6 px-6 space-y-3">
        {loadingCredits ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : credits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            등록된 크레딧이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {credits.map((credit) => (
              <CreditRow
                key={credit.id}
                credit={credit}
                editing={editingCredit?.id === credit.id}
                editAmount={editAmount}
                editNotes={editNotes}
                processing={processing}
                onEdit={onEdit}
                onCancelEdit={onCancelEdit}
                onEditAmountChange={onEditAmountChange}
                onEditNotesChange={onEditNotesChange}
                onSaveEdit={onSaveEdit}
                onDelete={onDelete}
                onApply={onApply}
              />
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </>
  );
}

interface CreditRowProps {
  credit: ManualCredit;
  editing: boolean;
  editAmount: number;
  editNotes: string;
  processing: boolean;
  onEdit: (credit: ManualCredit) => void;
  onCancelEdit: () => void;
  onEditAmountChange: (value: number) => void;
  onEditNotesChange: (value: string) => void;
  onSaveEdit: () => void;
  onDelete: (credit: ManualCredit) => void;
  onApply: (credit: ManualCredit) => void;
}

function CreditRow({
  credit,
  editing,
  editAmount,
  editNotes,
  processing,
  onEdit,
  onCancelEdit,
  onEditAmountChange,
  onEditNotesChange,
  onSaveEdit,
  onDelete,
  onApply,
}: CreditRowProps) {
  return (
    <div className="p-3 border rounded-lg space-y-2">
      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>금액</Label>
            <MoneyInput value={editAmount} onChange={onEditAmountChange} />
          </div>
          <div className="space-y-1">
            <Label>메모</Label>
            <Textarea value={editNotes} onChange={(event) => onEditNotesChange(event.target.value)} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              취소
            </Button>
            <Button size="sm" onClick={onSaveEdit} disabled={processing}>
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : '저장'}
            </Button>
          </div>
        </div>
      ) : (
        <CreditSummary credit={credit} onEdit={onEdit} onDelete={onDelete} onApply={onApply} />
      )}
    </div>
  );
}

function CreditSummary({
  credit,
  onEdit,
  onDelete,
  onApply,
}: {
  credit: ManualCredit;
  onEdit: (credit: ManualCredit) => void;
  onDelete: (credit: ManualCredit) => void;
  onApply: (credit: ManualCredit) => void;
}) {
  const canApply = credit.status === 'pending' || credit.status === 'partial';
  const canEdit = credit.status !== 'used' && credit.status !== 'applied';

  return (
    <>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <span className="font-medium text-lg">
            {credit.credit_amount.toLocaleString()}원
          </span>
          <span className="ml-2 text-xs px-2 py-0.5 rounded bg-muted">
            {CREDIT_TYPE_LABELS[credit.credit_type] || credit.credit_type}
          </span>
          <span className={`ml-1 text-xs px-2 py-0.5 rounded ${getCreditStatusClass(credit.status)}`}>
            {CREDIT_STATUS_LABELS[credit.status] || credit.status}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          {canApply && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={() => onApply(credit)}
            >
              적용
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                aria-label="크레딧 수정"
                size="sm"
                variant="ghost"
                onClick={() => onEdit(credit)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                aria-label="크레딧 삭제"
                size="sm"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
                onClick={() => onDelete(credit)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <CreditMeta credit={credit} />
    </>
  );
}

function CreditMeta({ credit }: { credit: ManualCredit }) {
  return (
    <div className="text-sm text-muted-foreground">
      {credit.rest_start_date && credit.rest_end_date && (
        <div>
          기간: {format(new Date(credit.rest_start_date), 'M/d', { locale: ko })} ~{' '}
          {format(new Date(credit.rest_end_date), 'M/d', { locale: ko })}
          {credit.rest_days > 0 && ` (${credit.rest_days}회)`}
        </div>
      )}
      {credit.notes && (
        <div className="mt-1 text-xs">{credit.notes}</div>
      )}
      <div className="text-xs mt-1">
        생성: {format(new Date(credit.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
      </div>
    </div>
  );
}
