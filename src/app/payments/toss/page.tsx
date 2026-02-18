'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  Link2,
  XCircle,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { tossAPI, TossPaymentHistory, TossQueueItem, TossQueueStats } from '@/lib/api/toss';
import { paymentsAPI } from '@/lib/api/payments';
import type { Payment } from '@/lib/types/payment';
import { formatNumber } from '@/lib/utils/format';

export default function TossPaymentsPage() {
  const [history, setHistory] = useState<TossPaymentHistory[]>([]);
  const [queue, setQueue] = useState<TossQueueItem[]>([]);
  const [queueStats, setQueueStats] = useState<TossQueueStats>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('history');
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);

  // 수동 매칭 모달
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<TossQueueItem | null>(null);
  const [unpaidPayments, setUnpaidPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>('');
  const [matchLoading, setMatchLoading] = useState(false);

  // 통계
  const [stats, setStats] = useState({
    historyCount: 0,
    historyAmount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, queueRes] = await Promise.all([
        tossAPI.getHistory({ limit: 100 }),
        tossAPI.getQueue('pending', 100),
      ]);

      if (historyRes.success) {
        setHistory(historyRes.history);
        setTotalHistoryCount(historyRes.total);
        const totalAmount = historyRes.history.reduce((sum, h) => sum + h.amount, 0);
        setStats(prev => ({
          ...prev,
          historyCount: historyRes.total,
          historyAmount: totalAmount,
        }));
      }

      if (queueRes.success) {
        setQueue(queueRes.queue);
        setQueueStats(queueRes.stats);
        const pendingStats = queueRes.stats.pending || { count: 0, amount: 0 };
        setStats(prev => ({
          ...prev,
          pendingCount: pendingStats.count,
          pendingAmount: pendingStats.amount || 0,
        }));
      }
    } catch (error) {
      console.error('Error loading toss data:', error);
      toast.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 수동 매칭 모달 열기
  const openMatchModal = async (item: TossQueueItem) => {
    setSelectedQueueItem(item);
    setMatchModalOpen(true);
    setSelectedPaymentId('');

    try {
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const data = await paymentsAPI.getUnpaidPayments(yearMonth);
      setUnpaidPayments(data);
    } catch (error) {
      console.error('Error loading unpaid payments:', error);
      toast.error('미납 목록 로드 실패');
    }
  };

  // 수동 매칭 처리
  const handleManualMatch = async () => {
    if (!selectedQueueItem || !selectedPaymentId) {
      toast.error('매칭할 결제 내역을 선택해주세요.');
      return;
    }

    setMatchLoading(true);
    try {
      const res = await tossAPI.manualMatch(selectedQueueItem.id, parseInt(selectedPaymentId));
      if (res.success) {
        toast.success('수동 매칭 완료');
        setMatchModalOpen(false);
        loadData();
      } else {
        toast.error(res.message || '매칭 실패');
      }
    } catch (error) {
      console.error('Error manual matching:', error);
      toast.error('매칭 처리 중 오류 발생');
    } finally {
      setMatchLoading(false);
    }
  };

  // 무시 처리
  const handleIgnore = async (item: TossQueueItem) => {
    if (!confirm('이 결제를 무시 처리하시겠습니까?')) return;

    try {
      const res = await tossAPI.ignoreQueueItem(item.id, '관리자 무시 처리');
      if (res.success) {
        toast.success('무시 처리 완료');
        loadData();
      }
    } catch (error) {
      console.error('Error ignoring:', error);
      toast.error('무시 처리 실패');
    }
  };

  // 결제 수단 표시
  const getMethodLabel = (method?: string) => {
    const methods: Record<string, string> = {
      CARD: '카드',
      CASH: '현금',
      TRANSFER: '계좌이체',
      MOBILE: '휴대폰',
      OTHER: '기타',
    };
    return methods[method || ''] || method || '-';
  };

  // 상태 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">대기중</Badge>;
      case 'matched':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">매칭완료</Badge>;
      case 'ignored':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">무시됨</Badge>;
      case 'error':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">오류</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 py-6 px-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-6 px-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">토스 결제 관리</h1>
          <p className="text-muted-foreground mt-1">
            토스플레이스 결제 내역 및 매칭 관리
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">자동 매칭</p>
                <p className="text-2xl font-bold">{stats.historyCount}건</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 결제액</p>
                <p className="text-2xl font-bold">{formatNumber(stats.historyAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">매칭 대기</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingCount}건</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">대기 금액</p>
                <p className="text-2xl font-bold">{formatNumber(stats.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 탭 컨텐츠 */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="history">
            <Receipt className="w-4 h-4 mr-2" />
            결제 이력
          </TabsTrigger>
          <TabsTrigger value="queue">
            <Clock className="w-4 h-4 mr-2" />
            매칭 대기
            {stats.pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 결제 이력 탭 */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>토스 결제 이력</CardTitle>
              <CardDescription>
                토스플레이스를 통해 결제된 내역입니다. (총 {totalHistoryCount}건)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>토스 결제 이력이 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-3 font-medium">학생</th>
                        <th className="p-3 font-medium">청구월</th>
                        <th className="p-3 font-medium text-right">금액</th>
                        <th className="p-3 font-medium">결제수단</th>
                        <th className="p-3 font-medium">카드사</th>
                        <th className="p-3 font-medium">결제일시</th>
                        <th className="p-3 font-medium text-center">영수증</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(item => (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{item.student_name || '-'}</p>
                              <p className="text-sm text-muted-foreground">{item.student_number}</p>
                            </div>
                          </td>
                          <td className="p-3">{item.year_month || '-'}</td>
                          <td className="p-3 text-right font-medium">
                            {formatNumber(item.amount)}
                          </td>
                          <td className="p-3">{getMethodLabel(item.method)}</td>
                          <td className="p-3">
                            {item.card_company || '-'}
                            {item.installment_months > 0 && (
                              <span className="text-sm text-muted-foreground ml-1">
                                ({item.installment_months}개월)
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-sm">
                            {item.approved_at
                              ? new Date(item.approved_at).toLocaleString('ko-KR')
                              : '-'}
                          </td>
                          <td className="p-3 text-center">
                            {item.receipt_url ? (
                              <a
                                href={item.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-blue-600 hover:underline"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 매칭 대기 탭 */}
        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>매칭 대기열</CardTitle>
              <CardDescription>
                자동 매칭되지 않은 결제입니다. 수동으로 매칭하거나 무시할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
                  <p>매칭 대기 중인 결제가 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-3 font-medium">주문번호</th>
                        <th className="p-3 font-medium text-right">금액</th>
                        <th className="p-3 font-medium">결제수단</th>
                        <th className="p-3 font-medium">결제일시</th>
                        <th className="p-3 font-medium text-center">상태</th>
                        <th className="p-3 font-medium">사유</th>
                        <th className="p-3 font-medium text-center">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map(item => (
                        <tr key={item.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {item.order_id}
                            </code>
                          </td>
                          <td className="p-3 text-right font-medium">
                            {formatNumber(item.amount)}
                          </td>
                          <td className="p-3">{getMethodLabel(item.method)}</td>
                          <td className="p-3 text-sm">
                            {item.approved_at
                              ? new Date(item.approved_at).toLocaleString('ko-KR')
                              : '-'}
                          </td>
                          <td className="p-3 text-center">
                            {getStatusBadge(item.match_status)}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground">
                            {item.error_reason || '-'}
                          </td>
                          <td className="p-3 text-center">
                            {item.match_status === 'pending' && (
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openMatchModal(item)}
                                >
                                  <Link2 className="w-3 h-3 mr-1" />
                                  매칭
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground"
                                  onClick={() => handleIgnore(item)}
                                >
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 수동 매칭 모달 */}
      <Dialog open={matchModalOpen} onOpenChange={setMatchModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>수동 매칭</DialogTitle>
            <DialogDescription>
              결제 내역을 미납 학생과 매칭합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 결제 정보 */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">주문번호</span>
                <code className="text-xs">{selectedQueueItem?.order_id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">결제 금액</span>
                <span className="font-bold">{formatNumber(selectedQueueItem?.amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">결제일시</span>
                <span className="text-sm">
                  {selectedQueueItem?.approved_at
                    ? new Date(selectedQueueItem.approved_at).toLocaleString('ko-KR')
                    : '-'}
                </span>
              </div>
            </div>

            {/* 매칭할 결제 선택 */}
            <div className="space-y-2">
              <Label>매칭할 미납 결제 선택</Label>
              <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                <SelectTrigger>
                  <SelectValue placeholder="학생을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidPayments.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      {p.student_name} - {p.year_month} ({formatNumber(p.final_amount - (p.paid_amount || 0))})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMatchModalOpen(false)}>
              취소
            </Button>
            <Button onClick={handleManualMatch} disabled={matchLoading || !selectedPaymentId}>
              {matchLoading ? '처리 중...' : '매칭 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
