import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { LayoutWrapper } from '@/components/layout/layout-wrapper';
import { DynamicManifest } from '@/components/dynamic-manifest';
import { DynamicTitle } from '@/components/dynamic-title';

export const metadata: Metadata = {
    title: 'P-ACA - 체육입시 학원관리시스템',
    description: 'Professional Athletic College Admission Management System',
    icons: {
        icon: [
            { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
            { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        apple: [
            { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
            { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        ],
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ko" suppressHydrationWarning>
            <body className="bg-background text-foreground font-sans antialiased">
                <Providers>
                    <DynamicManifest />
                    <DynamicTitle />
                    <LayoutWrapper>
                        {children}
                    </LayoutWrapper>
                </Providers>
            </body>
        </html>
    );
}
