import Link from 'next/link';
import { CalendarDays, ClipboardList, Download, Loader2, MessageSquareText, MoreHorizontal, Plus, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page';
import type { StudentTab } from './student-page-types';

interface StudentsPageHeaderProps {
    activeTab: StudentTab;
    excelDownloading: boolean;
    excelUploading: boolean;
    onAddStudent: () => void;
    onDownloadExcel: () => void;
    onReload: () => void;
    onUploadExcel: () => void;
}

const QUICK_LINKS = [
    { href: '/students/class-days', label: '수업일 관리', icon: CalendarDays },
    { href: '/consultations/enrolled', label: '상담 관리', icon: ClipboardList },
    { href: '/sms', label: '문자 발송', icon: MessageSquareText },
];

export function StudentsPageHeader({
    activeTab,
    excelDownloading,
    excelUploading,
    onAddStudent,
    onDownloadExcel,
    onReload,
    onUploadExcel,
}: StudentsPageHeaderProps) {
    return (
        <PageHeader
            title="학생 운영"
            description="등록·상태·학교·후속 관리를 한 화면에서 봐요."
            actions={(
                <>
                    <Button variant="outline" size="icon" onClick={onReload} title="새로고침" aria-label="새로고침">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={onDownloadExcel} disabled={excelDownloading}>
                        {excelDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {excelDownloading ? '다운로드 중' : '엑셀'}
                    </Button>
                    <Button variant="outline" onClick={onUploadExcel} disabled={excelUploading}>
                        {excelUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {excelUploading ? '업로드 중' : '업로드'}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" title="바로 가기" aria-label="바로 가기">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {QUICK_LINKS.map((link) => (
                                <DropdownMenuItem key={link.href} asChild>
                                    <Link href={link.href} className="gap-2">
                                        <link.icon className="h-4 w-4 text-muted-foreground" />
                                        {link.label}
                                    </Link>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={onAddStudent}>
                        <Plus className="h-4 w-4" />
                        {activeTab === 'trial' ? '체험생 등록' : '학생 등록'}
                    </Button>
                </>
            )}
        />
    );
}
