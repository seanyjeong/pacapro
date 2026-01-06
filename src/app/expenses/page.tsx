'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Banknote, TrendingDown, FileSpreadsheet, Calendar, List } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { exportsApi } from '@/lib/api/exports';
import { usePermissions } from '@/lib/utils/permissions';
import { ExpenseCalendar } from '@/components/expenses/expense-calendar';

// 금액 포맷 함수 (소수점 제거 + 천단위 쉼표)
const formatAmount = (amount: number) => Math.floor(amount).toLocaleString();

interface Expense {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  instructor_id?: number;
  instructor_name?: string;
  salary_id?: number;
  description?: string;
  payment_method?: string;
  notes?: string;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'utilities',
    amount: 0,
    description: '',
    payment_method: 'account',
    notes: '',
  });
  const { canEdit } = usePermissions();
  const canEditExpenses = canEdit('expenses');

  useEffect(() => {
    loadExpenses();
  }, [selectedMonth]);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const response = await apiClient.get<{expenses: Expense[]}>(`/expenses?start_date=${selectedMonth}-01&end_date=${selectedMonth}-${lastDay}`);
      setExpenses(response.expenses || []);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/expenses', formData);
      toast.success('지출이 등록되었습니다.');
      setShowForm(false);
      setFormData({
        expense_date: new Date().toISOString().split('T')[0],
        category: 'utilities',
        amount: 0,
        description: '',
        payment_method: 'account',
        notes: '',
      });
      loadExpenses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '지출 등록에 실패했습니다.');
    }
  };

  const handleExportExpenses = async () => {
    try {
      setExporting(true);
      await exportsApi.downloadExpenses();
      toast.success('지출 내역 다운로드 완료');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('다운로드 실패');
    } finally {
      setExporting(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(String(exp.amount)), 0);
  const categoryMap: Record<string, string> = {
    salary: '급여',
    utilities: '공과금',
    rent: '임대료',
    supplies: '소모품',
    marketing: '홍보비',
    refund: '환불',
    other: '기타',
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">지출 관리</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">지출 목록을 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">지출 관리</h1>
          <p className="text-muted-foreground mt-1">학원 운영 지출 관리</p>
        </div>
        <div className="flex items-center gap-2">
          {/* 뷰 모드 토글 */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8"
            >
              <List className="w-4 h-4 mr-1" />
              리스트
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="h-8"
            >
              <Calendar className="w-4 h-4 mr-1" />
              달력
            </Button>
          </div>
          <Button variant="outline" onClick={handleExportExpenses} disabled={exporting}>
            {exporting ? (
              <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            엑셀 다운로드
          </Button>
          {canEditExpenses && (
            <Button onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              {showForm ? '취소' : '지출 등록'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 지출 건수</p>
                <p className="text-2xl font-bold text-foreground">{expenses.length}건</p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 지출 금액</p>
                <p className="text-2xl font-bold text-red-600">{formatAmount(totalExpenses)}원</p>
              </div>
              <Banknote className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-muted-foreground">월 평균 지출</p>
              <p className="text-2xl font-bold text-foreground">
                {expenses.length > 0 ? formatAmount(totalExpenses / 12) : 0}원
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>지출 등록</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">지출일 *</label>
                  <input
                    type="date"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">카테고리 *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                  >
                    <option value="utilities">공과금</option>
                    <option value="rent">임대료</option>
                    <option value="supplies">소모품</option>
                    <option value="marketing">홍보비</option>
                    <option value="salary">급여</option>
                    <option value="refund">환불</option>
                    <option value="other">기타</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">금액 *</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">설명</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                  placeholder="지출 내역 설명"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">지불 방법</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                >
                  <option value="account">계좌이체</option>
                  <option value="card">카드</option>
                  <option value="cash">현금</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">메모</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>취소</Button>
                <Button type="submit">등록</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {viewMode === 'calendar' ? (
        <ExpenseCalendar
          expenses={expenses}
          onMonthChange={(ym) => setSelectedMonth(ym)}
          initialYearMonth={selectedMonth}
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">날짜</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">카테고리</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">설명</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">금액</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">지불방법</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">{expense.expense_date}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                              {categoryMap[expense.category] || expense.category}
                            </span>
                            {expense.category === 'salary' && expense.instructor_name && (
                              <span className="ml-2 text-sm font-medium text-foreground">
                                ({expense.instructor_name})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-foreground">{expense.description || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-red-600">
                          -{formatAmount(expense.amount)}원
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {expense.payment_method === 'account' && '계좌이체'}
                          {expense.payment_method === 'card' && '카드'}
                          {expense.payment_method === 'cash' && '현금'}
                          {expense.payment_method === 'other' && '기타'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {expenses.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Banknote className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">등록된 지출이 없습니다</h3>
                <p className="text-muted-foreground">지출을 등록하시면 여기에 표시됩니다.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
