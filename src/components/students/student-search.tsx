/**
 * Student Search Component
 * 학생 검색 컴포넌트
 */

import { Search, X } from 'lucide-react';

interface StudentSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function StudentSearch({ value, onChange, placeholder = '이름, 학번, 전화번호로 검색...' }: StudentSearchProps) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
