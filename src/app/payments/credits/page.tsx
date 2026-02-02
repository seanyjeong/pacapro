'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, CreditCard, Users, TrendingDown, RefreshCw } from 'lucide-react';
import { paymentsAPI } from '@/lib/api/payments';
import type { Credit, CreditStats, StudentWithCredit, CreditTypeStats } from '@/lib/types/payment';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

// 크레딧 타입 한글화
const CREDIT_TYPE_LABELS: Record<string, string> = {
  carryover: '이월',
  refund: '환불',
  manual: '수동',
};

// 크레딧 상태 한글화
const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  partial: '부분적용',
  applied: '적용완료',
  refunded: '환불',
  cancelled: '취소',
};

// 상태별 배지 색상
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-blue-100 text-blue-800',
  applied: 'bg-green-100 text-green-800',
  refunded: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function CreditsPage() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [studentsWithCredit, setStudentsWithCredit] = useState<StudentWithCredit[]>([]);
  const [typeStats, setTypeStats] = useState<CreditTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 크레딧 목록과 요약 동시 조회
      const [creditsRes, summaryRes] = await Promise.all([
        paymentsAPI.getCredits({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          credit_type: typeFilter !== 'all' ? typeFilter : undefined,
        }),
        paymentsAPI.getCreditsSummary(),
      ]);

      setCredits(creditsRes.credits);
      setStats(creditsRes.stats);
      setStudentsWithCredit(summaryRes.students_with_credit);
      setTypeStats(summaryRes.type_stats);
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      toast.error('크레딧 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">크레딧 관리</h1>
          <p className="text-muted-foreground">휴원/환불 크레딧 현황을 관리합니다</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 크레딧</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.total_credit || 0).toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.total_count || 0}건
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">잔여 크레딧</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {(stats?.total_remaining || 0).toLocaleString()}원
            </div>
            <p className="text-xs text-muted-foreground">
              대기: {stats?.pending_count || 0}건
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">적용 완료</CardTitle>
            <CreditCard className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.applied_count || 0}건
            </div>
            <p className="text-xs text-muted-foreground">
              부분적용: {stats?.partial_count || 0}건
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">크레딧 보유 학생</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {studentsWithCredit.length}명
            </div>
            <p className="text-xs text-muted-foreground">
              총 {studentsWithCredit.reduce((sum, s) => sum + s.total_remaining, 0).toLocaleString()}원
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 크레딧 보유 학생 목록 */}
      {studentsWithCredit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">크레딧 보유 학생</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {studentsWithCredit.map((student) => (
                <Badge
                  key={student.id}
                  variant="outline"
                  className="px-3 py-1.5 text-sm"
                >
                  {student.name}: {student.total_remaining.toLocaleString()}원
                  <span className="ml-1 text-muted-foreground">
                    ({student.credit_count}건)
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 필터 */}
      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 상태</SelectItem>
            <SelectItem value="pending">대기</SelectItem>
            <SelectItem value="partial">부분적용</SelectItem>
            <SelectItem value="applied">적용완료</SelectItem>
            <SelectItem value="refunded">환불</SelectItem>
            <SelectItem value="cancelled">취소</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="타입 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 타입</SelectItem>
            <SelectItem value="carryover">이월</SelectItem>
            <SelectItem value="refund">환불</SelectItem>
            <SelectItem value="manual">수동</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 크레딧 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">크레딧 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {credits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              크레딧 내역이 없습니다
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학생</TableHead>
                  <TableHead>타입</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead className="text-right">발생금액</TableHead>
                  <TableHead className="text-right">잔여금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead>비고</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((credit) => (
                  <TableRow key={credit.id}>
                    <TableCell className="font-medium">
                      {credit.student_name}
                      {credit.student_status !== 'active' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {credit.student_status === 'paused' ? '휴원' : credit.student_status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {CREDIT_TYPE_LABELS[credit.credit_type] || credit.credit_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {credit.rest_start_date && credit.rest_end_date ? (
                        <>
                          {format(new Date(credit.rest_start_date), 'M/d', { locale: ko })}
                          {' ~ '}
                          {format(new Date(credit.rest_end_date), 'M/d', { locale: ko })}
                          <span className="ml-1">({credit.rest_days}일)</span>
                        </>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {credit.credit_amount.toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {credit.remaining_amount > 0 ? (
                        <span className="text-orange-600">
                          {credit.remaining_amount.toLocaleString()}원
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0원</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[credit.status] || ''}>
                        {STATUS_LABELS[credit.status] || credit.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(credit.created_at), 'yyyy-MM-dd', { locale: ko })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {credit.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 타입별 통계 */}
      {typeStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">타입별 통계</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {typeStats.map((stat) => (
                <div
                  key={stat.credit_type}
                  className="p-4 rounded-lg border bg-muted/30"
                >
                  <div className="text-sm font-medium text-muted-foreground">
                    {CREDIT_TYPE_LABELS[stat.credit_type] || stat.credit_type}
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {stat.total_amount.toLocaleString()}원
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.count}건 / 잔여: {stat.remaining_amount.toLocaleString()}원
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
