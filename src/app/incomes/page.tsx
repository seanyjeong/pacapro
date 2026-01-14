'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Banknote, TrendingUp, Pencil, Trash2, CreditCard, FileSpreadsheet, Calendar, List, X, Search } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { exportsApi } from '@/lib/api/exports';
import { usePermissions } from '@/lib/utils/permissions';
import { IncomeCalendar } from '@/components/incomes/income-calendar';

interface OtherIncome {
  id: number;
  income_date: string;
  category: string;
  amount: number;
  student_id?: number;
  student_name?: string;
  description?: string;
  payment_method?: string;
  notes?: string;
}

interface TuitionPayment {
  id: number;
  student_id: number;
  student_name: string;
  year_month: string;
  final_amount: number;
  paid_amount: number;
  paid_date: string;
  payment_method: string;
  payment_status: string;
}

// 금액 포맷 함수
const formatAmount = (amount: number) => Math.floor(amount).toLocaleString();

const CATEGORY_MAP: Record<string, string> = {
  clothing: '의류',
  shoes: '신발',
  equipment: '용품',
  beverage: '음료',
  snack: '간식',
  other: '기타',
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  cash: '현금',
  card: '카드',
  transfer: '계좌이체',
  account: '계좌이체',
};

export default function IncomesPage() {
  const [otherIncomes, setOtherIncomes] = useState<OtherIncome[]>([]);
  const [tuitionPayments, setTuitionPayments] = useState<TuitionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'tuition' | 'other'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  // 권한 체크
  const { canEdit } = usePermissions();
  const canEditIncomes = canEdit('incomes');

  // 기타수입 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIncome, setSelectedIncome] = useState<OtherIncome | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    income_date: new Date().toISOString().split('T')[0],
    category: 'other',
    amount: 0,
    description: '',
    payment_method: 'cash',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();

      const [incomesRes, paymentsRes] = await Promise.all([
        apiClient.get<{incomes: OtherIncome[]}>(`/incomes?start_date=${selectedMonth}-01&end_date=${selectedMonth}-${lastDay}`),
        // 수입 페이지는 실제 납부일(paid_date) 기준으로 조회
        apiClient.get<{payments: TuitionPayment[]}>(`/payments?paid_year=${year}&paid_month=${month}&payment_status=paid`),
      ]);

      setOtherIncomes(incomesRes.incomes || []);
      setTuitionPayments(paymentsRes.payments || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      income_date: new Date().toISOString().split('T')[0],
      category: 'other',
      amount: 0,
      description: '',
      payment_method: 'cash',
      notes: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiClient.put(`/incomes/${editingId}`, formData);
        toast.success('수입이 수정되었습니다.');
      } else {
        await apiClient.post('/incomes', formData);
        toast.success('수입이 등록되었습니다.');
      }
      resetForm();
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '수입 등록에 실패했습니다.');
    }
  };

  const handleEdit = (income: OtherIncome) => {
    setFormData({
      income_date: income.income_date.split('T')[0],
      category: income.category,
      amount: Math.floor(income.amount),
      description: income.description || '',
      payment_method: income.payment_method || 'cash',
      notes: income.notes || '',
    });
    setEditingId(income.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 수입 내역을 삭제하시겠습니까?')) return;
    try {
      await apiClient.delete(`/incomes/${id}`);
      toast.success('삭제되었습니다.');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || '삭제에 실패했습니다.');
    }
  };

  const handleExportRevenue = async () => {
    try {
      setExporting(true);
      const [year, month] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      await exportsApi.downloadRevenue({
        start_date: `${selectedMonth}-01`,
        end_date: `${selectedMonth}-${lastDay}`,
      });
      toast.success('수입 내역 다운로드 완료');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('다운로드 실패');
    } finally {
      setExporting(false);
    }
  };

  // 검색 필터링 및 정렬 (최근 날짜가 위로)
  const filteredTuitionPayments = tuitionPayments
    .filter(p => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return p.student_name?.toLowerCase().includes(q) ||
             p.year_month?.includes(q) ||
             p.paid_date?.includes(q);
    })
    .sort((a, b) => (b.paid_date || '').localeCompare(a.paid_date || ''));

  const filteredOtherIncomes = otherIncomes
    .filter(inc => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return inc.description?.toLowerCase().includes(q) ||
             inc.income_date?.includes(q) ||
             (CATEGORY_MAP[inc.category] || inc.category).toLowerCase().includes(q);
    })
    .sort((a, b) => (b.income_date || '').localeCompare(a.income_date || ''));

  // 통계 계산
  const totalTuition = tuitionPayments.reduce((sum, p) => sum + Math.floor(parseFloat(String(p.final_amount)) || 0), 0);
  const totalOther = otherIncomes.reduce((sum, inc) => sum + Math.floor(parseFloat(String(inc.amount)) || 0), 0);
  const totalIncome = totalTuition + totalOther;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-foreground">수입 관리</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">수입 내역을 불러오는 중...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">수입 관리</h1>
          <p className="text-muted-foreground mt-1">학원비 수납 및 기타 수입 관리</p>
        </div>
        <div className="flex items-center gap-3">
          {/* 뷰 모드 토글 */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="px-3"
            >
              <List className="w-4 h-4 mr-1" />
              리스트
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className="px-3"
            >
              <Calendar className="w-4 h-4 mr-1" />
              달력
            </Button>
          </div>
          {/* 검색 */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 w-48 border border-border bg-background text-foreground rounded-md"
            />
          </div>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-border bg-background text-foreground rounded-md"
          />
          <Button variant="outline" onClick={handleExportRevenue} disabled={exporting}>
            {exporting ? (
              <div className="w-4 h-4 mr-2 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 mr-2" />
            )}
            엑셀 다운로드
          </Button>
          {canEditIncomes && (
            <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
              <Plus className="w-4 h-4 mr-2" />
              {showForm && !editingId ? '취소' : '기타수입 등록'}
            </Button>
          )}
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">총 수입</p>
                <p className="text-2xl font-bold text-green-600">{formatAmount(totalIncome)}원</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">학원비 수납</p>
                <p className="text-2xl font-bold text-blue-600">{formatAmount(totalTuition)}원</p>
                <p className="text-xs text-muted-foreground">{tuitionPayments.length}건</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">기타 수입</p>
                <p className="text-2xl font-bold text-purple-600">{formatAmount(totalOther)}원</p>
                <p className="text-xs text-muted-foreground">{otherIncomes.length}건</p>
              </div>
              <Banknote className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-sm text-muted-foreground">수입 비율</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: totalIncome > 0 ? `${(totalTuition / totalIncome) * 100}%` : '0%' }}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                학원비 {totalIncome > 0 ? Math.round((totalTuition / totalIncome) * 100) : 0}% / 기타 {totalIncome > 0 ? Math.round((totalOther / totalIncome) * 100) : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 기타수입 등록 폼 */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? '기타수입 수정' : '기타수입 등록'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">날짜 *</label>
                  <input
                    type="date"
                    value={formData.income_date}
                    onChange={(e) => setFormData({ ...formData, income_date: e.target.value })}
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
                    <option value="clothing">의류</option>
                    <option value="shoes">신발</option>
                    <option value="equipment">용품</option>
                    <option value="beverage">음료</option>
                    <option value="snack">간식</option>
                    <option value="other">기타</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">금액 *</label>
                <input
                  type="number"
                  value={formData.amount || ''}
                  onChange={(e) => setFormData({ ...formData, amount: Math.floor(Number(e.target.value)) })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                  min="0"
                  step="1000"
                  placeholder="0"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">1천원 단위</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">설명</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                  placeholder="예: 운동복 판매, 음료수 판매 등"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">결제 방법</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md"
                >
                  <option value="cash">현금</option>
                  <option value="card">카드</option>
                  <option value="transfer">계좌이체</option>
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
                <Button type="button" variant="secondary" onClick={resetForm}>취소</Button>
                <Button type="submit">{editingId ? '수정' : '등록'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 달력 뷰 */}
      {viewMode === 'calendar' ? (
        <IncomeCalendar
          otherIncomes={otherIncomes}
          tuitionPayments={tuitionPayments}
          onMonthChange={(ym) => setSelectedMonth(ym)}
          initialYearMonth={selectedMonth}
        />
      ) : (
        <>
          {/* 탭 메뉴 */}
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'all'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                전체 ({tuitionPayments.length + otherIncomes.length})
              </button>
              <button
                onClick={() => setActiveTab('tuition')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'tuition'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                학원비 수납 ({tuitionPayments.length})
              </button>
              <button
            onClick={() => setActiveTab('other')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'other'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            기타 수입 ({otherIncomes.length})
          </button>
        </nav>
      </div>

      {/* 학원비 수납 목록 */}
      {(activeTab === 'all' || activeTab === 'tuition') && tuitionPayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              학원비 수납 내역
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">학생</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">청구월</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">금액</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">납부일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">결제방법</th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredTuitionPayments.map((payment) => (
                    <tr key={`tuition-${payment.id}`} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                        {payment.student_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {payment.year_month}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-blue-600">
                        +{formatAmount(payment.final_amount)}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {payment.paid_date?.split('T')[0] || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {PAYMENT_METHOD_MAP[payment.payment_method] || payment.payment_method || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 기타수입 목록 */}
      {(activeTab === 'all' || activeTab === 'other') && otherIncomes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-purple-600" />
              기타 수입 내역
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">날짜</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">카테고리</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">설명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">금액</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">결제</th>
                    {canEditIncomes && <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">관리</th>}
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredOtherIncomes.map((income) => (
                    <tr
                      key={`other-${income.id}`}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedIncome(income)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                        {income.income_date.split('T')[0]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                          {CATEGORY_MAP[income.category] || income.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-foreground">{income.description || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-purple-600">
                        +{formatAmount(income.amount)}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {PAYMENT_METHOD_MAP[income.payment_method || 'cash']}
                      </td>
                      {canEditIncomes && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEdit(income)}
                              className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900 rounded"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(income.id)}
                              className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

          {/* 데이터 없음 */}
          {tuitionPayments.length === 0 && otherIncomes.length === 0 && !showForm && (
            <Card>
              <CardContent className="p-12 text-center">
                <Banknote className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">이번 달 수입이 없습니다</h3>
                <p className="text-muted-foreground">수입이 발생하면 여기에 표시됩니다.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 기타수입 상세 모달 */}
      {selectedIncome && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedIncome(null)}>
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">기타수입 상세</h3>
              <button onClick={() => setSelectedIncome(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">날짜</p>
                  <p className="font-medium text-foreground">{selectedIncome.income_date.split('T')[0]}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">카테고리</p>
                  <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                    {CATEGORY_MAP[selectedIncome.category] || selectedIncome.category}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">금액</p>
                  <p className="font-semibold text-purple-600">+{formatAmount(selectedIncome.amount)}원</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">결제방법</p>
                  <p className="text-foreground">{PAYMENT_METHOD_MAP[selectedIncome.payment_method || 'cash']}</p>
                </div>
              </div>
              {selectedIncome.description && (
                <div>
                  <p className="text-sm text-muted-foreground">설명</p>
                  <p className="text-foreground">{selectedIncome.description}</p>
                </div>
              )}
              {selectedIncome.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">메모</p>
                  <p className="text-foreground whitespace-pre-wrap bg-muted p-3 rounded">{selectedIncome.notes}</p>
                </div>
              )}
            </div>
            {canEditIncomes && (
              <div className="flex justify-end gap-2 p-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleEdit(selectedIncome);
                    setSelectedIncome(null);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  수정
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    handleDelete(selectedIncome.id);
                    setSelectedIncome(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  삭제
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
