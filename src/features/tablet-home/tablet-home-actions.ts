import {
  Calendar,
  CalendarCheck,
  CreditCard,
  MessageSquare,
  Send,
  Settings,
  Users,
} from 'lucide-react';
import type { TabletHomeAction } from './tablet-home-types';

export const TABLET_HOME_ACTIONS: TabletHomeAction[] = [
  {
    description: '오늘 수업 출석을 바로 체크합니다.',
    href: '/tablet/attendance',
    icon: CalendarCheck,
    label: '오늘 출석 운영',
    permissionKey: 'schedules',
    priority: true,
  },
  {
    description: '학생 검색, 상세, 결제, 문자로 이어집니다.',
    href: '/tablet/students',
    icon: Users,
    label: '학생 통합 관리',
    permissionKey: 'students',
    priority: true,
  },
  {
    description: '미납과 납부 확인을 빠르게 처리합니다.',
    href: '/tablet/payments',
    icon: CreditCard,
    label: '결제 확인',
    permissionKey: 'payments',
    priority: true,
  },
  {
    description: '수업 일정, 강사 배정, 출석 화면으로 이동합니다.',
    href: '/tablet/schedule',
    icon: Calendar,
    label: '스케줄 관리',
    permissionKey: 'schedules',
  },
  {
    description: '오늘 상담과 연결 학생 액션을 확인합니다.',
    href: '/tablet/consultations',
    icon: MessageSquare,
    label: '상담예약 운영',
    permissionKey: 'consultations',
  },
  {
    description: '학생별 또는 단체 문자를 발송합니다.',
    href: '/tablet/sms',
    icon: Send,
    label: '문자 발송',
    permissionKey: 'sms',
  },
  {
    description: '계정, 알림, 운영 설정 위치를 확인합니다.',
    href: '/tablet/settings',
    icon: Settings,
    label: '운영 설정',
  },
];
