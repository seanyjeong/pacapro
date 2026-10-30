import { PendingStudentList } from '@/components/students/pending-student-list';
import { SchoolStudentList } from '@/components/students/school-student-list';
import { StudentListTable } from '@/components/students/student-list-table';
import { TrialStudentList } from '@/components/students/trial-student-list';
import type { Student } from '@/lib/types/student';
import type { StudentListSort, StudentTab } from './student-page-types';
import { StudentsMobileList } from './students-mobile-list';

interface StudentsPageListProps {
    activeTab: StudentTab;
    loading: boolean;
    sort: StudentListSort | null;
    students: Student[];
    onReload: () => void;
    onSortChange: (key: string) => void;
    onStudentClick: (id: number) => void;
}

export function StudentsPageList({
    activeTab,
    loading,
    sort,
    students,
    onReload,
    onSortChange,
    onStudentClick,
}: StudentsPageListProps) {
    if (activeTab === 'trial') {
        const trialStudents = students.filter((student) => student.is_trial);

        return (
            <>
                <div className="md:hidden">
                    <StudentsMobileList students={trialStudents} loading={loading} onStudentClick={onStudentClick} />
                </div>
                <div className="hidden md:block">
                    <TrialStudentList students={trialStudents} loading={loading} onReload={onReload} />
                </div>
            </>
        );
    }

    if (activeTab === 'pending') {
        return (
            <>
                <div className="md:hidden">
                    <StudentsMobileList students={students} loading={loading} onStudentClick={onStudentClick} />
                </div>
                <div className="hidden md:block">
                    <PendingStudentList students={students} loading={loading} sort={sort} onReload={onReload} onSortChange={onSortChange} />
                </div>
            </>
        );
    }

    if (activeTab === 'bySchool') {
        return <SchoolStudentList students={students} loading={loading} onStudentClick={onStudentClick} />;
    }

    return (
        <>
            <div className="md:hidden">
                <StudentsMobileList students={students} loading={loading} onStudentClick={onStudentClick} />
            </div>
            <div className="hidden md:block">
                <StudentListTable
                    students={students}
                    loading={loading}
                    sort={sort}
                    onSortChange={onSortChange}
                    onStudentClick={onStudentClick}
                />
            </div>
        </>
    );
}
