'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Filter } from 'lucide-react';

interface SearchFilterProps {
  onSearch: (query: string) => void;
  onFilter?: (filters: FilterOptions) => void;
  placeholder?: string;
  showFilters?: boolean;
}

export interface FilterOptions {
  grade?: string;
  status?: 'present' | 'absent' | 'late' | 'excused' | 'not_marked' | 'all';
  studentType?: 'all' | 'regular' | 'trial' | 'makeup' | 'season';
}

export function SearchFilter({ 
  onSearch, 
  onFilter,
  placeholder = '학생 이름 검색...', 
  showFilters = true 
}: SearchFilterProps) {
  const [query, setQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    studentType: 'all',
  });

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    onFilter?.(updated);
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-20 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={() => handleQueryChange('')}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
          
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`p-1.5 rounded-lg transition-colors ${
                showFilterPanel ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              <Filter className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-strong rounded-xl p-4 space-y-4">
              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">출석 상태</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all', label: '전체' },
                    { value: 'present', label: '출석' },
                    { value: 'absent', label: '결석' },
                    { value: 'late', label: '지각' },
                    { value: 'excused', label: '공결' },
                    { value: 'not_marked', label: '미체크' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange({ status: option.value as FilterOptions['status'] })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        filters.status === option.value
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student Type Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">학생 유형</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'all', label: '전체' },
                    { value: 'regular', label: '일반' },
                    { value: 'trial', label: '체험' },
                    { value: 'makeup', label: '보충' },
                    { value: 'season', label: '시즌' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleFilterChange({ studentType: option.value as FilterOptions['studentType'] })}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        filters.studentType === option.value
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  setFilters({ status: 'all', studentType: 'all' });
                  handleFilterChange({ status: 'all', studentType: 'all' });
                }}
                className="w-full py-2 bg-secondary hover:bg-secondary/80 text-muted-foreground rounded-lg text-sm font-medium transition-colors"
              >
                필터 초기화
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}