import {
  Banknote,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  MessageSquareText,
  Pencil,
  ReceiptText,
  RotateCcw,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudentDetail } from '@/lib/types/student';
import type { StudentDetailAction, StudentDetailTab } from './student-detail-types';

interface StudentDetailActionsProps {
  canGraduate: boolean;
  canResume: boolean;
  canWithdraw: boolean;
  paymentCount: number;
  student: StudentDetail;
  unpaidPaymentCount: number;
  onEdit: () => void;
  onOpenAction: (action: StudentDetailAction) => void;
  onOpenTab: (tab: StudentDetailTab) => void;
  onResume: () => void;
}

interface ActionButton {
  description: string;
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  tone?: 'danger';
}

export function StudentDetailActions({
  canGraduate,
  canResume,
  canWithdraw,
  paymentCount,
  student,
  unpaidPaymentCount,
  onEdit,
  onOpenAction,
  onOpenTab,
  onResume,
}: StudentDetailActionsProps) {
  const primaryActions: ActionButton[] = [
    {
      description: '기본 정보와 연락처를 수정합니다.',
      icon: Pencil,
      label: '정보 수정',
      onClick: onEdit,
    },
    {
      description: '요일, 시간대, 등록일, 학원비 기준을 조정합니다.',
      icon: CalendarDays,
      label: '수업/학원비 변경',
      onClick: onEdit,
    },
    {
      description: `${paymentCount}건의 청구와 납부 상태를 확인합니다.`,
      icon: ReceiptText,
      label: '납부 내역 보기',
      onClick: () => onOpenTab('payments'),
    },
    {
      description: '이번 달 출결과 보강 여부를 확인합니다.',
      icon: CalendarCheck,
      label: '출결 확인',
      onClick: () => onOpenTab('attendance'),
    },
    {
      description: '학생 상담 이력과 후속 메모를 확인합니다.',
      icon: MessageSquareText,
      label: '상담 기록 보기',
      onClick: () => onOpenTab('consultations'),
    },
  ];

  if (student.student_type === 'exam') {
    primaryActions.push({
      description: '시즌 등록, 결제 상태, 등록 취소 흐름을 봅니다.',
      icon: Banknote,
      label: '시즌 등록 보기',
      onClick: () => onOpenTab('seasons'),
    });
  }

  const statusActions: ActionButton[] = [];
  if (canResume) {
    statusActions.push({
      description: '휴원 종료일과 복귀일 기준으로 복귀 처리합니다.',
      icon: RotateCcw,
      label: '복귀 처리',
      onClick: onResume,
    });
  }
  if (canGraduate) {
    statusActions.push({
      description: '재원 상태를 졸업으로 변경합니다.',
      icon: GraduationCap,
      label: '졸업 처리',
      onClick: () => onOpenAction('graduate'),
    });
  }
  if (canWithdraw) {
    statusActions.push({
      description: unpaidPaymentCount > 0 ? `미납 ${unpaidPaymentCount}건을 확인하고 퇴원 처리합니다.` : '퇴원 사유를 남기고 상태를 변경합니다.',
      icon: UserMinus,
      label: '퇴원 처리',
      onClick: () => onOpenAction('withdraw'),
    });
  }
  statusActions.push({
    description: '학생 기록을 목록에서 제거합니다.',
    icon: Trash2,
    label: '삭제',
    onClick: () => onOpenAction('delete'),
    tone: 'danger',
  });

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">운영 액션</h2>
        <p className="mt-1 text-xs text-muted-foreground">학생 상세에서 바로 처리할 수 있는 작업입니다.</p>
      </div>
      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_340px]">
        <ActionGrid actions={primaryActions} />
        <div className="border-t border-border pt-3 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">상태 변경</p>
          <ActionGrid actions={statusActions} compact />
        </div>
      </div>
    </section>
  );
}

function ActionGrid({ actions, compact = false }: { actions: ActionButton[]; compact?: boolean }) {
  return (
    <div className={compact ? 'grid gap-2' : 'grid gap-2 sm:grid-cols-2 xl:grid-cols-3'}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            aria-label={action.label}
            className={`h-auto justify-start gap-3 px-3 py-3 text-left ${action.tone === 'danger' ? 'text-rose-700 hover:text-rose-800' : ''}`}
            type="button"
            variant="outline"
            onClick={action.onClick}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{action.label}</span>
              <span className="mt-0.5 block whitespace-normal text-xs font-normal leading-5 text-muted-foreground">
                {action.description}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
