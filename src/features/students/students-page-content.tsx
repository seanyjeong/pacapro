'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { StudentFiltersComponent } from '@/components/students/student-filters';
import { StudentStatsCards } from '@/components/students/student-stats-cards';
import { StudentsBranchBar } from '@/features/branches/students-branch-bar';
import { StudentsBulkPlacementBar } from '@/features/branches/students-bulk-placement-bar';
import { useBranchTree } from '@/hooks/use-branches';
import { useStudents } from '@/hooks/use-students';
import { branchesAPI, type StudentPlacement } from '@/lib/api/branches';
import { exportsApi } from '@/lib/api/exports';
import { studentsAPI } from '@/lib/api/students';
import { rememberStudentListReturn } from './student-list-return';
import {
    buildStudentListQuery,
    getActiveFilterLabels,
    getFiltersForTab,
    getNextSort,
    readStudentListState,
    shouldShowStudentFilters,
} from './student-page-utils';
import type { StudentListSort, StudentTab } from './student-page-types';
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
    const writtenQueryRef = useRef(searchParams.toString());
    const [initialState] = useState(() => readStudentListState(new URLSearchParams(searchParams.toString())));

    const [searchQuery, setSearchQuery] = useState(initialState.search);
    const [activeTab, setActiveTab] = useState<StudentTab>(initialState.tab);
    const [sort, setSort] = useState<StudentListSort | null>(initialState.sort);
    const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
    const [excelDownloading, setExcelDownloading] = useState(false);
    const [excelUploading, setExcelUploading] = useState(false);
    const [summaryStats, setSummaryStats] = useState<StudentSummaryStats>(EMPTY_SUMMARY_STATS);

    const { students, loading, error, filters, setFilters, updateFilters, reload } = useStudents(initialState.filters);

    // 지점·반 (지점을 만든 학원만 보인다)
    const branchTree = useBranchTree();
    const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set());
    const [movingStudents, setMovingStudents] = useState(false);
    const placementLabels = useMemo(() => {
        const labels = new Map<string, string>();
        branchTree.branches.forEach((branch) => {
            labels.set(`b:${branch.id}`, branch.name);
            branch.classes.forEach((cls) => labels.set(`c:${cls.id}`, `${branch.name} ${cls.class_name}`));
        });
        return labels;
    }, [branchTree.branches]);

    // 사이드바 등 바깥에서 주소가 바뀌면 그 주소의 목록 상태를 따른다.
    useEffect(() => {
        const query = searchParams.toString();
        if (query === writtenQueryRef.current) return;
        writtenQueryRef.current = query;
        const next = readStudentListState(new URLSearchParams(query));
        setActiveTab(next.tab);
        setSearchQuery(next.search);
        setFilters(next.filters);
        setSort(next.sort);
    }, [searchParams, setFilters]);

    useEffect(() => {
        const query = buildStudentListQuery({ tab: activeTab, search: searchQuery, filters, sort });
        if (query === writtenQueryRef.current) return;
        writtenQueryRef.current = query;
        window.history.replaceState(null, '', query ? `/students?${query}` : '/students');
    }, [activeTab, filters, searchQuery, sort]);

    const handleReload = () => {
        reload();
        setStatsRefreshTrigger((prev) => prev + 1);
    };

    const handleSearch = (query: string) => {
        setSearchQuery(query);
        updateFilters({ search: query });
    };

    // 탭을 바꾸거나 필터를 초기화해도 고른 지점·반은 그대로 둔다.
    const filtersForTab = (tab: StudentTab) => ({
        ...getFiltersForTab(tab),
        branch_id: filters.branch_id,
        class_id: filters.class_id,
    });

    const handleResetFilters = () => {
        setSearchQuery('');
        setFilters(filtersForTab(activeTab));
    };

    const handleTabChange = (tab: StudentTab) => {
        setActiveTab(tab);
        setSearchQuery('');
        setFilters(filtersForTab(tab));
        setSort(null);
        setSelectedIds(new Set());
    };

    const handleMoveStudents = async (placement: StudentPlacement) => {
        setMovingStudents(true);
        try {
            await branchesAPI.assignStudents([...selectedIds], placement, { suppressErrorToast: true });
            toast.success(`학생 ${selectedIds.size}명을 옮겼습니다.`);
            setSelectedIds(new Set());
            reload();
            branchTree.reload();
        } catch {
            toast.error('학생을 옮기지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setMovingStudents(false);
        }
    };

    const placement = branchTree.enabled
        ? {
            labelOf: (student: { branch_id?: number | null; class_id?: number | null }) =>
                placementLabels.get(student.class_id ? `c:${student.class_id}` : `b:${student.branch_id}`) || '-',
            selectedIds,
            onToggle: (id: number) => setSelectedIds((current) => {
                const next = new Set(current);
                if (!next.delete(id)) next.add(id);
                return next;
            }),
            onToggleAll: (ids: number[], checked: boolean) => setSelectedIds(checked ? new Set(ids) : new Set()),
        }
        : undefined;

    const handleSortChange = (key: string) => {
        setSort((current) => getNextSort(current, key));
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
    const showEmptyGuide = !loading && students.length === 0 && !searchQuery && !filters.grade && !filters.student_type && !filters.branch_id;
    const openStudentDetail = (id: number) => {
        rememberStudentListReturn(id);
        router.push(`/students/${id}`);
    };

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

                    {branchTree.enabled && (
                        <StudentsBranchBar
                            branches={branchTree.branches}
                            unassignedCount={branchTree.unassigned.active_count}
                            branchId={filters.branch_id}
                            classId={filters.class_id}
                            onChange={(next) => {
                                updateFilters(next);
                                setSelectedIds(new Set());
                            }}
                        />
                    )}

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

                            {selectedIds.size > 0 && (
                                <StudentsBulkPlacementBar
                                    branches={branchTree.branches}
                                    count={selectedIds.size}
                                    moving={movingStudents}
                                    onMove={handleMoveStudents}
                                    onClear={() => setSelectedIds(new Set())}
                                />
                            )}

                            <StudentsPageList
                                activeTab={activeTab}
                                loading={loading}
                                sort={sort}
                                students={students}
                                onReload={handleReload}
                                onSortChange={handleSortChange}
                                onStudentClick={openStudentDetail}
                                placement={placement}
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
