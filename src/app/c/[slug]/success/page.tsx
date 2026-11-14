'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CalendarCheck2, CheckCircle2, MessageSquareText, PhoneCall } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { getConsultationPageInfo } from '@/lib/api/consultations';

export default function ConsultationSuccessPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [academyName, setAcademyName] = useState('');

  useEffect(() => {
    const loadAcademyName = async () => {
      try {
        const info = await getConsultationPageInfo(slug);
        if (info?.academy?.name) {
          setAcademyName(info.academy.name);
          document.title = `${info.academy.name} - 상담 신청 완료`;
        }
      } catch {
        document.title = '상담 신청 완료';
      }
    };

    void loadAcademyName();

    return () => {
      document.title = 'P-ACA - 체육입시 학원관리시스템';
    };
  }, [slug]);

  return (
    <section
      className="mx-auto w-full max-w-xl space-y-4 text-foreground"
      data-testid="consultation-success-workspace"
    >
      <div className="flex flex-col items-center rounded-2xl bg-card px-5 pb-8 pt-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <p className="mt-5 text-[13px] font-semibold text-muted-foreground">상담 안내 데스크</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-foreground">상담 신청이 완료되었습니다</h1>
        <p className="mt-3 max-w-sm text-[15px] leading-6 text-secondary-foreground">
          {academyName || '담당 학원'}에서 신청 내용을 확인한 뒤 입력하신 연락처로 상담 일정을 안내드려요.
        </p>
      </div>

      <div className="rounded-2xl bg-card px-5 py-2">
        <div className="divide-y divide-border/60">
          <SuccessNote icon={<CalendarCheck2 className="h-5 w-5" />} title="일정 확인" text="선택한 날짜와 시간은 담당자가 한 번 더 확인해요." />
          <SuccessNote icon={<PhoneCall className="h-5 w-5" />} title="연락 안내" text="연락처 오류가 있으면 예약 페이지에서 다시 신청해주세요." />
          <SuccessNote icon={<MessageSquareText className="h-5 w-5" />} title="문의 내용" text="남겨주신 상담 내용은 담당자가 먼저 확인해요." />
        </div>
      </div>

      <div className="rounded-2xl bg-card p-5">
        <p className="text-[13px] font-semibold text-muted-foreground">{academyName || '상담 예약'}</p>
        <h2 className="mt-1 text-[17px] font-bold tracking-tight text-foreground">담당자 확인 대기 중</h2>
        <p className="mt-1.5 text-sm leading-6 text-secondary-foreground">
          접수 내용은 학원 운영 화면에 저장되었어요. 추가 확인이 필요하면 담당자가 직접 연락드려요.
        </p>
        <p className="mt-4 rounded-xl bg-success-soft px-4 py-3 text-sm leading-6 text-success">
          같은 정보로 다시 신청하지 않아도 돼요. 일정 변경이 필요하면 학원 연락을 기다린 뒤 조율해주세요.
        </p>
      </div>

      <Link href={`/c/${slug}`} className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}>
        <ArrowLeft className="h-4 w-4" />
        예약 페이지로 돌아가기
      </Link>
    </section>
  );
}

interface SuccessNoteProps {
  icon: ReactNode;
  text: string;
  title: string;
}

function SuccessNote({ icon, text, title }: SuccessNoteProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{text}</span>
      </span>
    </div>
  );
}
