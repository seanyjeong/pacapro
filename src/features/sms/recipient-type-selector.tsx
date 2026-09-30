import { RecipientButton } from './recipient-button';
import { getIndividualTargetPhone } from './sms-utils';
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

  const options: { type: RecipientType; label: string; count: number }[] = [
    { type: 'student', label: '학생에게', count: recipientsCount.students },
    { type: 'father', label: '아버님께', count: recipientsCount.fathers },
    { type: 'mother', label: '어머님께', count: recipientsCount.mothers },
    { type: 'parent', label: '학부모 대표번호로', count: recipientsCount.parents },
  ];

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">수신자 선택</h3>
      <div className="grid grid-cols-2 gap-2">
        {options.map(({ type, label, count }) => (
          <RecipientButton
            key={type}
            label={label}
            detail={sendMode === 'all' ? `${count}명` : getIndividualTargetPhone(selectedStudent, type) || '전화번호 미등록'}
            selected={recipientType === type}
            onClick={() => onRecipientTypeChange(type)}
          />
        ))}
      </div>
    </section>
  );
}
