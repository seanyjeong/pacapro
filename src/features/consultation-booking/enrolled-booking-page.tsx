'use client';

import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertCircle, CalendarCheck2, CheckCircle2, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { submitEnrolledConsultation, verifyEnrolledStudent } from '@/lib/api/consultations';
import { LEARNING_TYPE_LABELS, type ConsultationPageInfo, type LearningType, type TimeSlot } from '@/lib/types/consultation';
import { cn } from '@/lib/utils/cn';
import { fetchBookingPageInfo, fetchBookingSlots } from './booking-api';
import { BOOKING_PAGE_ERROR, BOOKING_SLOTS_ERROR, BOOKING_SUBMIT_ERROR, formatPhoneNumber } from './booking-constants';
import { BookingError } from './booking-error';
import { BookingLoading } from './booking-loading';
import { BookingScheduleStep } from './booking-schedule-step';
import { BookingStepper } from './booking-stepper';
import { BookingActionBar, BookingCard } from './booking-ui';

const fieldClass = 'h-12 w-full min-w-0 rounded-xl border border-transparent bg-muted px-4 text-base text-foreground transition-colors focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10';
const learningTypes = Object.keys(LEARNING_TYPE_LABELS) as LearningType[];
// 우선 일산만 연다(서버 routes/public/enrolledConsultation.js 의 목록과 같게 둔다).
const ENABLED_ACADEMY_SLUGS = ['imaxnew'];

/** 재원생 상담 신청: 이름·전화번호로 재원생 확인 → 신규 상담과 같은 시간표에서 시간 선택 → 신청(원장님 확인 전까지 대기). */
export function EnrolledBookingPage() {
  const params = useParams();
  const slug = params.slug as string;

  if (!ENABLED_ACADEMY_SLUGS.includes(slug)) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center" data-testid="enrolled-booking-closed">
        <div className="flex flex-col items-center rounded-2xl bg-card px-5 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
            <AlertCircle className="h-6 w-6" />
          </span>
          <p className="mt-4 text-[15px] font-semibold text-foreground">재원생 상담 신청을 받지 않는 학원입니다.</p>
        </div>
      </div>
    );
  }

  return <EnrolledBookingForm slug={slug} />;
}

