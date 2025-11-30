/**
 * Student Performance Component
 * 학생 성적 기록 컴포넌트 - 추후 업데이트 예정
 */

import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';
import type { StudentPerformance } from '@/lib/types/student';

interface StudentPerformanceProps {
  performances: StudentPerformance[];
  loading?: boolean;
}

export function StudentPerformanceComponent({ performances, loading }: StudentPerformanceProps) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Construction className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">추후 업데이트 예정</h3>
        <p className="text-gray-600">
          성적 기록 기능은 현재 개발 중입니다.
          <br />
          빠른 시일 내에 제공될 예정입니다.
        </p>
      </CardContent>
    </Card>
  );
}
