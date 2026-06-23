'use client';

import Link from 'next/link';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Dumbbell,
  Plus,
  RefreshCw,
  Search,
  Settings,
  UserCheck,
  UsersRound,
  UserX,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { ConsultationListSection } from './_components/ConsultationListSection';
import { CreateModal } from './_components/CreateModal';
import { DeleteModal } from './_components/DeleteModal';
import { DetailModal } from './_components/DetailModal';
import { EditStudentModal } from './_components/EditStudentModal';
import { StatusChangeModal } from './_components/StatusChangeModal';
import { TrialModal } from './_components/TrialModal';
import { useNewInquiry } from './_hooks/useNewInquiry';
import { NewInquiryWorkQueue } from './new-inquiry-work-queue';

export function NewInquiryPage() {
  const h = useNewInquiry();
  const totalCount = h.stats.total || h.pagination.total || 0;
  const pendingCount = h.stats.pending || 0;
  const confirmedCount = h.stats.confirmed || 0;
  const hasWeeklyHours = h.weeklyHours.some((hour) => hour.isAvailable && hour.startTime && hour.endTime);

  const statCards = [
    { label: '전체', value: totalCount, helper: '신규상담 전체', icon: UsersRound, tone: 'text-slate-700 bg-slate-50' },
    { label: '대기중', value: pendingCount, helper: '확인 필요', icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
    { label: '확정', value: confirmedCount, helper: '일정 확정', icon: Calendar, tone: 'text-sky-700 bg-sky-50' },
    { label: '완료', value: h.stats.completed || 0, helper: '상담 완료', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: '등록완료', value: h.completedStats.registered, helper: '학생 전환', icon: UserCheck, tone: 'text-primary bg-primary/5' },
  ];

  const openStatusModal = (consultation: Consultation) => {
    h.setSelectedConsultation(consultation);
    h.setNewStatus(consultation.status as ConsultationStatus);
    h.setAdminNotes(consultation.admin_notes || '');
    h.setNewDate(consultation.preferred_date);
    h.setNewTime(consultation.preferred_time || '');
    h.setStatusModalOpen(true);
  };

  const openDeleteModal = (consultation: Consultation) => {
    h.setSelectedConsultation(consultation);
    h.setDeleteModalOpen(true);
  };

  const openTrialModal = (consultation: Consultation) => {
    h.setTrialConsultation(consultation);
    h.setTrialDates([{ date: '', timeSlot: '' }]);
    h.setTrialModalOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-24" data-testid="new-inquiry-operations-workspace">
      <header className="rounded-md border border-border bg-card px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-amber-100 bg-amber-50 text-amber-700">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Admissions Desk</p>
              <h1 className="text-2xl font-semibold tracking-normal text-foreground">신규상담</h1>
              <p className="mt-1 text-sm text-muted-foreground">상담 접수, 일정 확정, 등록 전환까지 한 화면에서 처리합니다.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/consultations">
              <Button className="gap-2" variant="outline">
                <ClipboardList className="h-4 w-4" />
                상담 관리
              </Button>
            </Link>
            <Link href="/consultations/settings">
              <Button className="gap-2" variant="outline">
                <Settings className="h-4 w-4" />
                상담 설정
              </Button>
            </Link>
            <Link href="/consultations/calendar?type=new">
              <Button className="gap-2" variant="outline">
                <Calendar className="h-4 w-4" />
                캘린더
              </Button>
            </Link>
            <Button className="gap-2" onClick={() => h.setCreateModalOpen(true)}>
              <Plus className="h-4 w-4" />
              신규상담 등록
            </Button>
          </div>
        </div>
      </header>

      {h.loadError ? (
        <section className="flex flex-col gap-3 rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
            <div className="space-y-1">
              <p className="text-sm font-semibold">{h.loadError}</p>
              <p className="text-xs text-rose-800">목록은 다시 불러올 수 있고, 신규상담 등록은 화면에서 계속 확인할 수 있습니다.</p>
            </div>
          </div>
          <Button className="shrink-0" size="sm" variant="outline" onClick={h.loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            다시 불러오기
          </Button>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <section key={card.label} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-1 text-2xl font-semibold tracking-normal text-foreground">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
                </div>
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-md', card.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-md border border-border bg-card p-4" data-testid="new-inquiry-filter-bar">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(event) => h.setSearch(event.target.value)}
                  placeholder="학생명, 연락처 검색..."
                  value={h.search}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_160px_auto]">
                <Select value={h.statusFilter} onValueChange={(value) => { h.setStatusFilter(value); h.setCompletedTab('all'); }}>
                  <SelectTrigger aria-label="상태 필터"><SelectValue placeholder="상태" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">전체</SelectItem>
                    <SelectItem value="pending">대기중</SelectItem>
                    <SelectItem value="confirmed">확정</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                    <SelectItem value="cancelled">취소</SelectItem>
                    <SelectItem value="no_show">노쇼</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={h.dateFilter} onValueChange={(value) => h.setDateFilter(value as 'all' | 'today' | 'week')}>
                  <SelectTrigger aria-label="기간 필터"><SelectValue placeholder="기간" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 기간</SelectItem>
                    <SelectItem value="today">오늘</SelectItem>
                    <SelectItem value="week">이번 주</SelectItem>
                  </SelectContent>
                </Select>
                <Button aria-label="새로고침" variant="outline" onClick={h.loadData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </section>

          {h.statusFilter === 'completed' ? <CompletedFilter h={h} /> : null}
          <TagFilter h={h} />

          <ConsultationListSection
            completedTab={h.completedTab}
            errorMessage={h.loadError}
            groupedByMonth={h.groupedByMonth}
            isMonthExpanded={h.isMonthExpanded}
            loading={h.loading}
            onDeleteModal={openDeleteModal}
            onEditStudent={h.openEditStudentModal}
            onRetry={h.loadData}
            onSelect={(consultation) => { h.setSelectedConsultation(consultation); h.setDetailOpen(true); }}
            onStatusModal={openStatusModal}
            onTrialModal={openTrialModal}
            statusFilter={h.statusFilter}
            toggleMonth={h.toggleMonth}
          />

          {h.pagination.totalPages > 1 ? (
            <div className="flex justify-center gap-2">
              <Button
                disabled={h.pagination.page === 1}
                onClick={() => h.setPagination({ ...h.pagination, page: h.pagination.page - 1 })}
                variant="outline"
              >
                이전
              </Button>
              <span className="flex items-center px-4">{h.pagination.page} / {h.pagination.totalPages}</span>
              <Button
                disabled={h.pagination.page === h.pagination.totalPages}
                onClick={() => h.setPagination({ ...h.pagination, page: h.pagination.page + 1 })}
                variant="outline"
              >
                다음
              </Button>
            </div>
          ) : null}
        </div>

        <NewInquiryWorkQueue
          confirmedCount={confirmedCount}
          hasWeeklyHours={hasWeeklyHours}
          onCreate={() => h.setCreateModalOpen(true)}
          pendingCount={pendingCount}
          registeredCount={h.completedStats.registered}
          totalCount={totalCount}
        />
      </div>

      <DetailModal
        consultation={h.selectedConsultation}
        onEditStudent={h.openEditStudentModal}
        onOpenChange={h.setDetailOpen}
        open={h.detailOpen}
      />
      <StatusChangeModal
        adminNotes={h.adminNotes}
        editBookedTimes={h.editBookedTimes}
        generateTimeSlots={h.generateTimeSlots}
        loadingEditBookedTimes={h.loadingEditBookedTimes}
        newDate={h.newDate}
        newStatus={h.newStatus}
        newTime={h.newTime}
        onAdminNotesChange={h.setAdminNotes}
        onDateChange={h.setNewDate}
        onLoadEditBookedTimes={h.loadEditBookedTimes}
        onOpenChange={h.setStatusModalOpen}
        onSave={h.handleStatusChange}
        onStatusChange={h.setNewStatus}
        onTimeChange={h.setNewTime}
        open={h.statusModalOpen}
        updating={h.updating}
      />
      <DeleteModal
        deleting={h.deleting}
        onDelete={h.handleDelete}
        onOpenChange={h.setDeleteModalOpen}
        open={h.deleteModalOpen}
      />
      <CreateModal
        bookedTimes={h.bookedTimes}
        createForm={h.createForm}
        creating={h.creating}
        generateTimeSlots={h.generateTimeSlots}
        hasWeeklyHours={hasWeeklyHours}
        loadingBookedTimes={h.loadingBookedTimes}
        onFormChange={h.setCreateForm}
        onLoadBookedTimes={h.loadBookedTimes}
        onOpenChange={h.setCreateModalOpen}
        onSubmit={h.handleCreateConsultation}
        open={h.createModalOpen}
      />
      <TrialModal
        convertingToTrial={h.convertingToTrial}
        onAddDate={h.addTrialDate}
        onOpenChange={h.setTrialModalOpen}
        onRemoveDate={h.removeTrialDate}
        onSubmit={h.handleConvertToTrial}
        onTrialDatesChange={h.setTrialDates}
        open={h.trialModalOpen}
        trialConsultation={h.trialConsultation}
        trialDates={h.trialDates}
      />
      <EditStudentModal
        editStudentForm={h.editStudentForm}
        onFormChange={h.setEditStudentForm}
        onOpenChange={h.setEditStudentModalOpen}
        onSave={h.handleUpdateStudent}
        open={h.editStudentModalOpen}
        selectedConsultation={h.selectedConsultation}
        updatingStudent={h.updatingStudent}
      />
    </div>
  );
}

type NewInquiryState = ReturnType<typeof useNewInquiry>;

function CompletedFilter({ h }: { h: NewInquiryState }) {
  const tabs = [
    { value: 'all', label: '전체', count: h.completedStats.total, icon: null, tone: '' },
    { value: 'unregistered', label: '미등록', count: h.completedStats.unregistered, icon: UserX, tone: 'text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:hover:bg-orange-950' },
    { value: 'trial_ongoing', label: '체험중', count: h.completedStats.trialOngoing, icon: Dumbbell, tone: 'text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-950' },
    { value: 'registered', label: '등록', count: h.completedStats.registered, icon: UserCheck, tone: 'text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950' },
  ] as const;

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-muted-foreground">완료 상담 분류:</span>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              className={cn('h-8', h.completedTab !== tab.value && tab.tone)}
              key={tab.value}
              onClick={() => h.setCompletedTab(tab.value)}
              size="sm"
              variant={h.completedTab === tab.value ? 'default' : 'outline'}
            >
              {Icon ? <Icon className="mr-1 h-3.5 w-3.5" /> : null}
              {tab.label}
              <Badge className="ml-1.5 px-1.5 py-0 text-xs" variant="secondary">{tab.count}</Badge>
            </Button>
          );
        })}
      </div>
    </section>
  );
}

