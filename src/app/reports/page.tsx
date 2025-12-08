'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, Banknote, Users, FileSpreadsheet, ChevronDown } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { exportsApi } from '@/lib/api/exports';
import { toast } from 'sonner';

// 금액 포맷 함수 (소수점 제거 + 천단위 쉼표)
const formatAmount = (amount: number) => Math.floor(amount).toLocaleString();

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [stats, setStats] = useState({
    students: { total: 0, active: 0, inactive: 0, avgMonthlyTuition: 0 },
    payments: { total: 0, paid: 0, unpaid: 0, totalAmount: 0, paidAmount: 0 },
    expenses: { total: 0, totalAmount: 0 },
    instructors: { total: 0, active: 0 },
    otherIncomes: { total: 0, totalAmount: 0 },
  });

  // 엑셀 다운로드 핸들러
  const handleExport = async (type: 'revenue' | 'expenses' | 'financial' | 'payments') => {
    try {
      setExporting(true);
      setShowExportMenu(false);
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

      switch (type) {
        case 'revenue':
          await exportsApi.downloadRevenue({
            start_date: `${selectedMonth}-01`,
            end_date: `${selectedMonth}-${lastDay}`,
          });
          toast.success('수입 내역 다운로드 완료');
          break;
        case 'expenses':
          await exportsApi.downloadExpenses({
            start_date: `${selectedMonth}-01`,
            end_date: `${selectedMonth}-${lastDay}`,
          });
          toast.success('지출 내역 다운로드 완료');
          break;
        case 'financial':
          await exportsApi.downloadFinancial(parseInt(year));
          toast.success('재무 리포트 다운로드 완료');
          break;
        case 'payments':
          await exportsApi.downloadPayments({
            year: parseInt(year),
            month: parseInt(month),
          });
          toast.success('납부 내역 다운로드 완료');
          break;
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('다운로드 실패. 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [selectedMonth]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

      const [studentsRes, paymentsRes, expensesRes, instructorsRes, incomesRes] = await Promise.all([
        apiClient.get<{students: any[]}>('/students'),
        apiClient.get<{payments: any[]}>(`/payments?year=${year}&month=${month}`),
        apiClient.get<{expenses: any[]}>(`/expenses?start_date=${selectedMonth}-01&end_date=${selectedMonth}-${lastDay}`),
        apiClient.get<{instructors: any[]}>('/instructors'),
        apiClient.get<{incomes: any[]}>(`/incomes?start_date=${selectedMonth}-01&end_date=${selectedMonth}-${lastDay}`),
      ]);

      const students = studentsRes.students || [];
      const payments = paymentsRes.payments || [];
      const expenses = expensesRes.expenses || [];
      const instructors = instructorsRes.instructors || [];
      const otherIncomes = incomesRes.incomes || [];

      // 재원생 중 월 수강료가 0원이 아닌 학생들만 필터
      const activeStudentsWithTuition = students.filter(
        (s: any) => s.status === 'active' && parseFloat(s.monthly_tuition || 0) > 0
      );
      // 평균 월 수강료 계산
      const avgTuition = activeStudentsWithTuition.length > 0
        ? activeStudentsWithTuition.reduce((sum: number, s: any) => sum + parseFloat(s.monthly_tuition || 0), 0) / activeStudentsWithTuition.length
        : 0;

      setStats({
        students: {
          total: students.length,
          active: students.filter((s: any) => s.status === 'active').length,
          inactive: students.filter((s: any) => s.status !== 'active').length,
          avgMonthlyTuition: Math.floor(avgTuition),
        },
        payments: {
          total: payments.length,
          paid: payments.filter((p: any) => p.payment_status === 'paid').length,
          unpaid: payments.filter((p: any) => p.payment_status !== 'paid').length,
          totalAmount: Math.floor(payments.reduce((sum: number, p: any) => sum + parseFloat(p.final_amount || 0), 0)),
          paidAmount: Math.floor(payments
            .filter((p: any) => p.payment_status === 'paid')
            .reduce((sum: number, p: any) => sum + parseFloat(p.final_amount || 0), 0)),
        },
        expenses: {
          total: expenses.length,
          totalAmount: Math.floor(expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0)),
        },
        instructors: {
          total: instructors.length,
          active: instructors.filter((i: any) => i.status === 'active').length,
        },
        otherIncomes: {
          total: otherIncomes.length,
          totalAmount: Math.floor(otherIncomes.reduce((sum: number, inc: any) => sum + parseFloat(inc.amount || 0), 0)),
        },
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = stats.payments.paidAmount + stats.otherIncomes.totalAmount;
  const netProfit = totalIncome - stats.expenses.totalAmount;
  const profitMargin = totalIncome > 0
    ? ((netProfit / totalIncome) * 100).toFixed(1)
    : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">리포트</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">리포트를 생성하는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">리포트</h1>
          <p className="text-gray-600 mt-1">학원 운영 현황 리포트</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          />
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
            >
              {exporting ? (
                <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              엑셀 다운로드
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-20">
                  <div className="py-1">
                    <button
                      onClick={() => handleExport('revenue')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      수입 내역
                    </button>
                    <button
                      onClick={() => handleExport('expenses')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <TrendingDown className="w-4 h-4 text-red-600" />
                      지출 내역
                    </button>
                    <button
                      onClick={() => handleExport('payments')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Banknote className="w-4 h-4 text-blue-600" />
                      납부 내역
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={() => handleExport('financial')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4 text-purple-600" />
                      {selectedMonth.split('-')[0]}년 재무 리포트
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">재원생</p>
                <p className="text-3xl font-bold text-gray-900">{stats.students.active}</p>
                <p className="text-xs text-gray-500 mt-1">총 {stats.students.total}명</p>
              </div>
              <Users className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">총 수입</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatAmount(totalIncome)}원
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  학원비 {formatAmount(stats.payments.paidAmount)}원 + 기타 {formatAmount(stats.otherIncomes.totalAmount)}원
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">총 지출</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatAmount(stats.expenses.totalAmount)}원
                </p>
                <p className="text-xs text-gray-500 mt-1">{stats.expenses.total}건</p>
              </div>
              <TrendingDown className="w-10 h-10 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">순이익</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatAmount(netProfit)}원
                </p>
                <p className="text-xs text-gray-500 mt-1">마진율 {profitMargin}%</p>
              </div>
              <Banknote className="w-10 h-10 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>수입 분석</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">청구 금액</span>
                <span className="font-semibold">{formatAmount(stats.payments.totalAmount)}원</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">수납 금액</span>
                <span className="font-semibold text-green-600">{formatAmount(stats.payments.paidAmount)}원</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${stats.payments.totalAmount > 0 ? (stats.payments.paidAmount / stats.payments.totalAmount) * 100 : 0}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">미수납 금액</span>
                <span className="font-semibold text-red-600">
                  {formatAmount(stats.payments.totalAmount - stats.payments.paidAmount)}원
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-red-600 h-2 rounded-full"
                  style={{
                    width: `${stats.payments.totalAmount > 0 ? ((stats.payments.totalAmount - stats.payments.paidAmount) / stats.payments.totalAmount) * 100 : 0}%`
                  }}
                ></div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-gray-900">수납률</span>
                <span className="text-xl font-bold text-primary-600">
                  {stats.payments.totalAmount > 0
                    ? Math.round((stats.payments.paidAmount / stats.payments.totalAmount) * 100)
                    : 0}%
                </span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">기타수입</span>
                <span className="font-semibold text-green-600">{formatAmount(stats.otherIncomes.totalAmount)}원</span>
              </div>
              <p className="text-xs text-gray-500">{stats.otherIncomes.total}건 (의류, 신발, 용품, 음료/간식 등)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>학생 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-gray-700">재원생</span>
              </div>
              <span className="font-semibold text-lg">{stats.students.active}명</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span className="text-gray-700">휴원/졸업</span>
              </div>
              <span className="font-semibold text-lg">{stats.students.inactive}명</span>
            </div>

            <div className="flex justify-between items-center py-3 border-b">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700">강사 수</span>
              </div>
              <span className="font-semibold text-lg">{stats.instructors.active}명</span>
            </div>

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">평균 월 수강료</span>
                <span className="text-xl font-bold text-primary-600">
                  {formatAmount(stats.students.avgMonthlyTuition)}원
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">재원생 기준 (0원 제외)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>손익 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="font-semibold text-gray-900">총 수입</span>
                <span className="text-xl font-bold text-green-600">
                  +{formatAmount(totalIncome)}원
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>학원비 수납</span>
                  <span>+{formatAmount(stats.payments.paidAmount)}원</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>기타수입</span>
                  <span>+{formatAmount(stats.otherIncomes.totalAmount)}원</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
              <span className="font-semibold text-gray-900">총 지출</span>
              <span className="text-xl font-bold text-red-600">
                -{formatAmount(stats.expenses.totalAmount)}원
              </span>
            </div>

            <div className={`flex justify-between items-center p-4 rounded-lg ${netProfit >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
              <span className="font-semibold text-gray-900">순이익</span>
              <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {netProfit >= 0 ? '+' : ''}{formatAmount(netProfit)}원
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
