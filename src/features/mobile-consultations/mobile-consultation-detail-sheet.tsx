import { Check, Clock, GraduationCap, Loader2, Phone, School, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">{value}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        {content}
      </a>
    );
  }

  return <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">{content}</div>;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55" onClick={onClose}>
      <div
        className="max-h-[86vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white pb-8 shadow-2xl dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
        data-testid="mobile-consultation-detail-sheet"
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        <div className="space-y-4 px-5 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-zinc-950 dark:text-zinc-50">{consultation.student_name}</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatTime(consultation.preferred_time)} 상담</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="상담 정보 닫기">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-2">
              <span className={`rounded-full border px-3 py-1 text-sm font-medium ${status.className}`}>{status.label}</span>
              <Button type="button" variant="outline" size="sm" onClick={onToggleStatusChange}>
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
                      className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 text-xs font-medium transition
                        ${selected ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950' : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300'}
                        ${updatingStatus ? 'opacity-60' : ''}`}
                    >
                      {updatingStatus && !selected ? <Loader2 className="h-3 w-3 animate-spin" /> : selected ? <Check className="h-3 w-3" /> : <span className={`h-2 w-2 rounded-full ${meta.dotClassName}`} />}
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="space-y-2">
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
            <section className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">문의 내용</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-100">{consultation.inquiry_content}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
