import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="학생명 검색..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter || ALL_STATUS_FILTER}
            onValueChange={(value) => onStatusChange(value === ALL_STATUS_FILTER ? '' : value)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS_FILTER}>전체</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="confirmed">확정</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="cancelled">취소</SelectItem>
              <SelectItem value="no_show">노쇼</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(value) => onDateFilterChange(value as DateFilter)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="기간" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기간</SelectItem>
              <SelectItem value="today">오늘</SelectItem>
              <SelectItem value="week">이번 주</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
