import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { TopNav } from '@/components/layout/topnav';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
    title: 'P-ACA - 체육입시 학원관리시스템',
    description: 'Professional Athletic College Admission Management System',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko">
            <body className="bg-gray-50">
                <Providers>
                    <div className="flex h-screen overflow-hidden">
                        {/* Sidebar */}
                        <Sidebar />

                        {/* Main Content Area */}
                        <div className="flex-1 flex flex-col md:ml-64">
                            {/* Top Navigation */}
                            <TopNav />

                            {/* Page Content */}
                            <main className="flex-1 overflow-y-auto pt-16">
                                <div className="p-6">
                                    {children}
                                </div>
                            </main>
                        </div>
                    </div>
                </Providers>
            </body>
        </html>
    );
}
