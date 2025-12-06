'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Calendar, Phone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function ConsultationSuccessPage() {
  const params = useParams();
  const slug = params.slug as string;

  return (
    <div className="max-w-md mx-auto text-center space-y-6">
      {/* 성공 아이콘 */}
      <div className="flex justify-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
      </div>

      {/* 메시지 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          상담 신청이 완료되었습니다!
        </h1>
        <p className="text-gray-600">
          빠른 시간 내에 연락드리겠습니다.
        </p>
      </div>

      {/* 안내 카드 */}
      <Card className="text-left">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">상담 일정 확인</p>
              <p className="text-sm text-gray-500">
                신청하신 일정은 확정 후 문자로 안내드립니다.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-gray-900">연락 안내</p>
              <p className="text-sm text-gray-500">
                입력하신 연락처로 상담 확정 안내를 드립니다.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 버튼 */}
      <div className="pt-4">
        <Link href={`/c/${slug}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </Button>
        </Link>
      </div>
    </div>
  );
}
