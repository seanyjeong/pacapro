import { Phone } from 'lucide-react';
import { formatTabletPhone } from '@/features/tablet-students/tablet-student-utils';
import type { TabletStudentDetail } from './tablet-student-detail-types';

interface TabletStudentContactCardProps {
  student: TabletStudentDetail;
}

export function TabletStudentContactCard({ student }: TabletStudentContactCardProps) {
  return (
    <section className="rounded-md border border-border bg-background p-5">
      <h2 className="mb-4 font-semibold text-foreground">연락처</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ContactItem label="학생" value={formatTabletPhone(student.phone)} />
        <ContactItem label="학부모" value={formatTabletPhone(student.parent_phone)} />
      </div>
    </section>
  );
}

function ContactItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Phone className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-foreground">{value}</p>
      </div>
    </div>
  );
}
