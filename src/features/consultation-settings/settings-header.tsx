import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SettingsHeaderProps {
  academyName: string;
}

export function SettingsHeader({ academyName }: SettingsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/consultations">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">상담 예약 설정</h1>
          <p className="text-muted-foreground">{academyName}</p>
        </div>
      </div>
    </div>
  );
}
