'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { StudentFiltersComponent } from '@/components/students/student-filters';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { useStudents } from '@/hooks/use-students';
import { exportsApi } from '@/lib/api/exports';
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

export function StudentsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const initialTab: StudentTab = isStudentTab(tabParam) ? tabParam : 'active';

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<StudentTab>(initialTab);
    const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
    const [excelDownloading, setExcelDownloading] = useState(false);

    const { students, loading, error, filters, setFilters, updateFilters, reload } = useStudents(getFiltersForTab(initialTab));

    useEffect(() => {
        if (isStudentTab(tabParam)) {
            setActiveTab(tabParam);
        }
    }, [tabParam]);

    useEffect(() => {
        updateFilters(getFiltersForTab(activeTab));
    }, [activeTab, updateFilters]);

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

    if (error && !loading) {
        return <StudentsPageError onRetry={handleReload} />;
    }

    const filterLabels = getActiveFilterLabels(filters);
    const showFilters = shouldShowStudentFilters(activeTab);
    const showEmptyGuide = !loading && students.length === 0 && !searchQuery && !filters.grade && !filters.student_type;

    return (
        <div className="w-full max-w-full space-y-5">
            <StudentsPageHeader
                activeTab={activeTab}
                excelDownloading={excelDownloading}
                onAddStudent={() => router.push('/students/new')}
                onDownloadExcel={handleExcelDownload}
                onReload={handleReload}
            />

            <StudentsStatusTabs activeTab={activeTab} onChange={setActiveTab} />

            <StudentStatsCards refreshTrigger={statsRefreshTrigger} />

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
                onStudentClick={(id) => router.push(`/students/${id}`)}
            />

            {showEmptyGuide && <StudentsEmptyGuide />}
        </div>
    );
}
