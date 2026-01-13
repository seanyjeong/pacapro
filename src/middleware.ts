import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';
  const pathname = request.nextUrl.pathname;

  // 로그인 페이지, API, 정적 파일, 공개 페이지는 스킵
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/c/') ||        // 상담 예약 공개 페이지
    pathname.startsWith('/consultation') || // 상담 예약
    pathname.startsWith('/register') ||
    pathname.startsWith('/reset-password') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // PC 모드 강제 쿠키 확인
  const forcePC = request.cookies.get('force_pc_mode')?.value === 'true';

  // 태블릿 감지 (아이뮤즈 L11 포함)
  // iPad, 아이뮤즈(IMUZ, im-h091), 삼성 태블릿(SM-T), Android 태블릿
  const isTablet = /iPad|IMUZ|im-h\d|H091|SM-T\d|GT-P\d|Tab|tablet/i.test(ua) ||
    (/Android/i.test(ua) && !/Mobile/i.test(ua));

  // PC 모드 강제 시 리다이렉트 안 함
  if (forcePC) {
    return NextResponse.next();
  }

  // 태블릿 사용자가 PC 경로에 접근하면 태블릿 버전으로 리다이렉트
  if (isTablet) {
    // 이미 tablet 경로면 스킵
    if (pathname.startsWith('/tablet')) {
      return NextResponse.next();
    }

    // 루트 경로면 태블릿 대시보드로
    if (pathname === '/') {
      return NextResponse.redirect(new URL('/tablet', request.url));
    }

    // 태블릿에서 지원하는 경로 매핑
    const tabletRoutes: Record<string, string> = {
      '/schedules': '/tablet/attendance',
      '/students': '/tablet/students',
      '/payments': '/tablet/payments',
    };

    // 매핑된 경로가 있으면 해당 경로로 리다이렉트
    for (const [pcRoute, tabletRoute] of Object.entries(tabletRoutes)) {
      if (pathname.startsWith(pcRoute)) {
        return NextResponse.redirect(new URL(tabletRoute, request.url));
      }
    }

    // 그 외 경로는 태블릿 대시보드로
    return NextResponse.redirect(new URL('/tablet', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
