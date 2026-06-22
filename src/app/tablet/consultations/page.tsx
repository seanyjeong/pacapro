'use client';

import { useCallback, useEffect, useState } from 'react';
import { TabletConsultationsError } from '@/features/tablet-consultations/tablet-consultations-error';
import { TabletConsultationsFilterBar } from '@/features/tablet-consultations/tablet-consultations-filter-bar';
import { TabletConsultationsList } from '@/features/tablet-consultations/tablet-consultations-list';
import { TabletConsultationsLoading } from '@/features/tablet-consultations/tablet-consultations-loading';
import { TabletConsultationsOperations } from '@/features/tablet-consultations/tablet-consultations-operations';
import {
  formatTabletConsultationDate,
  isSelectedDateToday,
  moveTabletConsultationDate,
  sortTabletConsultations,
  type TabletConsultationDateFilter,
  type TabletConsultationStats,
} from '@/features/tablet-consultations/tablet-consultations-utils';
import { getConsultations } from '@/lib/api/consultations';
import type { Consultation } from '@/lib/types/consultation';
import { getToday } from '@/lib/utils/schedule-helpers';

export default function TabletConsultationsPage() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [dateFilter, setDateFilter] = useState<TabletConsultationDateFilter>('selected');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(getToday);
  const [stats, setStats] = useState<TabletConsultationStats>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const params: {
        endDate?: string;
        search?: string;
        startDate?: string;
      } = {};

      const keyword = search.trim();
      if (keyword) params.search = keyword;
      if (dateFilter === 'selected') {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      }

      const response = await getConsultations(params, { suppressErrorToast: true });
      setConsultations(sortTabletConsultations(response.consultations || []));
      setStats(response.stats || {});
    } catch {
      setConsultations([]);
      setStats({});
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, search, selectedDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToday = () => {
    setDateFilter('selected');
    setSelectedDate(getToday());
  };

  if (loading) {
    return <TabletConsultationsLoading />;
  }

  if (error) {
    return <TabletConsultationsError onRetry={loadData} />;
  }

  return (
    <div className="space-y-5">
      <TabletConsultationsOperations
        consultations={consultations}
        dateLabel={formatTabletConsultationDate(selectedDate)}
        isToday={isSelectedDateToday(selectedDate)}
        loading={loading}
        stats={stats}
        onDateMove={(delta) => {
          setDateFilter('selected');
          setSelectedDate((current) => moveTabletConsultationDate(current, delta));
        }}
        onRefresh={loadData}
        onToday={handleToday}
      />

      <TabletConsultationsFilterBar
        dateFilter={dateFilter}
        search={search}
        onDateFilterChange={setDateFilter}
        onSearchChange={setSearch}
      />

      <TabletConsultationsList consultations={consultations} dateFilter={dateFilter} />
    </div>
  );
}