function TagFilter({ h }: { h: NewInquiryState }) {
  const tags = [
    { tag: 'registered', label: '등록', icon: UserCheck, tone: 'text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950' },
    { tag: 'trial_completed', label: '체험완료', icon: Dumbbell, tone: 'text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950' },
    { tag: 'trial_ongoing', label: '체험중', icon: Dumbbell, tone: 'text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950' },
    { tag: 'unregistered', label: '미등록', icon: UserX, tone: 'text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950' },
    { tag: 'no_trial', label: '미체험', icon: null, tone: 'text-gray-600 border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900' },
  ] as const;

  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-muted-foreground">태그 필터:</span>
        {tags.map(({ tag, label, icon: Icon, tone }) => (
          <Button
            className={cn('h-7 text-xs', !h.selectedTags.includes(tag) && tone)}
            key={tag}
            onClick={() => h.toggleTag(tag)}
            size="sm"
            variant={h.selectedTags.includes(tag) ? 'default' : 'outline'}
          >
            {Icon ? <Icon className="mr-1 h-3 w-3" /> : null}
            {label}
          </Button>
        ))}
        {h.selectedTags.length > 0 ? (
          <Button className="h-7 text-xs text-muted-foreground" onClick={() => h.setSelectedTags([])} size="sm" variant="ghost">
            초기화
          </Button>
        ) : null}
      </div>
    </section>
  );
}
