import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardPrivacyControlProps {
    amountsVisible: boolean;
    onReveal: () => void;
    onHide: () => void;
}

export function DashboardPrivacyControl({
    amountsVisible,
    onReveal,
    onHide,
}: DashboardPrivacyControlProps) {
    return (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
            <span className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" />
                {amountsVisible ? '금액 표시 중' : '금액 가림'}
            </span>
            <Button
                type="button"
                variant={amountsVisible ? 'outline' : 'default'}
                size="sm"
                className="h-8 gap-1.5"
                onClick={amountsVisible ? onHide : onReveal}
            >
                {amountsVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {amountsVisible ? '가리기' : '금액 보기'}
            </Button>
        </div>
    );
}
