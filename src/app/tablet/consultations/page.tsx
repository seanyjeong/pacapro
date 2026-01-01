'use client';

/**
 * 태블릿 상담 관리 페이지
 * - 상담 목록 조회 및 바로 상담 진행 가능
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, Clock, Phone, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight,
  MessageSquare, X, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getConsultations } from '@/lib/api/consultations';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import {
  CONSULTATION_TYPE_LABELS,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_COLORS
} from '@/lib/types/consultation';

export default function TabletConsultationsPage() {
  const router = useRouter();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'today' | 'all'>('today');

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    try {
      const params: {
        search?: string;
        startDate?: string;
        endDate?: string;
      } = {};

      if (search) params.search = search;

      if (dateFilter === 'today') {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      }

      const response = await getConsultations(params);
      setConsultations(response.consultations || []);
      setStats(response.stats || {});
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, dateFilter, search]);

  const handleDateChange = (delta: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + delta);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return format(d, 'M월 d일 (EEE)', { locale: ko });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  // 상태 배지
  const StatusBadge = ({ status }: { status: ConsultationStatus }) => (
    <Badge className={CONSULTATION_STATUS_COLORS[status]}>
      {CONSULTATION_STATUS_LABELS[status]}
    </Badge>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">상담 일정</h1>
          <p className="text-muted-foreground">오늘의 상담 일정 확인</p>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 날짜 선택 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleDateChange(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <p className="text-lg font-bold text-foreground">
                {formatDate(selectedDate)}
              </p>
              {isToday && (
                <Badge variant="secondary" className="mt-1">오늘</Badge>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => handleDateChange(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {Object.values(stats).reduce((a, b) => a + b, 0)}
            </p>
            <p className="text-sm text-muted-foreground">전체</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 dark:bg-yellow-950">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending || 0}</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">대기중</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.confirmed || 0}</p>
            <p className="text-sm text-blue-700 dark:text-blue-300">확정</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 dark:bg-green-950">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed || 0}</p>
            <p className="text-sm text-green-700 dark:text-green-300">완료</p>
          </CardContent>
        </Card>
      </div>

      {/* 필터 탭 */}
      <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as 'today' | 'all')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="today">오늘</TabsTrigger>
          <TabsTrigger value="all">전체</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 검색 */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="이름, 전화번호로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-border rounded-lg text-sm bg-card text-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 상담 목록 */}
      {consultations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {dateFilter === 'today' ? '오늘 예정된 상담이 없습니다' : '상담 일정이 없습니다'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {consultations.map((consultation) => (
            <Card key={consultation.id} className="overflow-hidden">
              <CardContent className="p-4">
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">
                      {consultation.preferred_time?.substring(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={consultation.status} />
                    <Badge variant="outline">
                      {CONSULTATION_TYPE_LABELS[consultation.consultation_type]}
                    </Badge>
                  </div>
                </div>

                {/* 학생 정보 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{consultation.student_name}</span>
                    <span className="text-sm text-muted-foreground">{consultation.student_grade}</span>
                  </div>

                  {consultation.student_school && (
                    <p className="text-sm text-muted-foreground">{consultation.student_school}</p>
                  )}

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{consultation.student_phone || consultation.parent_phone || '-'}</span>
                  </div>

                  {dateFilter === 'all' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{format(parseISO(consultation.preferred_date), 'M/d (EEE)', { locale: ko })}</span>
                    </div>
                  )}

                  {consultation.inquiry_content && (
                    <p className="text-sm text-muted-foreground bg-muted rounded-lg p-2 mt-2">
                      {consultation.inquiry_content}
                    </p>
                  )}
                </div>

                {/* 상담 진행 버튼 */}
                {(consultation.status === 'pending' || consultation.status === 'confirmed') && (
                  <div className="mt-4 pt-3 border-t border-border">
                    <Button
                      onClick={() => router.push(`/consultations/${consultation.id}/conduct`)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Play className="w-4 h-4 mr-2" />
                      상담 진행
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
