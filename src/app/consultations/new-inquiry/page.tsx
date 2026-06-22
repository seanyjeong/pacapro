'use client';
// Phase 4 #3 (ADR-018) — 신규상담 페이지 thin orchestrator (~200줄)
// 원본: 1,682줄 단일 파일 → 분리:
//   _hooks/useNewInquiry.ts  (state + handler + derived)
//   _types.ts                (타입)
//   _components/DetailModal.tsx
//   _components/StatusChangeModal.tsx
//   _components/DeleteModal.tsx
//   _components/CreateModal.tsx
//   _components/TrialModal.tsx
//   _components/EditStudentModal.tsx
//   _components/ConsultationListSection.tsx

import {
  Calendar, CheckCircle2, ClipboardList, Clock3, Plus, RefreshCw, Search, Settings, UserCheck, UsersRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { UserX, Dumbbell } from 'lucide-react';
import Link from 'next/link';

import { useNewInquiry } from './_hooks/useNewInquiry';
import { DetailModal } from './_components/DetailModal';
import { StatusChangeModal } from './_components/StatusChangeModal';
import { DeleteModal } from './_components/DeleteModal';
import { CreateModal } from './_components/CreateModal';
import { TrialModal } from './_components/TrialModal';
import { EditStudentModal } from './_components/EditStudentModal';
import { ConsultationListSection } from './_components/ConsultationListSection';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';

export default function NewInquiryConsultationsPage() {
  const {
    // 목록 state
    loading, stats, pagination, setPagination,
    // 필터
    search, setSearch, statusFilter, setStatusFilter,
    dateFilter, setDateFilter,
    completedTab, setCompletedTab,
    selectedTags, toggleTag, setSelectedTags,
    // 월별 펼침
    isMonthExpanded, toggleMonth,
    // 모달 state + setters
    selectedConsultation, setSelectedConsultation,
    detailOpen, setDetailOpen,
    statusModalOpen, setStatusModalOpen,
    newStatus, setNewStatus,
    adminNotes, setAdminNotes,
    updating,
    newDate, setNewDate,
    newTime, setNewTime,
    editBookedTimes, loadingEditBookedTimes,
    deleteModalOpen, setDeleteModalOpen,
    deleting,
    createModalOpen, setCreateModalOpen,
    createForm, setCreateForm,
    creating,
    bookedTimes, loadingBookedTimes,
    trialModalOpen, setTrialModalOpen,
    trialConsultation, setTrialConsultation,
    trialDates, setTrialDates,
    convertingToTrial,
    editStudentModalOpen, setEditStudentModalOpen,
    editStudentForm, setEditStudentForm,
    updatingStudent,
    // 핸들러
    loadData, loadBookedTimes, loadEditBookedTimes, generateTimeSlots,
    handleCreateConsultation, handleStatusChange, handleDelete,
    addTrialDate, removeTrialDate, handleConvertToTrial,
    openEditStudentModal, handleUpdateStudent,
    // Derived 값
    completedStats, groupedByMonth,
  } = useNewInquiry();

  const statCards = [
    { label: '전체', value: stats.total || pagination.total || 0, helper: '신규상담 전체', icon: UsersRound, tone: 'text-slate-700 bg-slate-50' },
    { label: '대기중', value: stats.pending || 0, helper: '확인 필요', icon: Clock3, tone: 'text-amber-700 bg-amber-50' },
    { label: '확정', value: stats.confirmed || 0, helper: '일정 확정', icon: Calendar, tone: 'text-sky-700 bg-sky-50' },
    { label: '완료', value: stats.completed || 0, helper: '상담 완료', icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50' },
    { label: '등록완료', value: completedStats.registered, helper: '학생 전환', icon: UserCheck, tone: 'text-primary bg-primary/5' },
  ];

  // 상태변경 모달 열기 헬퍼
  const openStatusModal = (c: Consultation) => {
    setSelectedConsultation(c);
    setNewStatus(c.status as ConsultationStatus);
    setAdminNotes(c.admin_notes || '');
    setNewDate(c.preferred_date);
    setNewTime(c.preferred_time || '');
    setStatusModalOpen(true);
  };

  // 삭제 모달 열기 헬퍼
  const openDeleteModal = (c: Consultation) => {
    setSelectedConsultation(c);
    setDeleteModalOpen(true);
  };

  // 체험 모달 열기 헬퍼
  const openTrialModal = (c: Consultation) => {
    setTrialConsultation(c);
    setTrialDates([{ date: '', timeSlot: '' }]);
    setTrialModalOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-24">
      <header className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Admissions Desk</p>
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">신규상담</h1>
          <p className="text-sm text-muted-foreground">상담 접수, 일정 확정, 등록 전환까지 한 화면에서 처리합니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link href="/consultations">
            <Button className="w-full justify-center sm:w-auto" variant="outline">
              <ClipboardList className="h-4 w-4 mr-2" />
              상담 관리
            </Button>
          </Link>
          <Link href="/consultations/settings">
            <Button className="w-full justify-center sm:w-auto" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              상담 설정
            </Button>
          </Link>
          <Link href="/consultations/calendar?type=new">
            <Button className="w-full justify-center sm:w-auto" variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              캘린더
            </Button>
          </Link>
          <Button className="w-full justify-center sm:w-auto" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            신규상담 등록
          </Button>
        </div>
      </header>

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

      <section className="rounded-md border border-border bg-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="학생명, 연락처 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[160px_160px_auto]">
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCompletedTab('all'); }}>
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
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as 'all' | 'today' | 'week')}>
              <SelectTrigger aria-label="기간 필터"><SelectValue placeholder="기간" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                <SelectItem value="today">오늘</SelectItem>
                <SelectItem value="week">이번 주</SelectItem>
              </SelectContent>
            </Select>
            <Button aria-label="새로고침" variant="outline" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* 완료 탭 필터 */}
      {statusFilter === 'completed' && (
        <section className="rounded-md border border-border bg-card p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground mr-2">완료 상담 분류:</span>
              <div className="flex gap-1 flex-wrap">
                <Button variant={completedTab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCompletedTab('all')} className="h-8">
                  전체<Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">{completedStats.total}</Badge>
                </Button>
                <Button
                  variant={completedTab === 'unregistered' ? 'default' : 'outline'} size="sm"
                  onClick={() => setCompletedTab('unregistered')}
                  className={cn("h-8", completedTab !== 'unregistered' && "text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:border-orange-800 dark:hover:bg-orange-950")}
                >
                  <UserX className="h-3.5 w-3.5 mr-1" />미등록<Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">{completedStats.unregistered}</Badge>
                </Button>
                <Button
                  variant={completedTab === 'trial_ongoing' ? 'default' : 'outline'} size="sm"
                  onClick={() => setCompletedTab('trial_ongoing')}
                  className={cn("h-8", completedTab !== 'trial_ongoing' && "text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-950")}
                >
                  <Dumbbell className="h-3.5 w-3.5 mr-1" />체험중<Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">{completedStats.trialOngoing}</Badge>
                </Button>
                <Button
                  variant={completedTab === 'registered' ? 'default' : 'outline'} size="sm"
                  onClick={() => setCompletedTab('registered')}
                  className={cn("h-8", completedTab !== 'registered' && "text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:border-green-800 dark:hover:bg-green-950")}
                >
                  <UserCheck className="h-3.5 w-3.5 mr-1" />등록<Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">{completedStats.registered}</Badge>
                </Button>
              </div>
            </div>
        </section>
      )}

      {/* 태그 필터 */}
      <section className="rounded-md border border-border bg-card p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground mr-2">태그 필터:</span>
            <div className="flex gap-1 flex-wrap">
              {([
                { tag: 'registered' as const, label: '등록', icon: <UserCheck className="h-3 w-3 mr-1" />, colorClass: 'text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-950' },
                { tag: 'trial_completed' as const, label: '체험완료', icon: <Dumbbell className="h-3 w-3 mr-1" />, colorClass: 'text-purple-600 border-purple-200 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-950' },
                { tag: 'trial_ongoing' as const, label: '체험중', icon: <Dumbbell className="h-3 w-3 mr-1" />, colorClass: 'text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950' },
                { tag: 'unregistered' as const, label: '미등록', icon: <UserX className="h-3 w-3 mr-1" />, colorClass: 'text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-950' },
                { tag: 'no_trial' as const, label: '미체험', icon: null, colorClass: 'text-gray-600 border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900' },
              ] as const).map(({ tag, label, icon, colorClass }) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleTag(tag)}
                  className={cn('h-7 text-xs', !selectedTags.includes(tag) && colorClass)}
                >
                  {icon}{label}
                </Button>
              ))}
              {selectedTags.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedTags([])} className="h-7 text-xs text-muted-foreground">
                  초기화
                </Button>
              )}
            </div>
          </div>
      </section>

      {/* 목록 */}
      <ConsultationListSection
        loading={loading}
        statusFilter={statusFilter}
        completedTab={completedTab}
        groupedByMonth={groupedByMonth}
        isMonthExpanded={isMonthExpanded}
        toggleMonth={toggleMonth}
        onSelect={(c) => { setSelectedConsultation(c); setDetailOpen(true); }}
        onStatusModal={openStatusModal}
        onEditStudent={openEditStudentModal}
        onTrialModal={openTrialModal}
        onDeleteModal={openDeleteModal}
      />

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}>이전</Button>
          <span className="flex items-center px-4">{pagination.page} / {pagination.totalPages}</span>
          <Button variant="outline" disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}>다음</Button>
        </div>
      )}

      {/* 모달들 */}
      <DetailModal
        open={detailOpen}
        onOpenChange={setDetailOpen}
        consultation={selectedConsultation}
        onEditStudent={openEditStudentModal}
      />
      <StatusChangeModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        newStatus={newStatus}
        onStatusChange={setNewStatus}
        adminNotes={adminNotes}
        onAdminNotesChange={setAdminNotes}
        newDate={newDate}
        onDateChange={setNewDate}
        newTime={newTime}
        onTimeChange={setNewTime}
        editBookedTimes={editBookedTimes}
        loadingEditBookedTimes={loadingEditBookedTimes}
        generateTimeSlots={generateTimeSlots}
        onLoadEditBookedTimes={loadEditBookedTimes}
        onSave={handleStatusChange}
        updating={updating}
      />
      <DeleteModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onDelete={handleDelete}
        deleting={deleting}
      />
      <CreateModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        createForm={createForm}
        onFormChange={setCreateForm}
        creating={creating}
        bookedTimes={bookedTimes}
        loadingBookedTimes={loadingBookedTimes}
        generateTimeSlots={generateTimeSlots}
        onLoadBookedTimes={loadBookedTimes}
        onSubmit={handleCreateConsultation}
      />
      <TrialModal
        open={trialModalOpen}
        onOpenChange={setTrialModalOpen}
        trialConsultation={trialConsultation}
        trialDates={trialDates}
        onTrialDatesChange={setTrialDates}
        onAddDate={addTrialDate}
        onRemoveDate={removeTrialDate}
        onSubmit={handleConvertToTrial}
        convertingToTrial={convertingToTrial}
      />
      <EditStudentModal
        open={editStudentModalOpen}
        onOpenChange={setEditStudentModalOpen}
        selectedConsultation={selectedConsultation}
        editStudentForm={editStudentForm}
        onFormChange={setEditStudentForm}
        onSave={handleUpdateStudent}
        updatingStudent={updatingStudent}
      />
    </div>
  );
}
