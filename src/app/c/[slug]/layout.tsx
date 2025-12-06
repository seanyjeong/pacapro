import { Metadata } from 'next';

export const metadata: Metadata = {
  title: '상담 예약',
  description: '학원 상담 예약 페이지'
};

export default function ConsultationPublicLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="bg-gray-100 border-t py-4 text-center text-sm text-gray-500">
        Powered by P-ACA
      </footer>
    </div>
  );
}
