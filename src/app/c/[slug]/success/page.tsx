'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, Phone, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getConsultationPageInfo } from '@/lib/api/consultations';

export default function ConsultationSuccessPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [academyName, setAcademyName] = useState<string>('');

  // 학원 이름 가져와서 타이틀 설정
  useEffect(() => {
    const loadAcademyName = async () => {
      try {
        const info = await getConsultationPageInfo(slug);
        if (info?.academy?.name) {
          setAcademyName(info.academy.name);
          document.title = `${info.academy.name} - 상담 신청 완료`;
        }
      } catch {
        // 실패해도 무시
      }
    };
    loadAcademyName();

    return () => {
      document.title = 'P-ACA - 체육입시 학원관리시스템';
    };
  }, [slug]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">
          상담 신청이 완료되었습니다
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          담당자가 확인 후 연락드리겠습니다.
          <br />
          감사합니다.
        </p>

        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm space-y-2">
          <div className="flex items-center gap-2 text-gray-600">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span>신청하신 일정을 확인해 드립니다</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <Phone className="h-4 w-4 text-gray-400" />
            <span>빠른 시일 내에 연락드리겠습니다</span>
          </div>
        </div>

        <Button
          onClick={() => window.location.href = `/c/${slug}`}
          variant="outline"
          className="w-full"
        >
          처음으로 돌아가기
        </Button>
      </div>
    </div>
  );
}
