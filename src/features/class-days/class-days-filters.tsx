import { Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClassDaysFiltersProps {
  filterGrade: string;
  filterWeekly: string;
  focusedStudentName?: string | null;
  hasActiveFilters: boolean;
  onGradeChange: (value: string) => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onWeeklyChange: (value: string) => void;
  resultCount: number;
  searchQuery: string;
  showScheduledOnly: boolean;
}

export function ClassDaysFilters({
  filterGrade,
  filterWeekly,
  focusedStudentName,
  hasActiveFilters,
  onGradeChange,
  onReset,
  onSearchChange,
  onWeeklyChange,
  resultCount,
  searchQuery,
  showScheduledOnly,
}: ClassDaysFiltersProps) {
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterGrade} onValueChange={onGradeChange}>
          <SelectTrigger aria-label="학년 필터" className="h-8 w-[120px] text-sm">
            <SelectValue placeholder="학년" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 학년</SelectItem>
            <SelectItem value="고1">고1</SelectItem>
            <SelectItem value="고2">고2</SelectItem>
            <SelectItem value="고3">고3</SelectItem>
            <SelectItem value="N수">N수</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterWeekly} onValueChange={onWeeklyChange}>
          <SelectTrigger aria-label="수업 횟수 필터" className="h-8 w-[130px] text-sm">
            <SelectValue placeholder="수업 횟수" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 횟수</SelectItem>
            <SelectItem value="1">주1회</SelectItem>
            <SelectItem value="2">주2회</SelectItem>
            <SelectItem value="3">주3회</SelectItem>
            <SelectItem value="4">주4회</SelectItem>
            <SelectItem value="5">주5회</SelectItem>
            <SelectItem value="6">주6회</SelectItem>
          </SelectContent>
        </Select>
        {hasActiveFilters ? (
          <Button className="h-8 px-2 text-xs" size="sm" type="button" variant="ghost" onClick={onReset}>
            초기화
          </Button>
        ) : null}
      </div>
      {focusedStudentName ? (
        <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
          {focusedStudentName} 집중 보기
        </span>
      ) : null}
      {showScheduledOnly ? (
        <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
          예약 변경만 보기
        </span>
      ) : null}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="학생 이름 검색"
          className="h-8 w-[200px] pl-8 text-sm"
          placeholder="학생 이름 검색"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <span className="text-sm text-muted-foreground">{resultCount}명</span>
    </section>
  );
}
