import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  KeyRound,
  ShieldAlert,
  UserCog,
  UserPlus,
} from 'lucide-react';
import type { PeopleSubTabId } from './peopleTypes';
import { PEOPLE_SUB_TABS } from './peopleTypes';
import type { PeopleViewId } from './peopleViewRouting';
import { PEOPLE_VIEW_META } from './peopleViewRouting';

export type GuidedAclTone = 'primary' | 'advanced' | 'help';

export interface GuidedAclTask {
  id: string;
  view: PeopleViewId;
  sub: PeopleSubTabId;
  title: string;
  description: string;
  actionLabel: string;
  tone: GuidedAclTone;
  icon: LucideIcon;
}

export const GUIDED_ACL_TASKS: GuidedAclTask[] = [
  {
    id: 'acl-membership',
    view: 'membership',
    sub: 'access',
    title: 'Assign user to group',
    description: 'Pick a staff member and move GACL groups between member and available lists.',
    actionLabel: 'Open membership editor',
    tone: 'primary',
    icon: UserPlus,
  },
  {
    id: 'acl-groups',
    view: 'group-perms',
    sub: 'access',
    title: 'Edit group permissions',
    description: 'Select a group and grant or revoke individual permissions (ACOs).',
    actionLabel: 'Open permissions editor',
    tone: 'primary',
    icon: KeyRound,
  },
  {
    id: 'users',
    view: 'advanced-users',
    sub: 'staff',
    title: 'Advanced user admin',
    description: 'Edit names, active status, facility, and groups for edge-case accounts.',
    actionLabel: 'Open on Staff tab',
    tone: 'advanced',
    icon: UserCog,
  },
  {
    id: 'acl_admin',
    view: 'gacl',
    sub: 'access',
    title: 'Advanced GACL',
    description: 'Create or remove ACL groups — expert use only; changes apply immediately.',
    actionLabel: 'Open GACL tools',
    tone: 'advanced',
    icon: ShieldAlert,
  },
  {
    id: 'help_acl',
    view: 'acl-help',
    sub: 'help',
    title: 'ACL help',
    description: 'Concepts, membership workflow, and permission categories reference.',
    actionLabel: 'Open on Help tab',
    tone: 'help',
    icon: BookOpen,
  },
];

export function subTabLabel(sub: PeopleSubTabId): string {
  return PEOPLE_SUB_TABS.find((t) => t.id === sub)?.label ?? sub;
}

export function taskForView(view: PeopleViewId): GuidedAclTask | undefined {
  return GUIDED_ACL_TASKS.find((t) => t.view === view);
}

export function resolveSubTabForView(view: PeopleViewId | null, fallback: PeopleSubTabId): PeopleSubTabId {
  if (view && view in PEOPLE_VIEW_META) {
    return PEOPLE_VIEW_META[view].sub;
  }
  return fallback;
}
