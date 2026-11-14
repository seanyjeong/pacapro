import { Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SearchStudent } from './time-slot-detail-types';

interface MakeupStudentSearchProps {
  query: string;
  results: SearchStudent[];
  isSearching: boolean;
  isAddingStudent: boolean;
  onSearch: (query: string) => void;
  onAddStudent: (studentId: number, studentName: string) => void;
  onClose: () => void;
}

export function MakeupStudentSearch({
  query,
  results,
  isSearching,
  isAddingStudent,
  onSearch,
  onAddStudent,
  onClose,
}: MakeupStudentSearchProps) {
  return (
    <div className="mb-4 rounded-xl bg-primary-soft p-3">
      <div className="flex items-center gap-2 mb-2">
        <Search className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">보충 학생 검색</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-8 w-8 p-0"
          onClick={onClose}
          aria-label="보충 학생 검색 닫기"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Input
        placeholder="학생 이름 검색"
        value={query}
        onChange={(event) => onSearch(event.target.value)}
        className="bg-card"
        autoFocus
      />
      {isSearching && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
      {results.length > 0 && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {results.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => onAddStudent(student.id, student.name)}
              disabled={isAddingStudent}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-card px-3 text-left text-[15px] font-medium transition-colors hover:bg-card/70"
            >
              <span className="truncate">{student.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{student.grade}</span>
            </button>
          ))}
        </div>
      )}
      {query.length > 0 && !isSearching && results.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">검색 결과가 없어요</p>
      )}
    </div>
  );
}
