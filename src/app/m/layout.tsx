import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  applicationName: 'P-ACA 모바일',
  title: 'P-ACA 모바일 - 출석체크',
  description: '체육입시 학원관리시스템 모바일 출석체크',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'P-ACA',
  },
  formatDetection: {
    telephone: true,
  },
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-slate-900">
      {children}
    </div>
  );
}
