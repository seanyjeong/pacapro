import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ALL_STATUS_FILTER } from './enrolled-consultations-constants';
import type { DateFilter } from './enrolled-consultations-types';

interface EnrolledConsultationsFiltersProps {
  search: string;
  statusFilter: string;
  dateFilter: DateFilter;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onDateFilterChange: (value: DateFilter) => void;
  onRefresh: () => void;
}

/** 목록 카드 맨 위 한 줄: 기간 탭 + 검색 + 상태 + 새로고침. */
export function EnrolledConsultationsFilters({
  search,
  statusFilter,
  dateFilter,
  onSearchChange,
  onStatusChange,
  onDateFilterChange,
  onRefresh,
}: EnrolledConsultationsFiltersProps) {
  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <Tabs value={dateFilter} onValueChange={(value) => onDateFilterChange(value as DateFilter)} className="w-auto">
        <TabsList className="w-full lg:w-auto" aria-label="기간 필터">
          <TabsTrigger value="all">전체 기간</TabsTrigger>
          <TabsTrigger value="today">오늘</TabsTrigger>
          <TabsTrigger value="week">이번 주</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="학생명, 학년 검색..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1 lg:w-[160px] lg:flex-none">
          <Select
            value={statusFilter || ALL_STATUS_FILTER}
            onValueChange={(value) => onStatusChange(value === ALL_STATUS_FILTER ? '' : value)}
          >
            <SelectTrigger aria-label="상태 필터">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS_FILTER}>전체 상태</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="confirmed">확정</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="cancelled">취소</SelectItem>
              <SelectItem value="no_show">노쇼</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={onRefresh} title="새로고침" aria-label="새로고침">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
