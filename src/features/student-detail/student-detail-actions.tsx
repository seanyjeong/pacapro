import {
  CalendarCog,
  CalendarDays,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { StudentDetailAction } from './student-detail-types';

interface StudentDetailActionsProps {
  canGraduate: boolean;
  canResume: boolean;
  canWithdraw: boolean;
  unpaidPaymentCount: number;
  onEdit: () => void;
  onOpenClassDays: () => void;
  onOpenAction: (action: StudentDetailAction) => void;
  onResume: () => void;
  onSendSms: () => void;
}

// 학생 요약 아래 주요 동작. 자주 쓰는 것은 버튼으로, 상태 변경은 '더보기'에 모은다.
export function StudentDetailActions({
  canGraduate,
  canResume,
  canWithdraw,
  unpaidPaymentCount,
  onEdit,
  onOpenClassDays,
  onOpenAction,
  onResume,
  onSendSms,
}: StudentDetailActionsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" data-testid="student-detail-operations-board">
      <Button aria-label="정보 수정" type="button" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
        정보 수정
      </Button>
      <Button aria-label="수업일 변경" type="button" variant="secondary" onClick={onOpenClassDays}>
        <CalendarCog className="h-4 w-4" />
        수업일 변경
      </Button>
      <Button aria-label="문자 발송" type="button" variant="outline" onClick={onSendSms}>
        <Send className="h-4 w-4" />
        문자 발송
      </Button>
      {canResume ? (
        <Button aria-label="복귀 처리" type="button" variant="outline" onClick={onResume}>
          <RotateCcw className="h-4 w-4" />
          복귀 처리
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label="학생 동작 더보기" type="button" variant="outline">
            <MoreHorizontal className="h-4 w-4" />
            더보기
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[14rem]">
          <DropdownMenuItem className="gap-2" aria-label="수업/학원비 변경" onSelect={onEdit}>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            수업/학원비 변경
          </DropdownMenuItem>
          {canGraduate ? (
            <DropdownMenuItem className="gap-2" aria-label="졸업 처리" onSelect={() => onOpenAction('graduate')}>
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              졸업 처리
            </DropdownMenuItem>
          ) : null}
          {canWithdraw ? (
            <DropdownMenuItem className="gap-2" aria-label="퇴원 처리" onSelect={() => onOpenAction('withdraw')}>
              <UserMinus className="h-4 w-4 text-muted-foreground" />
              <span className="min-w-0">
                퇴원 처리
                {unpaidPaymentCount > 0 ? (
                  <span className="block text-xs text-warning">미납 {unpaidPaymentCount}건 확인 필요</span>
                ) : null}
              </span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" aria-label="삭제" onSelect={() => onOpenAction('delete')}>
            <Trash2 className="h-4 w-4" />
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