function EnrolledBookingForm({ slug }: { slug: string }) {
  const [pageInfo, setPageInfo] = useState<ConsultationPageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [learningType, setLearningType] = useState<LearningType>('regular');
  const [inquiryContent, setInquiryContent] = useState('');
  const [infoError, setInfoError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reloadPageInfo = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setPageInfo(await fetchBookingPageInfo(slug));
    } catch {
      setPageInfo(null);
      setLoadError(BOOKING_PAGE_ERROR);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    reloadPageInfo();
  }, [reloadPageInfo]);

  useEffect(() => {
    if (!pageInfo?.academy?.name) return undefined;
    document.title = `${pageInfo.academy.name} - 재원생 상담 신청`;
    return () => {
      document.title = 'P-ACA - 체육입시 학원관리시스템';
    };
  }, [pageInfo?.academy?.name]);

  const selectDate = async (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const response = await fetchBookingSlots(slug, format(date, 'yyyy-MM-dd'));
      setSlots(response.slots || []);
    } catch {
      setSlots([]);
      setSlotsError(BOOKING_SLOTS_ERROR);
    } finally {
      setSlotsLoading(false);
    }
  };

  const goToSchedule = async () => {
    if (!studentName.trim()) return setInfoError('학생 이름을 입력해주세요.');
    if (phone.replace(/\D/g, '').length !== 11) return setInfoError('전화번호 11자리를 정확히 입력해주세요.');
    setVerifying(true);
    setInfoError(null);
    try {
      await verifyEnrolledStudent(slug, { studentName: studentName.trim(), phone });
      setStep(2);
    } catch (error) {
      setInfoError(error instanceof Error ? error.message : BOOKING_SUBMIT_ERROR);
    } finally {
      setVerifying(false);
    }
  };

  const goToConfirm = () => {
    if (!selectedDate || !selectedTime) {
      setSlotsError('상담 일정을 선택해주세요.');
      return;
    }
    setSubmitError(null);
    setStep(3);
  };

  const submit = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitEnrolledConsultation(slug, {
        studentName: studentName.trim(),
        phone,
        learningType,
        inquiryContent: inquiryContent.trim(),
        preferredDate: format(selectedDate, 'yyyy-MM-dd'),
        preferredTime: selectedTime,
      });
      setDone(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : BOOKING_SUBMIT_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <BookingLoading />;
  if (loadError || !pageInfo) {
    return <BookingError message={loadError ?? BOOKING_PAGE_ERROR} onRetry={reloadPageInfo} />;
  }

  if (done && selectedDate) {
    return (
      <main className="mx-auto w-full min-w-0 max-w-xl space-y-4" data-testid="enrolled-booking-done">
        <div className="flex flex-col items-center rounded-2xl bg-card px-5 pb-8 pt-10 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h1 className="mt-5 text-[26px] font-extrabold leading-tight tracking-tight text-foreground">상담 신청이 완료되었습니다</h1>
          <p className="mt-2 text-lg font-bold tabular-nums text-foreground">
            {format(selectedDate, 'M월 d일 (EEEE)', { locale: ko })} {selectedTime}
          </p>
          <p className="mt-3 max-w-sm text-[15px] leading-6 text-secondary-foreground">
            원장님이 확인한 뒤 상담이 확정돼요. 일정이 바뀌면 학원에서 연락드려요.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-xl space-y-5" data-testid="enrolled-booking-workspace">
      <header className="pt-2">
        <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-foreground sm:text-[28px]">
          {pageInfo.academy.name} 재원생 상담 신청
        </h1>
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">학원에 등록된 학생 이름과 전화번호(학생 또는 학부모)를 입력해주세요.</p>
      </header>
      <BookingStepper step={step} />

      {step === 1 && (
        <div className="space-y-4">
          <BookingCard title="학생 확인">
            <div className="space-y-4">
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-secondary-foreground">
                학생 이름 *
                <input className={fieldClass} value={studentName} onChange={(event) => { setStudentName(event.target.value); setInfoError(null); }} />
              </label>
              <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-secondary-foreground">
                전화번호 (학생 또는 학부모) *
                <input
                  className={fieldClass}
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => { setPhone(formatPhoneNumber(event.target.value)); setInfoError(null); }}
                />
              </label>
            </div>
          </BookingCard>

          <BookingCard title="상담 내용">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="상담 종류">
                {learningTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={learningType === type}
                    className={cn(
                      'h-12 rounded-xl text-[15px] font-semibold transition-colors',
                      learningType === type ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground hover:bg-primary-soft hover:text-primary'
                    )}
                    onClick={() => setLearningType(type)}
                  >
                    {LEARNING_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
              <label className="grid gap-1.5 text-sm font-semibold text-secondary-foreground">
                하고 싶은 이야기 (선택)
                <Textarea className="min-h-28 text-base" value={inquiryContent} onChange={(event) => setInquiryContent(event.target.value)} />
              </label>
            </div>
          </BookingCard>

          <BookingActionBar error={infoError}>
            <Button className="w-full" size="lg" onClick={goToSchedule} disabled={verifying}>
              {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
              다음: 일정 선택
            </Button>
          </BookingActionBar>
        </div>
      )}

      {step === 2 && (
        <BookingScheduleStep
          currentMonth={currentMonth}
          onBack={() => setStep(1)}
          onMonthChange={setCurrentMonth}
          onNext={goToConfirm}
          onSelectDate={selectDate}
          onSelectTime={setSelectedTime}
          pageInfo={pageInfo}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          slots={slots}
          slotsError={slotsError}
          slotsLoading={slotsLoading}
        />
      )}

      {step === 3 && selectedDate && (
        <div className="space-y-4">
          <section className="flex items-center gap-4 rounded-2xl bg-primary-soft p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-card text-primary">
              <CalendarCheck2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-primary">상담 일정</p>
              <p className="mt-0.5 text-lg font-extrabold tracking-tight text-foreground tabular-nums">
                {format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })} {selectedTime}
              </p>
            </div>
          </section>

          <BookingCard title="신청 내용 확인">
            <dl className="divide-y divide-border/60">
              <SummaryItem label="학생" value={studentName.trim()} />
              <SummaryItem label="전화번호" value={phone} />
              <SummaryItem label="상담 종류" value={LEARNING_TYPE_LABELS[learningType]} />
            </dl>
            {inquiryContent.trim() && (
              <p className="mt-4 whitespace-pre-wrap rounded-xl bg-muted px-4 py-3 text-sm leading-6 text-secondary-foreground">
                {inquiryContent.trim()}
              </p>
            )}
          </BookingCard>

          <BookingActionBar error={submitError}>
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <Button size="lg" variant="outline" onClick={() => setStep(2)}>이전</Button>
              <Button size="lg" onClick={submit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                상담 신청하기
              </Button>
            </div>
          </BookingActionBar>
        </div>
      )}
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-[15px]">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-foreground">{value || '-'}</dd>
    </div>
  );
}
