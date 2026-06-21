import type { RecipientsCountResponse, SenderNumber, SMSLog } from '@/lib/api/sms';

export type SendMode = 'all' | 'individual' | 'custom';
export type RecipientType = 'student' | 'parent';
export type StatusFilter = 'active' | 'pending';
export type GradeFilter = 'all' | 'junior' | 'senior';
export type MessageType = 'SMS' | 'LMS' | 'MMS';

export interface SmsStudent {
  id: number;
  name: string;
  phone: string | null;
  parent_phone: string | null;
}

export interface SmsImageFile {
  name: string;
  data: string;
  preview: string;
}

export type SmsRecipientsCount = RecipientsCountResponse;
export type SmsSenderNumber = SenderNumber;
export type SmsLog = SMSLog;
