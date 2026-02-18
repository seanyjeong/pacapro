'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, TrendingDown, RefreshCw } from 'lucide-react';
import { paymentsAPI } from '@/lib/api/payments';
import type { Payment, CreditsSummaryResponse } from '@/lib/types/payment';
import { toast } from 'sonner';

export default function CreditsPage() {
  const [credits, setCredits] = useState<Payment[]>([]);
  const [summary, setSummary] = useState<CreditsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [creditsData, summaryData] = await Promise.all([
        paymentsAPI.getCredits(),
        paymentsAPI.getCreditsSummary(),
      ]);

      setCredits(creditsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      toast.error('크레딧 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">크레딧 관리</h1>
          <p className="text-muted-foreground">할인 적용 내역을 확인합니다</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 크레딧</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(summary?.total_credits || 0).toLocaleString()}원
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 절약</CardTitle>
            <TrendingDown className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {(summary?.total_saved || 0).toLocaleString()}원
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Credits list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">할인 적용 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {credits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              할인 내역이 없습니다
            </div>
          ) : (
            <div className="space-y-3">
              {credits.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors gap-3"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{payment.student_name}</span>
                      <span className="text-sm text-muted-foreground">{payment.year_month}</span>
                    </div>
                    {payment.notes && (
                      <div className="text-sm text-muted-foreground">{payment.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-sm text-muted-foreground">기본</div>
                      <div className="font-medium">{payment.base_amount.toLocaleString()}원</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">할인</div>
                      <div className="font-bold text-emerald-600">
                        -{payment.discount_amount.toLocaleString()}원
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">최종</div>
                      <div className="font-medium">{payment.final_amount.toLocaleString()}원</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
