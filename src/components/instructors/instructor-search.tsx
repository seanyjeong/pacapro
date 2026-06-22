/**
 * Instructor Search Component
 * 강사 검색 컴포넌트
 */

import { Search, X } from 'lucide-react';

interface InstructorSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function InstructorSearch({ value, onChange, placeholder = '이름, 전화번호, 이메일로 검색...' }: InstructorSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background py-2.5 pl-10 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
