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
      className="space-y-4 text-slate-950"
      data-testid="consultation-success-workspace"
    >
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-normal text-slate-500">상담 안내 데스크</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">상담 신청이 완료되었습니다</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {academyName || '담당 학원'}에서 신청 내용을 확인한 뒤 입력하신 연락처로 상담 일정을 안내드립니다.
        </p>
      </div>

      <div className="grid gap-2 text-sm text-slate-700">
        <SuccessNote icon={<CalendarCheck2 className="h-4 w-4" />} title="일정 확인" text="선택한 날짜와 시간은 담당자가 한 번 더 확인합니다." />
        <SuccessNote icon={<PhoneCall className="h-4 w-4" />} title="연락 안내" text="연락처 오류가 있으면 예약 페이지에서 다시 신청해주세요." />
        <SuccessNote icon={<MessageSquareText className="h-4 w-4" />} title="문의 내용" text="남겨주신 상담 내용은 담당자가 먼저 확인합니다." />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-sm font-medium text-slate-500">{academyName || '상담 예약'}</p>
          <h2 className="mt-2 text-lg font-semibold tracking-normal text-slate-950">담당자 확인 대기 중</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            접수 내용은 학원 운영 화면에 저장되었습니다. 추가 확인이 필요하면 담당자가 직접 연락드립니다.
          </p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
            같은 정보로 다시 신청하지 않아도 됩니다. 일정 변경이 필요하면 학원 연락을 기다린 뒤 조율해주세요.
          </div>
          <Link href={`/c/${slug}`} className={buttonVariants({ variant: 'outline', className: 'w-full gap-2' })}>
            <ArrowLeft className="h-4 w-4" />
            예약 페이지로 돌아가기
          </Link>
        </div>
      </div>
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
    <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">{icon}</span>
      <span className="min-w-0">
        <span className="block font-medium text-slate-950">{title}</span>
        <span className="mt-0.5 block text-slate-500">{text}</span>
      </span>
    </div>
  );
}
