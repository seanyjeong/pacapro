'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TabletPage() {
  const router = useRouter();

  useEffect(() => {
    // 태블릿 메인 페이지 접속 시 출석체크로 리다이렉트
    router.replace('/tablet/attendance');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    </div>
  );
}
