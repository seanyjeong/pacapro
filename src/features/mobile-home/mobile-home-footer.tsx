import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MobileHomeFooterProps {
  version: string;
  onLogout: () => void;
}

export function MobileHomeFooter({ version, onLogout }: MobileHomeFooterProps) {
  return (
    <footer className="space-y-3">
      <Button variant="ghost" onClick={onLogout} className="h-12 w-full text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50">
        <LogOut className="mr-2 h-5 w-5" />
        로그아웃
      </Button>
      <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">P-ACA Mobile v{version}</p>
    </footer>
  );
}
