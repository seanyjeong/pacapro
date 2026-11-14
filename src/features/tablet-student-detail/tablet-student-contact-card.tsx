import { Phone } from 'lucide-react';
import { SectionCard } from '@/components/ui/page';
import { formatTabletPhone } from '@/features/tablet-students/tablet-student-utils';
import type { TabletStudentDetail } from './tablet-student-detail-types';

interface TabletStudentContactCardProps {
  student: TabletStudentDetail;
}

export function TabletStudentContactCard({ student }: TabletStudentContactCardProps) {
  return (
    <SectionCard title="연락처">
      <div className="grid gap-x-6 sm:grid-cols-2">
        <ContactItem label="학생" value={formatTabletPhone(student.phone)} />
        <ContactItem label="대표 학부모" value={formatTabletPhone(student.parent_phone)} />
        <ContactItem label="아버지" value={formatTabletPhone(student.father_phone || null)} />
        <ContactItem label="어머니" value={formatTabletPhone(student.mother_phone || null)} />
      </div>
    </SectionCard>
  );
}

function ContactItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Phone className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="text-[15px] font-semibold text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}
