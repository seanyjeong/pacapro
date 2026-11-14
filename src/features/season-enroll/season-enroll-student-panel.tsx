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
    <section className="min-w-0 overflow-hidden rounded-2xl bg-card">
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">학생 고르기</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">대상 학생을 검색하고 시간대를 정해요.</p>
        </div>
        <label className="relative block w-full md:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="학생 이름 또는 전화번호 검색"
            className="h-11 w-full rounded-xl border border-transparent bg-muted pl-10 pr-3 text-[15px] text-foreground outline-none transition focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
            placeholder="학생 이름 또는 전화번호"
            type="text"
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
      </div>

      <div className="grid min-w-0 grid-cols-1 divide-y divide-border/60 2xl:grid-cols-2 2xl:divide-x 2xl:divide-y-0">
        <SeasonEnrollStudentSection
          emptyMessage={searchTerm ? '검색 결과가 없어요.' : '등록 가능한 학생이 없어요.'}
          enrollingId={enrollingId}
          students={availableStudents}
          title="등록 가능한 학생"
          type="available"
          onEnrollClick={onEnrollClick}
        />
        <SeasonEnrollStudentSection
          emptyMessage={searchTerm ? '검색된 등록 완료 학생이 없어요.' : '아직 이 시즌에 등록된 학생이 없어요.'}
          enrollingId={enrollingId}
          students={enrolledStudents}
          title="이미 등록된 학생"
          type="enrolled"
          onEnrollClick={onEnrollClick}
        />
      </div>
    </section>
  );
}
