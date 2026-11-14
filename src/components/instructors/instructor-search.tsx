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

export function InstructorSearch({ value, onChange, placeholder = '이름, 전화번호, 이메일로 검색' }: InstructorSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label="강사 검색"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-transparent bg-muted py-2 pl-10 pr-10 text-[15px] text-foreground placeholder:text-muted-foreground/80 focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10"
      />
      {value && (
        <button
          aria-label="검색어 지우기"
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
