import type { Metadata } from 'next';
import '../globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: '상담 예약',
  description: '학원 상담 예약 페이지'
};

export default function PublicLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen">
        <Providers>
          <div className="min-h-screen flex flex-col">
            <main className="flex-1 w-full max-w-lg mx-auto px-4 py-6 sm:py-8">
              {children}
            </main>
            <footer className="py-4 text-center text-xs text-gray-400">
              Powered by P-ACA
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
