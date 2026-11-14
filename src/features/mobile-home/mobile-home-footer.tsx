import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileHomeFooterProps {
  version: string;
  onLogout: () => void;
}

export function MobileHomeFooter({ version, onLogout }: MobileHomeFooterProps) {
  return (
    <footer className="space-y-2 pt-2">
      <Button variant="ghost" onClick={onLogout} className="h-12 w-full text-muted-foreground hover:text-foreground">
        <LogOut className="h-5 w-5" />
        로그아웃
      </Button>
      <p className="text-center text-xs text-muted-foreground">P-ACA 모바일 v{version}</p>
    </footer>
  );
}
