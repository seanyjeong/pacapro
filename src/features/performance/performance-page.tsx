'use client';

import { Award, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MockExamPanel } from './performance-mock-exam-panel';
import { NaesinPlaceholder } from './performance-naesin-placeholder';
import { PerformanceHeader } from './performance-header';
import { PerformanceOperationsBoard } from './performance-operations-board';
import { usePerformanceState } from './use-performance-state';

export function PerformancePage() {
  const state = usePerformanceState();

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl" data-testid="performance-workspace">
      <PerformanceHeader
        status={state.jungsiStatus}
        statusError={state.statusError}
        statusLoading={state.statusLoading}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <main className="order-2 min-w-0 xl:order-1">
          <Tabs value={state.activeTab} onValueChange={(value) => state.setActiveTab(value as '내신' | '모의고사')}>
            <TabsList className="grid w-full max-w-md grid-cols-2 rounded-md border border-border bg-muted/40 p-1">
              <TabsTrigger value="내신" className="flex items-center gap-2 rounded-sm">
                <BookOpen className="h-4 w-4" />
                내신
              </TabsTrigger>
              <TabsTrigger value="모의고사" className="flex items-center gap-2 rounded-sm">
                <Award className="h-4 w-4" />
                모의고사·수능
              </TabsTrigger>
            </TabsList>

            <TabsContent value="내신" className="mt-5">
              <NaesinPlaceholder />
            </TabsContent>

            <TabsContent value="모의고사" className="mt-5">
              <MockExamPanel
                expandedStudentId={state.expandedStudentId}
                jungsiStatus={state.jungsiStatus}
                scores={state.studentScores}
                scoresError={state.scoresError}
                scoresLoading={state.scoresLoading}
                searchQuery={state.searchQuery}
                statusError={state.statusError}
                students={state.filteredStudents}
                studentsError={state.studentsError}
                studentsLoading={state.studentsLoading}
                onRefreshStatus={state.loadStatus}
                onRefreshStudents={state.loadStudents}
                onSearchChange={state.setSearchQuery}
                onStudentToggle={state.openStudentScores}
              />
            </TabsContent>
          </Tabs>
        </main>

        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <PerformanceOperationsBoard
            status={state.jungsiStatus}
            statusError={state.statusError}
            statusLoading={state.statusLoading}
            students={state.students}
            studentsError={state.studentsError}
            studentsLoading={state.studentsLoading}
            studentStatusFilter={state.studentStatusFilter}
            onOpenMockExam={() => state.setActiveTab('모의고사')}
            onRefreshStatus={state.loadStatus}
            onRefreshStudents={state.loadStudents}
            onStudentStatusFilterChange={state.setStudentStatusFilter}
          />
        </div>
      </div>
    </div>
  );
}
