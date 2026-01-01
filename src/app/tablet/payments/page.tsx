'use client';

import { useState, useEffect, useMemo } from 'react';
import { useOrientation } from '@/components/tablet/orientation-context';
import apiClient from '@/lib/api/client';
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  User
} from 'lucide-react';

interface Payment {
  id: number;
  student_id: number;
  student_name: string;
  year_month: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  payment_date: string | null;
  payment_method: string | null;
}

interface PaymentStats {
  total: number;
  paid: number;
  unpaid: number;
  partial: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
}

const STATUS_CONFIG = {
  paid: { label: '완납', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  unpaid: { label: '미납', color: 'bg-red-100 text-red-700', icon: XCircle },
  partial: { label: '부분납', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  pending: { label: '대기', color: 'bg-gray-100 text-gray-700', icon: AlertCircle },
};

export default function TabletPaymentsPage() {
  const orientation = useOrientation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearMonth, setYearMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchPayments();
  }, [yearMonth]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<{ payments: Payment[] }>('/payments', {
        params: { year_month: yearMonth }
      });
      setPayments(res.payments || []);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  // 통계 계산
  const stats: PaymentStats = useMemo(() => {
    return payments.reduce((acc, p) => {
      acc.total++;
      acc.totalAmount += p.total_amount || 0;
      acc.paidAmount += p.paid_amount || 0;

      if (p.payment_status === 'paid') {
        acc.paid++;
      } else if (p.payment_status === 'unpaid') {
        acc.unpaid++;
        acc.unpaidAmount += p.remaining_amount || 0;
      } else if (p.payment_status === 'partial') {
        acc.partial++;
        acc.unpaidAmount += p.remaining_amount || 0;
      }

      return acc;
    }, {
      total: 0,
      paid: 0,
      unpaid: 0,
      partial: 0,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0
    });
  }, [payments]);

  // 필터링
  const filteredPayments = useMemo(() => {
    let result = payments;

    // 상태 필터
    if (statusFilter !== 'all') {
      result = result.filter(p => p.payment_status === statusFilter);
    }

    // 검색 필터
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(p =>
        p.student_name?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [payments, statusFilter, search]);

  const handleMonthChange = (delta: number) => {
    const [year, month] = yearMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, 1);
    setYearMonth(newDate.toISOString().slice(0, 7));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatMonth = (ym: string) => {
    const [year, month] = ym.split('-');
    return `${year}년 ${parseInt(month)}월`;
  };

  const isCurrentMonth = yearMonth === new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-4">
      {/* 월 선택 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={() => handleMonthChange(-1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">{formatMonth(yearMonth)}</p>
            {isCurrentMonth && (
              <span className="text-sm text-orange-500 font-medium">이번달</span>
            )}
          </div>

          <button
            onClick={() => handleMonthChange(1)}
            className="p-3 rounded-xl bg-slate-100 active:bg-slate-200 transition"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className={`grid gap-3 ${orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'}`}>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={18} className="text-slate-500" />
            <span className="text-sm text-slate-500">전체</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{stats.total}명</p>
          <p className="text-sm text-slate-400">{formatCurrency(stats.totalAmount)}</p>
        </div>

        <div className="bg-green-50 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="text-sm text-green-600">완납</span>
          </div>
          <p className="text-2xl font-bold text-green-700">{stats.paid}명</p>
          <p className="text-sm text-green-500">{formatCurrency(stats.paidAmount)}</p>
        </div>

        <div className="bg-red-50 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={18} className="text-red-600" />
            <span className="text-sm text-red-600">미납</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{stats.unpaid}명</p>
          <p className="text-sm text-red-500">{formatCurrency(stats.unpaidAmount)}</p>
        </div>

        <div className="bg-yellow-50 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className="text-yellow-600" />
            <span className="text-sm text-yellow-600">부분납</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700">{stats.partial}명</p>
        </div>
      </div>

      {/* 검색바 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학생 이름으로 검색"
            className="w-full pl-12 pr-12 py-3 bg-slate-100 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[
          { key: 'all', label: '전체' },
          { key: 'unpaid', label: '미납' },
          { key: 'partial', label: '부분납' },
          { key: 'paid', label: '완납' },
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition ${
              statusFilter === filter.key
                ? 'bg-orange-500 text-white'
                : 'bg-white text-slate-600 shadow-sm'
            }`}
          >
            {filter.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={fetchPayments}
          className="p-2 text-slate-400 active:text-orange-500"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* 결제 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin text-orange-500" size={32} />
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
          <CreditCard size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">
            {search ? '검색 결과가 없습니다' : '결제 내역이 없습니다'}
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${
          orientation === 'landscape' ? 'grid-cols-3' : 'grid-cols-1'
        }`}>
          {filteredPayments.map(payment => {
            const config = STATUS_CONFIG[payment.payment_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;

            return (
              <div
                key={payment.id}
                className="bg-white rounded-2xl p-4 shadow-sm"
              >
                {/* 학생 정보 */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <User size={18} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{payment.student_name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${config.color}`}>
                      <StatusIcon size={12} />
                      {config.label}
                    </span>
                  </div>
                </div>

                {/* 금액 정보 */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">총 금액</span>
                    <span className="font-medium text-slate-800">{formatCurrency(payment.total_amount)}</span>
                  </div>

                  {payment.paid_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">납부</span>
                      <span className="text-green-600">{formatCurrency(payment.paid_amount)}</span>
                    </div>
                  )}

                  {payment.remaining_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">미납</span>
                      <span className="text-red-600 font-medium">{formatCurrency(payment.remaining_amount)}</span>
                    </div>
                  )}

                  {payment.payment_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">납부일</span>
                      <span className="text-slate-600">
                        {new Date(payment.payment_date).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  )}

                  {payment.payment_method && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">결제방법</span>
                      <span className="text-slate-600">{payment.payment_method}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
