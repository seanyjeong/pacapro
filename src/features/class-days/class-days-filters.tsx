import { FilterX, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Branch } from '@/lib/api/branches';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClassDaysFiltersProps {
  branches: Branch[];
  filterGrade: string;
  filterPlacement: string;
  filterWeekly: string;
  focusedStudentName?: string | null;
  hasActiveFilters: boolean;
  onGradeChange: (value: string) => void;
  onPlacementChange: (value: string) => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onWeeklyChange: (value: string) => void;
  resultCount: number;
  searchQuery: string;
  showScheduledOnly: boolean;
}

export function ClassDaysFilters({
  branches,
  filterGrade,
  filterPlacement,
  filterWeekly,
  focusedStudentName,
  hasActiveFilters,
  onGradeChange,
  onPlacementChange,
  onReset,
  onSearchChange,
  onWeeklyChange,
  resultCount,
  searchQuery,
  showScheduledOnly,
}: ClassDaysFiltersProps) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative lg:w-64">
        <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="학생 이름 검색"
          className="pl-10"
          placeholder="학생 이름 검색"
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {branches.length > 0 ? (
          <select
            aria-label="지점·반 필터"
            value={filterPlacement}
            onChange={(event) => onPlacementChange(event.target.value)}
            className="col-span-2 h-11 rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground focus:border-primary focus:bg-card focus:outline-none sm:w-[180px]"
          >
            <option value="all">전체 지점·반</option>
            {branches.map((branch) => (
              <optgroup key={branch.id} label={branch.name}>
                <option value={`b:${branch.id}`}>{branch.name} 전체</option>
                {branch.classes.map((cls) => (
                  <option key={cls.id} value={`c:${cls.id}`}>{branch.name} {cls.class_name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : null}
        <Select value={filterGrade} onValueChange={onGradeChange}>
          <SelectTrigger aria-label="학년 필터" className="sm:w-[130px]">
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
          <SelectTrigger aria-label="수업 횟수 필터" className="sm:w-[130px]">
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
          <Button className="col-span-2 sm:col-span-1" type="button" variant="ghost" onClick={onReset}>
            <FilterX className="h-4 w-4" />
            필터 초기화
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        {focusedStudentName ? <Badge>{focusedStudentName} 집중 보기</Badge> : null}
        {showScheduledOnly ? <Badge variant="warning">예약 변경만 보기</Badge> : null}
        <span className="text-[13px] text-muted-foreground">
          총 <span className="font-bold tabular-nums text-foreground">{resultCount}</span>명
        </span>
      </div>
    </div>
  );
}
