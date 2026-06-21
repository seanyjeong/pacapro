import { Download, Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StudentTab } from './student-page-types';

interface StudentsPageHeaderProps {
    activeTab: StudentTab;
    excelDownloading: boolean;
    onAddStudent: () => void;
    onDownloadExcel: () => void;
    onReload: () => void;
}

export function StudentsPageHeader({
    activeTab,
    excelDownloading,
    onAddStudent,
    onDownloadExcel,
    onReload,
}: StudentsPageHeaderProps) {
    return (
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
                <div className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">PACA Student Desk</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal text-foreground">학생 운영</h1>
                <p className="mt-1 text-sm text-muted-foreground">등록, 상태, 학교, 후속 관리를 한 화면에서 확인합니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" className="gap-2" onClick={onReload}>
                    <RefreshCw className="h-4 w-4" />
                    새로고침
                </Button>
                <Button variant="outline" className="gap-2" onClick={onDownloadExcel} disabled={excelDownloading}>
                    {excelDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {excelDownloading ? '다운로드 중' : '엑셀'}
                </Button>
                <Button className="gap-2" onClick={onAddStudent}>
                    <Plus className="h-4 w-4" />
                    {activeTab === 'trial' ? '체험생 등록' : '학생 등록'}
                </Button>
            </div>
        </header>
    );
}
