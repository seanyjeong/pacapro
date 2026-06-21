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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">보충 학생 추가</h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="학생 이름 검색..."
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
              <div className="text-center py-8 text-muted-foreground">
                {query ? '검색 결과가 없습니다.' : '학생 이름을 검색하세요.'}
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-muted/60"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{student.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
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
