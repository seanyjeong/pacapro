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
    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">보충 학생 검색</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-6 w-6 p-0"
          onClick={onClose}
          aria-label="보충 학생 검색 닫기"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Input
        placeholder="학생 이름 검색..."
        value={query}
        onChange={(event) => onSearch(event.target.value)}
        className="h-8 text-sm"
        autoFocus
      />
      {isSearching && (
        <div className="flex items-center justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
        </div>
      )}
      {results.length > 0 && (
        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {results.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => onAddStudent(student.id, student.name)}
              disabled={isAddingStudent}
              className="w-full flex items-center justify-between gap-3 p-2 text-left text-sm bg-card rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              <span className="truncate">{student.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{student.grade}</span>
            </button>
          ))}
        </div>
      )}
      {query.length > 0 && !isSearching && results.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">검색 결과가 없습니다</p>
      )}
    </div>
  );
}
