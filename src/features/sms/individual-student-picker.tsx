import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SmsStudent } from './sms-types';

interface IndividualStudentPickerProps {
  searchQuery: string;
  searchResults: SmsStudent[];
  searching: boolean;
  selectedStudent: SmsStudent | null;
  onSearchQueryChange: (value: string) => void;
  onSelectStudent: (student: SmsStudent) => void;
  onClearStudent: () => void;
}

export function IndividualStudentPicker({
  searchQuery,
  searchResults,
  searching,
  selectedStudent,
  onSearchQueryChange,
  onSelectStudent,
  onClearStudent,
}: IndividualStudentPickerProps) {
  if (selectedStudent) {
    return (
      <section className="rounded-lg border border-sky-200 bg-sky-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-sky-950">{selectedStudent.name}</h3>
            <p className="mt-1 text-xs text-sky-800">
              학생 {selectedStudent.phone || '미등록'} · 학부모 {selectedStudent.parent_phone || '미등록'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClearStudent} aria-label="선택 해제">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">학생 검색</h3>
        <p className="text-xs text-muted-foreground">개별 발송할 학생을 선택합니다.</p>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="학생 이름 검색"
          className="pl-9"
        />
      </div>

      {searchQuery && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-background">
          {searching ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">검색 중입니다.</p>
          ) : searchResults.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>
          ) : (
            searchResults.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => onSelectStudent(student)}
                className="block w-full border-b border-border px-3 py-3 text-left last:border-0 hover:bg-muted"
              >
                <span className="block text-sm font-medium text-foreground">{student.name}</span>
                <span className="block text-xs text-muted-foreground">
                  학생 {student.phone || '미등록'} · 학부모 {student.parent_phone || '미등록'}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </section>
  );
}
