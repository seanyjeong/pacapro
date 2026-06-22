'use client';

import { AlertCircle, Calendar, ClipboardList, Plus, RefreshCw, Search, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';

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

export default function ConsultationsPage() {
  const h = useConsultations();
  const activeFilterCount = [h.statusFilter, h.typeFilter, h.dateFilter !== 'all' ? h.dateFilter : ''].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
        <header className="rounded-md border border-border bg-card px-5 py-4 shadow-none">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                <ClipboardList className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Consultation Desk</p>
                <h1 className="text-2xl font-semibold tracking-normal text-foreground">상담 관리</h1>
                <p className="mt-1 text-sm text-muted-foreground">신규 상담, 재원생 상담, 일정 변경과 후속 전환을 한 화면에서 관리합니다.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => h.setTypeSelectOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />직접 등록
              </Button>
              <Link href="/consultations/new-inquiry">
                <Button variant="outline" className="gap-2">
                  <UserPlus className="h-4 w-4" />신규상담
                </Button>
              </Link>
              <Link href="/consultations/calendar">
                <Button variant="outline" className="gap-2">
                  <Calendar className="h-4 w-4" />달력 보기
                </Button>
              </Link>
              <Link href="/consultations/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />상담 설정
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {h.loadError ? (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold">상담 목록을 불러오지 못했습니다</h2>
                <p className="mt-1 text-sm">잠시 후 다시 시도해주세요.</p>
              </div>
            </div>
          </section>
        ) : null}

        <ConsultationStatsCards
          stats={h.stats}
          statusFilter={h.statusFilter}
          onStatusFilter={h.setStatusFilter}
        />

        <Card className="rounded-md shadow-none">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <Tabs value={h.dateFilter} onValueChange={(v) => h.setDateFilter(v as 'all' | 'today' | 'week')}>
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="all">전체</TabsTrigger>
                  <TabsTrigger value="today">오늘</TabsTrigger>
                  <TabsTrigger value="week">이번 주</TabsTrigger>
                </TabsList>
              </Tabs>
              <span className="whitespace-nowrap rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                활성 필터 {activeFilterCount}개
              </span>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="이름, 전화번호로 검색..."
                  className="pl-9"
                  value={h.search}
                  onChange={(e) => h.setSearch(e.target.value)}
                />
              </div>
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
              <Button variant="outline" className="gap-2" onClick={h.loadData}>
                <RefreshCw className="h-4 w-4" />새로고침
              </Button>
            </div>
          </CardContent>
        </Card>

        <ConsultationList
          consultations={h.consultations}
          loading={h.loading}
          pagination={h.pagination}
          setPagination={h.setPagination}
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
    </main>
  );
}
