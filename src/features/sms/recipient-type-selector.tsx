import { RecipientButton } from './recipient-button';
import type { RecipientType, SendMode, SmsRecipientsCount, SmsStudent } from './sms-types';

interface RecipientTypeSelectorProps {
  sendMode: SendMode;
  recipientType: RecipientType;
  recipientsCount: SmsRecipientsCount;
  selectedStudent: SmsStudent | null;
  onRecipientTypeChange: (value: RecipientType) => void;
}

export function RecipientTypeSelector({
  sendMode,
  recipientType,
  recipientsCount,
  selectedStudent,
  onRecipientTypeChange,
}: RecipientTypeSelectorProps) {
  if (sendMode === 'custom' || (sendMode === 'individual' && !selectedStudent)) return null;

  const studentDetail = sendMode === 'all' ? `${recipientsCount.students}명` : selectedStudent?.phone || '전화번호 미등록';
  const parentDetail = sendMode === 'all' ? `${recipientsCount.parents}명` : selectedStudent?.parent_phone || '전화번호 미등록';

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">수신자 선택</h3>
      <div className="grid grid-cols-2 gap-2">
        <RecipientButton
          label="학생에게"
          detail={studentDetail}
          selected={recipientType === 'student'}
          onClick={() => onRecipientTypeChange('student')}
        />
        <RecipientButton
          label="학부모에게"
          detail={parentDetail}
          selected={recipientType === 'parent'}
          onClick={() => onRecipientTypeChange('parent')}
        />
      </div>
    </section>
  );
}
