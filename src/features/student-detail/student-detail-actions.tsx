import {
  Banknote,
  CalendarCog,
  CalendarCheck,
  CalendarDays,
  GraduationCap,
  MessageSquareText,
  Pencil,
  ReceiptText,
  RotateCcw,
  Send,
  Trash2,
  UserMinus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudentDetail } from '@/lib/types/student';
import type { StudentDetailAction, StudentDetailTab } from './student-detail-types';
import { formatWon, getClassSummary } from './student-detail-utils';

interface StudentDetailActionsProps {
  canGraduate: boolean;
  canResume: boolean;
  canWithdraw: boolean;
  outstandingAmount: number;
  paymentCount: number;
  student: StudentDetail;
  unpaidPaymentCount: number;
  onEdit: () => void;
  onOpenClassDays: () => void;
  onOpenAction: (action: StudentDetailAction) => void;
  onOpenTab: (tab: StudentDetailTab) => void;
  onResume: () => void;
  onSendSms: () => void;
}

interface ActionButton {
  description: string;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone?: 'danger' | 'primary';
}

export function StudentDetailActions({
  canGraduate,
  canResume,
  canWithdraw,
  outstandingAmount,
  paymentCount,
  student,
  unpaidPaymentCount,
  onEdit,
  onOpenClassDays,
  onOpenAction,
  onOpenTab,
  onResume,
  onSendSms,
}: StudentDetailActionsProps) {
  const hasOutstanding = outstandingAmount > 0;
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
      description: '요일별 수업일과 시간대를 바로 바꿉니다.',
      icon: CalendarCog,
      label: '수업일 변경',
      onClick: onOpenClassDays,
      tone: 'primary',
    },
    {
      description: '학부모 번호를 선택한 개별 문자 작성 화면으로 이동합니다.',
      icon: Send,
      label: '문자 발송',
      onClick: onSendSms,
    },
    {
      description: `${paymentCount}건의 청구와 납부 상태를 확인합니다.`,
      icon: ReceiptText,
      label: '납부 내역',
      onClick: () => onOpenTab('payments'),
    },
    {
      description: '이번 달 출결과 보강 여부를 확인합니다.',
      icon: CalendarCheck,
      label: '출결 현황',
      onClick: () => onOpenTab('attendance'),
    },
    {
      description: '학생 상담 이력과 후속 메모를 확인합니다.',
      icon: MessageSquareText,
      label: '상담 기록',
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
    <section className="rounded-md border border-border bg-card" data-testid="student-detail-operations-board">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Student Workboard</p>
        <h2 className="mt-1 text-sm font-semibold text-foreground">학생 작업 보드</h2>
        <p className="mt-1 text-xs text-muted-foreground">{student.name} 학생에게 필요한 처리 메뉴를 한곳에 모았습니다.</p>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid gap-2">
          <BoardRow
            helper={hasOutstanding ? `${unpaidPaymentCount}건의 미납 또는 분납이 있습니다.` : '현재 확인할 미납이 없습니다.'}
            label="미납 관리"
            value={hasOutstanding ? formatWon(outstandingAmount) : '정상'}
            warn={hasOutstanding}
          />
          <BoardRow helper="요일과 시간대를 변경할 수 있습니다." label="수업 기준" value={getClassSummary(student)} />
          <BoardRow
            helper={student.parent_phone ? '학부모 번호로 바로 발송합니다.' : '학부모 연락처를 먼저 확인해 주세요.'}
            label="연락"
            value={student.parent_phone || student.phone || '연락처 없음'}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">바로 처리</p>
          <ActionGrid actions={primaryActions} />
        </div>

        <div className="border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">상태 변경</p>
          <ActionGrid actions={statusActions} compact />
        </div>
      </div>
    </section>
  );
}

function ActionGrid({ actions, compact = false }: { actions: ActionButton[]; compact?: boolean }) {
  return (
    <div className={compact ? 'grid gap-2' : 'grid gap-2'}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            aria-label={action.label}
            className={[
              'h-auto min-h-12 justify-start gap-3 px-3 py-3 text-left',
              action.tone === 'danger' ? 'text-rose-700 hover:text-rose-800' : '',
            ].join(' ')}
            type="button"
            variant={action.tone === 'primary' ? 'default' : 'outline'}
            onClick={action.onClick}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{action.label}</span>
              <span
                className={`mt-0.5 block whitespace-normal text-xs font-normal leading-5 ${
                  action.tone === 'primary' ? 'text-primary-foreground/85' : 'text-muted-foreground'
                }`}
              >
                {action.description}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function BoardRow({
  helper,
  label,
  value,
  warn = false,
}: {
  helper: string;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
        </div>
        <p className={`text-sm font-semibold ${warn ? 'text-amber-700' : 'text-foreground'}`}>{value}</p>
      </div>
    </div>
  );
}
