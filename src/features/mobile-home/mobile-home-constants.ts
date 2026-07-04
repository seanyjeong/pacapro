import {
  CalendarClock,
  CreditCard,
  MessageSquare,
  MessageSquarePlus,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { NotificationSettings } from '@/lib/api/notificationSettings';
import type { MobileHomeMenuItem, MobilePushSettingItem } from './mobile-home-types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  unpaid_attendance: true,
  consultation_reminder: true,
  new_consultation: true,
  pause_ending: true,
};

export const MOBILE_HOME_MESSAGES = {
  noPermissionRefreshFailed: '권한 상태를 다시 확인하지 못했습니다. 잠시 후 다시 시도해주세요.',
  noPermissionUnchanged: '아직 부여된 모바일 권한이 없습니다. 원장님에게 필요한 권한 부여를 요청해주세요.',
  pushDenied: '브라우저 알림 권한이 꺼져 있습니다. 기기 설정에서 알림 권한을 허용해주세요.',
  pushEnableFailed: '푸시 알림을 켜지 못했습니다. 잠시 후 다시 시도해주세요.',
  pushDisableFailed: '푸시 알림을 끄지 못했습니다. 잠시 후 다시 시도해주세요.',
  settingFailed: '알림 설정을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.',
};

export function makeMobileHomeMenu(permissions: {
  schedules: boolean;
  payments: boolean;
  consultations: boolean;
}): MobileHomeMenuItem[] {
  return [
    {
      href: '/m/attendance',
      icon: UserCheck,
      label: '학생 출석체크',
      description: '날짜와 시간대별 출석 관리',
      tone: 'blue',
      permission: permissions.schedules,
    },
    {
      href: '/m/instructor',
      icon: Users,
      label: '강사 출근체크',
      description: '강사 출퇴근 기록',
      tone: 'violet',
      permission: permissions.schedules,
    },
    {
      href: '/m/unpaid',
      icon: CreditCard,
      label: '미납자 확인',
      description: '오늘 수업 미납 학생 확인',
      tone: 'amber',
      permission: permissions.payments,
    },
    {
      href: '/m/consultations',
      icon: MessageSquare,
      label: '오늘 상담',
      description: '오늘 예정된 상담 목록',
      tone: 'emerald',
      permission: permissions.consultations,
    },
  ];
}

export const MOBILE_PUSH_SETTING_ITEMS: MobilePushSettingItem[] = [
  { key: 'unpaid_attendance', icon: CreditCard, title: '미납자 출석 알림', description: '18:00, 21:00' },
  { key: 'consultation_reminder', icon: CalendarClock, title: '상담 30분 전 알림', description: '상담 리마인더' },
  { key: 'new_consultation', icon: MessageSquarePlus, title: '새 상담 예약', description: '즉시 알림' },
  { key: 'pause_ending', icon: UserPlus, title: '휴원 종료 알림', description: '09:00' },
];
