import { Phone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface CustomPhoneFieldsProps {
  phones: string[];
  onPhoneChange: (index: number, value: string) => void;
  onAddPhone: () => void;
  onRemovePhone: (index: number) => void;
}

export function CustomPhoneFields({ phones, onPhoneChange, onAddPhone, onRemovePhone }: CustomPhoneFieldsProps) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold text-foreground">전화번호 직접 입력</h3>
        <p className="text-xs text-muted-foreground">입력 중 하이픈이 자동으로 정리됩니다.</p>
      </div>
      <div className="space-y-2">
        {phones.map((phone, index) => (
          <div key={`${index}-${phones.length}`} className="flex gap-2">
            <Input
              type="tel"
              value={phone}
              onChange={(event) => onPhoneChange(index, event.target.value)}
              placeholder="010-1234-5678"
              maxLength={13}
            />
            {phones.length > 1 && (
              <Button type="button" variant="outline" size="icon" onClick={() => onRemovePhone(index)} aria-label="번호 삭제">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAddPhone} className="gap-2">
        <Phone className="h-4 w-4" />
        번호 추가
      </Button>
    </section>
  );
}
