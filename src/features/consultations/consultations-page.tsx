'use client';

import { AlertCircle, Calendar, Plus, RefreshCw, Search, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { BranchChecks } from '@/features/branches/branch-checks';
import { useBranchTree } from '@/hooks/use-branches';

import { useConsultations } from './_hooks/useConsultations';
import { ConsultationStatsCards } from './_components/ConsultationStatsCards';
import { ConsultationList } from './_components/ConsultationList';
import { DetailModal } from './_components/DetailModal';
import { StatusChangeModal } from './_components/StatusChangeModal';
import { DeleteModal } from './_components/DeleteModal';
import { TypeSelectModal } from './_components/TypeSelectModal';
import { DirectRegisterModal } from './_components/DirectRegisterModal';
import { EditInfoModal } from './_components/EditInfoModal';
import { TrialModal } from './_components/TrialModal';
import { LearningModal } from './_components/LearningModal';

export function ConsultationsPage() {
  const h = useConsultations();
  const { branches } = useBranchTree();
  const activeFilterCount = [h.statusFilter, h.typeFilter, h.dateFilter !== 'all' ? h.dateFilter : ''].filter(Boolean).length;

  return (
    <div className="space-y-4" data-testid="consultations-operations-workspace">
      <PageHeader
        title="상담 관리"
        description="신규·재원생 상담, 일정 변경, 후속 전환을 한곳에서 관리해요."
        actions={(
          <>
            <Button onClick={() => h.setTypeSelectOpen(true)}>
              <Plus className="h-4 w-4" />직접 등록
            </Button>
            <Link href="/consultations/new-inquiry">
              <Button variant="outline">
                <UserPlus className="h-4 w-4" />신규상담
              </Button>
            </Link>
            <Link href="/consultations/calendar">
              <Button variant="outline">
                <Calendar className="h-4 w-4" />달력 보기
              </Button>
            </Link>
            <Link href="/consultations/settings">
              <Button variant="outline">
                <Settings className="h-4 w-4" />상담 설정
              </Button>
            </Link>
          </>
        )}
      />

      <BranchChecks branches={branches} selected={h.branchIds} onChange={h.setBranchIds} />

      {h.loadError ? (
        <section className="flex flex-col gap-3 rounded-2xl bg-warning-soft p-4 text-warning sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold">상담 목록을 불러오지 못했어요</h2>
              <p className="mt-1 text-sm">잠시 후 다시 시도해 주세요.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={h.loadData}>
            <RefreshCw className="h-4 w-4" />
            다시 불러오기
          </Button>
        </section>
      ) : null}

      <ConsultationStatsCards
        stats={h.stats}
        statusFilter={h.statusFilter}
        onStatusFilter={h.setStatusFilter}
      />

      <ConsultationList
        branches={branches}
        consultations={h.consultations}
        loading={h.loading}
        pagination={h.pagination}
        setPagination={h.setPagination}
        filterBar={(
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center" data-testid="consultations-filter-bar">
            <Tabs value={h.dateFilter} onValueChange={(v) => h.setDateFilter(v as 'all' | 'today' | 'week')} className="w-auto">
              <TabsList className="w-full lg:w-auto">
                <TabsTrigger value="all">전체</TabsTrigger>
                <TabsTrigger value="today">오늘</TabsTrigger>
                <TabsTrigger value="week">이번 주</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="이름, 전화번호로 검색"
                className="pl-10"
                value={h.search}
                onChange={(e) => h.setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1 lg:w-[160px] lg:flex-none">
                <Select
                  value={h.typeFilter || 'all'}
                  onValueChange={(value) => h.setTypeFilter(value === 'all' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="상담 유형" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 유형</SelectItem>
                    <SelectItem value="new_registration">신규 등록</SelectItem>
                    <SelectItem value="learning">학습 상담</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" onClick={h.loadData} title="새로고침" aria-label="새로고침">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        activeFilterCount={activeFilterCount}
        onOpenDetail={h.openDetailModal}
        onOpenStatusModal={(c) => {
          h.setSelectedConsultation(c);
          h.setNewStatus(c.status);
          h.setAdminNotes(c.admin_notes || '');
          h.setStatusModalOpen(true);
        }}
        onOpenDeleteModal={(c) => {
          h.setSelectedConsultation(c);
          h.setDeleteModalOpen(true);
        }}
      />

      {/* 상세 모달 */}
      <DetailModal
        open={h.detailOpen}
        onOpenChange={h.setDetailOpen}
        consultation={h.selectedConsultation}
        onEditInfo={h.openEditInfoModal}
        onStatusChange={() => {
          h.setNewStatus(h.selectedConsultation?.status || 'pending');
          h.setAdminNotes(h.selectedConsultation?.admin_notes || '');
          h.setStatusModalOpen(true);
        }}
        onTrialRegister={() => h.setTrialModalOpen(true)}
      />

      {/* 상태/일정 변경 모달 */}
      <StatusChangeModal
        open={h.statusModalOpen}
        onOpenChange={h.setStatusModalOpen}
        consultation={h.selectedConsultation}
        newStatus={h.newStatus}
        setNewStatus={h.setNewStatus}
        adminNotes={h.adminNotes}
        setAdminNotes={h.setAdminNotes}
        newDate={h.newDate}
        newTime={h.newTime}
        setNewTime={h.setNewTime}
        editBookedTimes={h.editBookedTimes}
        loadingEditBookedTimes={h.loadingEditBookedTimes}
        editTimeOptions={h.editTimeOptions}
        handleEditDateChange={h.handleEditDateChange}
        handleStatusChange={h.handleStatusChange}
        updating={h.updating}
        onClose={() => h.setStatusModalOpen(false)}
      />

      {/* 삭제 확인 모달 */}
      <DeleteModal
        open={h.deleteModalOpen}
        onOpenChange={h.setDeleteModalOpen}
        consultation={h.selectedConsultation}
        deleting={h.deleting}
        handleDelete={h.handleDelete}
      />

      {/* 유형 선택 모달 */}
      <TypeSelectModal
        open={h.typeSelectOpen}
        onOpenChange={h.setTypeSelectOpen}
        onSelectNew={() => h.setDirectRegisterOpen(true)}
        onSelectLearning={() => { h.setLearningModalOpen(true); h.loadStudents(); }}
      />

      {/* 직접 등록 모달 */}
      <DirectRegisterModal
        open={h.directRegisterOpen}
        onOpenChange={h.setDirectRegisterOpen}
        directForm={h.directForm}
        setDirectForm={h.setDirectForm}
        registering={h.registering}
        bookedTimes={h.bookedTimes}
        loadingBookedTimes={h.loadingBookedTimes}
        timeOptions={h.timeOptions}
        handleDateChange={h.handleDateChange}
        handleDirectRegister={h.handleDirectRegister}
      />

      {/* 정보 수정 모달 */}
      <EditInfoModal
        open={h.editInfoModalOpen}
        onOpenChange={h.setEditInfoModalOpen}
        consultation={h.editInfoConsultation}
        editForm={h.editForm}
        setEditForm={h.setEditForm}
        savingInfo={h.savingInfo}
        handleSaveInfo={h.handleSaveInfo}
        onClose={() => h.setEditInfoConsultation(null)}
      />

      {/* 체험 일정 선택 모달 */}
      <TrialModal
        open={h.trialModalOpen}
        onOpenChange={h.setTrialModalOpen}
        consultation={h.selectedConsultation}
        trialDates={h.trialDates}
        setTrialDates={h.setTrialDates}
        convertingToTrial={h.convertingToTrial}
        addTrialDate={h.addTrialDate}
        removeTrialDate={h.removeTrialDate}
        handleConvertToTrial={h.handleConvertToTrial}
      />

      {/* 재원생 상담 등록 모달 */}
      <LearningModal
        open={h.learningModalOpen}
        onOpenChange={h.setLearningModalOpen}
        learningForm={h.learningForm}
        setLearningForm={h.setLearningForm}
        students={h.students}
        studentsLoading={h.studentsLoading}
        submittingLearning={h.submittingLearning}
        handleLearningSubmit={h.handleLearningSubmit}
      />
    </div>
  );
}
