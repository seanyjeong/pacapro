'use client';

import { Search, RefreshCw, Plus, Calendar, Settings, UserPlus } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">상담 관리</h1>
          <p className="text-muted-foreground">상담 신청 내역을 관리합니다.</p>
        </div>
        <div className="flex gap-2">
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

      {/* 통계 카드 */}
      <ConsultationStatsCards
        stats={h.stats}
        statusFilter={h.statusFilter}
        onStatusFilter={h.setStatusFilter}
      />

      {/* 날짜 탭 */}
      <Tabs value={h.dateFilter} onValueChange={(v) => h.setDateFilter(v as 'all' | 'today' | 'week')}>
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="today">오늘</TabsTrigger>
          <TabsTrigger value="week">이번 주</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 필터 */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="이름, 전화번호로 검색..."
                className="pl-9"
                value={h.search}
                onChange={(e) => h.setSearch(e.target.value)}
              />
            </div>
            <Select value={h.typeFilter} onValueChange={h.setTypeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="상담 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">전체</SelectItem>
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

      {/* 목록 + 페이지네이션 */}
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
        setSelectedConsultation={h.setSelectedConsultation}
        setNewStatus={h.setNewStatus}
        setAdminNotes={h.setAdminNotes}
        setStatusModalOpen={h.setStatusModalOpen}
        setDeleteModalOpen={h.setDeleteModalOpen}
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
