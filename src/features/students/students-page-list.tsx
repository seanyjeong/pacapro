import { PendingStudentList } from '@/components/students/pending-student-list';
import { SchoolStudentList } from '@/components/students/school-student-list';
import { StudentListTable } from '@/components/students/student-list-table';
import { TrialStudentList } from '@/components/students/trial-student-list';
import type { Student } from '@/lib/types/student';
import type { StudentTab } from './student-page-types';
import { StudentsMobileList } from './students-mobile-list';

interface StudentsPageListProps {
    activeTab: StudentTab;
    loading: boolean;
    students: Student[];
    onReload: () => void;
    onStudentClick: (id: number) => void;
}

export function StudentsPageList({
    activeTab,
    loading,
    students,
    onReload,
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
                    <PendingStudentList students={students} loading={loading} onReload={onReload} />
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
                <StudentListTable students={students} loading={loading} onStudentClick={onStudentClick} />
            </div>
        </>
    );
}
