'use client';

import { Award, BookOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MockExamPanel } from './performance-mock-exam-panel';
import { NaesinPlaceholder } from './performance-naesin-placeholder';
import { PerformanceHeader } from './performance-header';
import { PerformanceSummary } from './performance-summary';
import { usePerformanceState } from './use-performance-state';

export function PerformancePage() {
  const state = usePerformanceState();

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4" data-testid="performance-workspace">
      <PerformanceHeader
        status={state.jungsiStatus}
        statusError={state.statusError}
        statusLoading={state.statusLoading}
        onRefreshStatus={state.loadStatus}
      />

      <PerformanceSummary
        status={state.jungsiStatus}
        statusLoading={state.statusLoading}
        students={state.students}
        studentsError={state.studentsError}
        studentsLoading={state.studentsLoading}
        studentStatusFilter={state.studentStatusFilter}
        onStudentStatusFilterChange={state.setStudentStatusFilter}
      />

      <main className="min-w-0">
        <Tabs value={state.activeTab} onValueChange={(value) => state.setActiveTab(value as '내신' | '모의고사')}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="내신" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              내신
            </TabsTrigger>
            <TabsTrigger value="모의고사" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              모의고사·수능
            </TabsTrigger>
          </TabsList>

          <TabsContent value="내신" className="mt-4">
            <NaesinPlaceholder />
          </TabsContent>

          <TabsContent value="모의고사" className="mt-4">
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
    </div>
  );
}
