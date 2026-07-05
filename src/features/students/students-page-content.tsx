'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { StudentFiltersComponent } from '@/components/students/student-filters';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { useStudents } from '@/hooks/use-students';
import { exportsApi } from '@/lib/api/exports';
import { studentsAPI } from '@/lib/api/students';
import {
    getActiveFilterLabels,
    getFiltersForTab,
    isStudentTab,
    shouldShowStudentFilters,
} from './student-page-utils';
import type { StudentTab } from './student-page-types';
import { StudentsEmptyGuide } from './students-empty-guide';
import { StudentsPageError } from './students-page-error';
import { StudentsPageHeader } from './students-page-header';
import { StudentsPageList } from './students-page-list';
import { StudentsResultsToolbar } from './students-results-toolbar';
import { StudentsStatusTabs } from './students-status-tabs';
import { StudentsWorkQueue } from './students-work-queue';

interface StudentSummaryStats {
    active: number;
    paused: number;
    pending: number;
    total: number;
    trial: number;
}

const EMPTY_SUMMARY_STATS: StudentSummaryStats = {
    active: 0,
    paused: 0,
    pending: 0,
    total: 0,
    trial: 0,
};

export function StudentsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const excelUploadInputRef = useRef<HTMLInputElement>(null);
    const tabParam = searchParams.get('tab');
    const initialTab: StudentTab = isStudentTab(tabParam) ? tabParam : 'active';

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<StudentTab>(initialTab);
    const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
    const [excelDownloading, setExcelDownloading] = useState(false);
    const [excelUploading, setExcelUploading] = useState(false);
    const [summaryStats, setSummaryStats] = useState<StudentSummaryStats>(EMPTY_SUMMARY_STATS);

    const { students, loading, error, filters, setFilters, updateFilters, reload } = useStudents(getFiltersForTab(initialTab));

    useEffect(() => {
        if (isStudentTab(tabParam)) {
            setActiveTab(tabParam);
            setSearchQuery('');
            setFilters(getFiltersForTab(tabParam));
        }
    }, [setFilters, tabParam]);

    const handleReload = () => {
        reload();
        setStatsRefreshTrigger((prev) => prev + 1);
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        updateFilters({ search: query });
    };

    const handleResetFilters = () => {
        setSearchQuery('');
        setFilters(getFiltersForTab(activeTab));
    };

    const handleTabChange = (tab: StudentTab) => {
        setActiveTab(tab);
        setSearchQuery('');
        setFilters(getFiltersForTab(tab));
    };

    const handleExcelDownload = async () => {
        setExcelDownloading(true);
        try {
            await exportsApi.downloadStudents();
            toast.success('학생 명단 엑셀을 다운로드했습니다.');
        } catch {
            toast.error('학생 명단 엑셀을 다운로드하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setExcelDownloading(false);
        }
    };

    const handleExcelUploadClick = () => {
        excelUploadInputRef.current?.click();
    };

    const handleExcelUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.xlsx')) {
            toast.error('엑셀 파일은 .xlsx 형식으로 업로드해주세요.');
            return;
        }

        setExcelUploading(true);
        try {
            const response = await studentsAPI.importStudents(file, { suppressErrorToast: true });
            const { created, skipped, failed } = response.summary;
            toast.success(`학생 엑셀 업로드 완료: 신규 ${created}명, 중복 ${skipped}명, 실패 ${failed}명`);
            if (failed > 0) {
                toast.warning('등록하지 못한 행이 있습니다. 이름과 연락처가 입력되어 있는지 확인해주세요.');
            }
            handleReload();
        } catch {
            toast.error('학생 엑셀 업로드를 완료하지 못했습니다. 학생명단 엑셀 양식인지 확인해주세요.');
        } finally {
            setExcelUploading(false);
        }
    };

    const filterLabels = getActiveFilterLabels(filters);
    const showFilters = shouldShowStudentFilters(activeTab);
    const showEmptyGuide = !loading && students.length === 0 && !searchQuery && !filters.grade && !filters.student_type;
    const openStudentDetail = (id: number) => router.push(`/students/${id}`);

    return (
        <div className="w-full max-w-full space-y-5" data-testid="students-operations-workspace">
            <StudentsPageHeader
                activeTab={activeTab}
                excelDownloading={excelDownloading}
                excelUploading={excelUploading}
                onAddStudent={() => router.push('/students/new')}
                onDownloadExcel={handleExcelDownload}
                onReload={handleReload}
                onUploadExcel={handleExcelUploadClick}
            />
            <input
                ref={excelUploadInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleExcelUpload}
            />

            {error && !loading ? (
                <StudentsPageError onRetry={handleReload} />
            ) : (
                <>
                    <StudentsStatusTabs activeTab={activeTab} onChange={handleTabChange} />

                    <StudentStatsCards refreshTrigger={statsRefreshTrigger} onStatsLoaded={setSummaryStats} />

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="order-2 min-w-0 space-y-5 xl:order-1">
                            {showFilters && (
                                <StudentFiltersComponent
                                    filters={filters}
                                    onFilterChange={updateFilters}
                                    hideStatusFilter
                                    onReset={handleResetFilters}
                                />
                            )}

                            <StudentsResultsToolbar
                                count={students.length}
                                filterLabels={filterLabels}
                                searchQuery={searchQuery}
                                onSearch={handleSearch}
                            />

                            <StudentsPageList
                                activeTab={activeTab}
                                loading={loading}
                                students={students}
                                onReload={handleReload}
                                onStudentClick={openStudentDetail}
                            />

                            {showEmptyGuide && <StudentsEmptyGuide />}
                        </div>

                        <aside className="order-1 min-w-0 xl:order-2">
                            <StudentsWorkQueue
                                activeTab={activeTab}
                                currentCount={students.length}
                                stats={summaryStats}
                                students={students}
                                onAddStudent={() => router.push('/students/new')}
                                onTabChange={handleTabChange}
                                onStudentClick={openStudentDetail}
                            />
                        </aside>
                    </div>
                </>
            )}
        </div>
    );
}
