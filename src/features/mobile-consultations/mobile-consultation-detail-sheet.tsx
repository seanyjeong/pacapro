import { Check, Clock, GraduationCap, Loader2, Phone, School, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { MobileSheet } from '../mobile-home/mobile-screen';
import { CONSULTATION_STATUS_META, CONSULTATION_STATUS_ORDER } from './mobile-consultations-constants';
import { formatGrade, formatTime } from './mobile-consultations-utils';

interface MobileConsultationDetailSheetProps {
  consultation: Consultation | null;
  showStatusChange: boolean;
  updatingStatus: boolean;
  onClose: () => void;
  onStatusChange: (consultation: Consultation, status: ConsultationStatus) => void;
  onToggleStatusChange: () => void;
}

function DetailRow({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-secondary-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-muted-foreground">{label}</span>
        <span className={cn('block truncate text-[15px] font-semibold', href ? 'text-primary' : 'text-foreground')}>{value}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className="flex min-h-14 items-center gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-muted">
        {content}
      </a>
    );
  }

  return <div className="flex min-h-14 items-center gap-3 px-1 py-2">{content}</div>;
}

export function MobileConsultationDetailSheet({
  consultation,
  showStatusChange,
  updatingStatus,
  onClose,
  onStatusChange,
  onToggleStatusChange,
}: MobileConsultationDetailSheetProps) {
  if (!consultation) return null;
  const status = CONSULTATION_STATUS_META[consultation.status];

  return (
    <MobileSheet
      title={consultation.student_name}
      description={`${formatTime(consultation.preferred_time)} 상담`}
      closeLabel="상담 정보 닫기"
      onClose={onClose}
      onOverlayClick={onClose}
      testId="mobile-consultation-detail-sheet"
    >
      <section className="rounded-2xl bg-muted p-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={status.badgeVariant} className="px-3 py-1 text-sm">{status.label}</Badge>
          <Button type="button" variant="ghost" size="sm" className="bg-card" onClick={onToggleStatusChange}>
            {showStatusChange ? '닫기' : '상태변경'}
          </Button>
        </div>

        {showStatusChange && (
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {CONSULTATION_STATUS_ORDER.map((item) => {
              const meta = CONSULTATION_STATUS_META[item];
              const selected = consultation.status === item;
              return (
                <button
                  type="button"
                  key={item}
                  disabled={updatingStatus || selected}
                  onClick={() => onStatusChange(consultation, item)}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[13px] font-semibold transition-colors',
                    selected ? 'bg-primary text-primary-foreground' : 'bg-card text-secondary-foreground',
                    updatingStatus && 'opacity-60'
                  )}
                >
                  {updatingStatus && !selected ? <Loader2 className="h-3 w-3 animate-spin" /> : selected ? <Check className="h-3 w-3" /> : <span className={`h-2 w-2 rounded-full ${meta.dotClassName}`} />}
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="divide-y divide-border/60">
        <DetailRow icon={<User className="h-5 w-5" />} label="이름" value={consultation.student_name} />
        <DetailRow icon={<Clock className="h-5 w-5" />} label="상담 시간" value={formatTime(consultation.preferred_time)} />
        {consultation.student_phone && (
          <DetailRow icon={<Phone className="h-5 w-5" />} label="학생 전화번호" value={consultation.student_phone} href={`tel:${consultation.student_phone}`} />
        )}
        {consultation.parent_phone && (
          <DetailRow icon={<Phone className="h-5 w-5" />} label="연락처" value={consultation.parent_phone} href={`tel:${consultation.parent_phone}`} />
        )}
        {consultation.student_school && <DetailRow icon={<School className="h-5 w-5" />} label="학교" value={consultation.student_school} />}
        {consultation.student_grade && <DetailRow icon={<GraduationCap className="h-5 w-5" />} label="학년" value={formatGrade(consultation.student_grade)} />}
      </section>

      {consultation.inquiry_content && (
        <section className="rounded-2xl bg-muted p-4">
          <p className="text-[13px] font-semibold text-muted-foreground">문의 내용</p>
          <p className="mt-1 whitespace-pre-wrap text-[15px] text-foreground">{consultation.inquiry_content}</p>
        </section>
      )}
    </MobileSheet>
  );
}
