import type { LucideIcon } from 'lucide-react';
import type { Permissions } from '@/lib/types/staff';

export interface TabletHomeUser {
  academy?: { name?: string };
  academy_name?: string;
  name?: string;
  permissions?: Permissions;
  role?: string;
}

export interface TabletHomeAction {
  description: string;
  href: string;
  icon: LucideIcon;
  label: string;
  permissionKey?: keyof Permissions;
  priority?: boolean;
}
