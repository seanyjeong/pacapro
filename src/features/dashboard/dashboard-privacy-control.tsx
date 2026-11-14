import { Eye, EyeOff } from 'lucide-react';
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
        <Button
            type="button"
            variant={amountsVisible ? 'outline' : 'secondary'}
            onClick={amountsVisible ? onHide : onReveal}
            aria-label={amountsVisible ? '금액 가리기' : '금액 보기 (비밀번호 확인)'}
        >
            {amountsVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {amountsVisible ? '금액 가리기' : '금액 보기'}
        </Button>
    );
}
