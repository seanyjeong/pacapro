'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Credit, CreditStats, CreditTypeStats, StudentWithCredit } from '@/lib/types/payment';
import { getCreditsForPage, getCreditsSummaryForPage } from './credits-page-api';
import type { CreditFilters, CreditStatusFilter, CreditTypeFilter } from './credits-types';
import { EMPTY_CREDIT_STATS, normalizeCreditsResponse, normalizeCreditsSummary } from './credits-utils';

const LOAD_ERROR_MESSAGE = '크레딧 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function useCreditsPageState() {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [stats, setStats] = useState<CreditStats>(EMPTY_CREDIT_STATS);
  const [studentsWithCredit, setStudentsWithCredit] = useState<StudentWithCredit[]>([]);
  const [typeStats, setTypeStats] = useState<CreditTypeStats[]>([]);
  const [filters, setFilters] = useState<CreditFilters>({ status: 'all', type: 'all' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCredits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [creditsResponse, summaryResponse] = await Promise.all([
        getCreditsForPage(filters),
        getCreditsSummaryForPage(),
      ]);
      const normalizedCredits = normalizeCreditsResponse(creditsResponse);
      const normalizedSummary = normalizeCreditsSummary(summaryResponse);
      setCredits(normalizedCredits.credits);
      setStats(normalizedCredits.stats);
      setStudentsWithCredit(normalizedSummary.studentsWithCredit);
      setTypeStats(normalizedSummary.typeStats);
    } catch {
      setError(LOAD_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  const setStatusFilter = (status: CreditStatusFilter) => {
    setFilters((current) => ({ ...current, status }));
  };

  const setTypeFilter = (type: CreditTypeFilter) => {
    setFilters((current) => ({ ...current, type }));
  };

  return {
    credits,
    stats,
    studentsWithCredit,
    typeStats,
    filters,
    loading,
    error,
    reload: loadCredits,
    setStatusFilter,
    setTypeFilter,
  };
}
