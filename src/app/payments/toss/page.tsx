'use client';

import { useState, useEffect, useCallback } from 'react';
import { EmptyState, PageHeader, SectionCard, StatTile } from '@/components/ui/page';
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
      const res = await paymentsAPI.getUnpaidPayments();
      if (res.payments) {
        setUnpaidPayments(res.payments as Payment[]);
      }
    } catch (error) {
      console.error('Error loading unpaid payments:', error);

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
        return <Badge variant="warning">대기중</Badge>;
      case 'matched':
        return <Badge variant="success">매칭완료</Badge>;
      case 'ignored':
        return <Badge variant="secondary">무시됨</Badge>;
      case 'error':
        return <Badge variant="destructive">오류</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="토스 결제 관리"
        description="토스플레이스 결제 내역과 매칭을 관리해요."
        actions={(
          <Button onClick={loadData} variant="outline" size="icon" aria-label="새로고침" title="새로고침">
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      />

      {/* 통계 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="자동 매칭" value={`${stats.historyCount}건`} icon={CheckCircle} tone="success" />
        <StatTile
          label="총 결제액"
          value={<span className="text-[20px] sm:text-[26px]">{formatNumber(stats.historyAmount)}</span>}
          icon={TrendingUp}
          tone="primary"
        />
        <StatTile label="매칭 대기" value={`${stats.pendingCount}건`} icon={Clock} tone="warning" />
        <StatTile
          label="대기 금액"
          value={<span className="text-[20px] sm:text-[26px]">{formatNumber(stats.pendingAmount)}</span>}
          icon={CreditCard}
        />
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
          </TabsTrigger>
        </TabsList>

        {/* 결제 이력 탭 */}
        <TabsContent value="history" className="mt-4">
          <SectionCard
            title="토스 결제 이력"
            description={`토스플레이스로 결제된 내역이에요. (총 ${totalHistoryCount}건)`}
          >
              {history.length === 0 ? (
                <EmptyState icon={CreditCard} title="토스 결제 이력이 없습니다." />
              ) : (
                <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[13px] font-semibold text-muted-foreground">
                        <th className="px-3 py-3">학생</th>
                        <th className="px-3 py-3">청구월</th>
                        <th className="px-3 py-3 text-right">금액</th>
                        <th className="px-3 py-3">결제수단</th>
                        <th className="px-3 py-3">카드사</th>
                        <th className="px-3 py-3">결제일시</th>
                        <th className="px-3 py-3 text-center">영수증</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(item => (
                        <tr key={item.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/50">
                          <td className="px-3 py-3.5">
                            <div>
                              <p className="text-[15px] font-semibold">{item.student_name || '-'}</p>
                              <p className="text-sm text-muted-foreground">{item.student_number}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">{item.year_month || '-'}</td>
                          <td className="px-3 py-3.5 text-right text-[15px] font-bold tabular-nums">
                            {formatNumber(item.amount)}
                          </td>
                          <td className="px-3 py-3.5">{getMethodLabel(item.method)}</td>
                          <td className="px-3 py-3.5">
                            {item.card_company || '-'}
                            {item.installment_months > 0 && (
                              <span className="text-sm text-muted-foreground ml-1">
                                ({item.installment_months}개월)
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 text-sm">
                            {item.approved_at
                              ? new Date(item.approved_at).toLocaleString('ko-KR')
                              : '-'}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {item.receipt_url ? (
                              <a
                                href={item.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-primary hover:underline"
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
          </SectionCard>
        </TabsContent>

        {/* 매칭 대기 탭 */}
        <TabsContent value="queue" className="mt-4">
          <SectionCard
            title="매칭 대기열"
            description="자동 매칭되지 않은 결제예요. 직접 매칭하거나 무시할 수 있어요."
          >
              {queue.length === 0 ? (
                <EmptyState icon={CheckCircle} title="매칭 대기 중인 결제가 없습니다." />
              ) : (
                <div className="-mx-5 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[13px] font-semibold text-muted-foreground">
                        <th className="px-3 py-3">주문번호</th>
                        <th className="px-3 py-3 text-right">금액</th>
                        <th className="px-3 py-3">결제수단</th>
                        <th className="px-3 py-3">결제일시</th>
                        <th className="px-3 py-3 text-center">상태</th>
                        <th className="px-3 py-3">사유</th>
                        <th className="px-3 py-3 text-center">액션</th>
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map(item => (
                        <tr key={item.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/50">
                          <td className="px-3 py-3.5">
                            <code className="rounded-lg bg-muted px-2 py-1 text-xs">
                              {item.order_id}
                            </code>
                          </td>
                          <td className="px-3 py-3.5 text-right text-[15px] font-bold tabular-nums">
                            {formatNumber(item.amount)}
                          </td>
                          <td className="px-3 py-3.5">{getMethodLabel(item.method)}</td>
                          <td className="px-3 py-3.5 text-sm">
                            {item.approved_at
                              ? new Date(item.approved_at).toLocaleString('ko-KR')
                              : '-'}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {getStatusBadge(item.match_status)}
                          </td>
                          <td className="px-3 py-3.5 text-sm text-muted-foreground">
                            {item.error_reason || '-'}
                          </td>
                          <td className="px-3 py-3.5 text-center">
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
          </SectionCard>
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
            <div className="space-y-2 rounded-xl bg-muted p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">주문번호</span>
                <code className="text-xs">{selectedQueueItem?.order_id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">결제 금액</span>
                <span className="font-bold tabular-nums">{formatNumber(selectedQueueItem?.amount || 0)}</span>
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

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => setMatchModalOpen(false)}>
              취소
            </Button>
            <Button className="w-full sm:w-auto" onClick={handleManualMatch} disabled={matchLoading || !selectedPaymentId}>
              {matchLoading ? '처리 중...' : '매칭 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
