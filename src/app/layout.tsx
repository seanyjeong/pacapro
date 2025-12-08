import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { LayoutWrapper } from '@/components/layout/layout-wrapper';
import { DynamicManifest } from '@/components/dynamic-manifest';
import { PWAInstallPrompt } from '@/components/pwa-install-prompt';

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
                    <DynamicManifest />
                    <PWAInstallPrompt />
                    <LayoutWrapper>
                        {children}
                    </LayoutWrapper>
                </Providers>
            </body>
        </html>
    );
}
