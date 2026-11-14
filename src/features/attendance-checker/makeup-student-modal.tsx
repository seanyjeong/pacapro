import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AttendanceSearchStudent } from './attendance-checker-types';

interface MakeupStudentModalProps {
  query: string;
  results: AttendanceSearchStudent[];
  isSearching: boolean;
  isAddingStudent: boolean;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onAddStudent: (studentId: number, studentName: string) => void;
  onClose: () => void;
}

export function MakeupStudentModal({
  query,
  results,
  isSearching,
  isAddingStudent,
  onQueryChange,
  onSearch,
  onAddStudent,
  onClose,
}: MakeupStudentModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] shadow-xl sm:rounded-2xl sm:pb-0">
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h3 className="text-[19px] font-bold tracking-tight">보충 학생 추가</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-5 pb-5">
          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="학생 이름 검색"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && onSearch()}
                className="pl-9"
                autoFocus
              />
            </div>
            <Button onClick={onSearch} disabled={isSearching}>
              {isSearching ? '검색 중...' : '검색'}
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {query ? '검색 결과가 없어요.' : '학생 이름을 검색해 주세요.'}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {results.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{student.name}</p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {student.grade} · {student.student_number}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onAddStudent(student.id, student.name)}
                      disabled={isAddingStudent}
                      className="shrink-0"
                    >
                      {isAddingStudent ? '추가 중...' : '추가'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
