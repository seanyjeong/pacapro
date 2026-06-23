import type { GradeFilter, MessageType, RecipientType, SendMode, SmsImageFile, SmsRecipientsCount, SmsStudent } from './sms-types';
import type { SendSMSParams } from '@/lib/api/sms';

export function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/[^0-9]/g, '');
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
}

export function getContentBytes(content: string): number {
  return new TextEncoder().encode(content).length;
}

export function getMessageType(contentBytes: number, imageCount: number): MessageType {
  if (imageCount > 0) return 'MMS';
  return contentBytes > 80 ? 'LMS' : 'SMS';
}

export function getRecipientCount(
  sendMode: SendMode,
  recipientType: RecipientType,
  customPhones: string[],
  recipientsCount: SmsRecipientsCount
): number {
  if (sendMode === 'custom') return customPhones.filter((phone) => phone.trim()).length;
  if (sendMode === 'individual') return 1;
  return recipientType === 'student' ? recipientsCount.students : recipientsCount.parents;
}

export function getIndividualTargetPhone(
  student: SmsStudent | null,
  recipientType: RecipientType
): string | null {
  if (!student) return null;
  return recipientType === 'student' ? student.phone : student.parent_phone;
}

export function buildSmsPayload(params: {
  sendMode: SendMode;
  recipientType: RecipientType;
  content: string;
  customPhones: string[];
  selectedStudent: SmsStudent | null;
  images: SmsImageFile[];
  statusFilter: 'active' | 'pending';
  gradeFilter: GradeFilter;
  senderNumberId: number | null;
}): SendSMSParams {
  const imageData = params.images.length > 0
    ? params.images.map((image) => ({ name: image.name, data: image.data }))
    : undefined;
  const senderNumberId = params.senderNumberId || undefined;

  if (params.sendMode === 'custom') {
    return {
      target: 'custom',
      content: params.content,
      customPhones: params.customPhones.map((phone) => phone.trim()).filter(Boolean),
      images: imageData,
      senderNumberId,
    };
  }

  if (params.sendMode === 'individual') {
    const targetPhone = getIndividualTargetPhone(params.selectedStudent, params.recipientType);
    return {
      target: 'custom',
      content: params.content,
      customPhones: targetPhone ? [targetPhone] : [],
      images: imageData,
      senderNumberId,
    };
  }

  return {
    target: params.recipientType === 'student' ? 'students' : 'parents',
    content: params.content,
    images: imageData,
    statusFilter: params.statusFilter,
    gradeFilter: params.gradeFilter,
    senderNumberId,
  };
}
