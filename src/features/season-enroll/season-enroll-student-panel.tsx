import { Search } from 'lucide-react';
import type { SeasonEnrollStudent } from './season-enroll-types';
import { SeasonEnrollStudentSection } from './season-enroll-student-section';

interface SeasonEnrollStudentPanelProps {
  availableStudents: SeasonEnrollStudent[];
  enrolledStudents: SeasonEnrollStudent[];
  enrollingId: number | null;
  searchTerm: string;
  onEnrollClick: (student: SeasonEnrollStudent) => void;
  onSearchChange: (value: string) => void;
}

export function SeasonEnrollStudentPanel({
  availableStudents,
  enrolledStudents,
  enrollingId,
  searchTerm,
  onEnrollClick,
  onSearchChange,
}: SeasonEnrollStudentPanelProps) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">등록 작업대</h2>
          <p className="mt-1 text-sm text-slate-500">대상 학생을 검색하고 시간대를 지정합니다.</p>
        </div>
        <label className="relative block w-full md:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="학생 이름 또는 전화번호"
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>

      <div className="grid min-w-0 grid-cols-1 divide-y divide-slate-200 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)] xl:divide-x xl:divide-y-0">
        <SeasonEnrollStudentSection
          emptyMessage={searchTerm ? '검색 결과가 없습니다.' : '등록 가능한 학생이 없습니다.'}
          enrollingId={enrollingId}
          students={availableStudents}
          title={`등록 가능한 학생 (${availableStudents.length}명)`}
          type="available"
          onEnrollClick={onEnrollClick}
        />
        <SeasonEnrollStudentSection
          emptyMessage={searchTerm ? '검색된 등록 완료 학생이 없습니다.' : '아직 이 시즌에 등록된 학생이 없습니다.'}
          enrollingId={enrollingId}
          students={enrolledStudents}
          title={`이미 등록된 학생 (${enrolledStudents.length}명)`}
          type="enrolled"
          onEnrollClick={onEnrollClick}
        />
      </div>
    </section>
  );
}
