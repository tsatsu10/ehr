import { describe, expect, it } from 'vitest';
import { GUIDED_ACL_TASKS } from './guidedAclTasks';
import { initialPeopleRoute, PEOPLE_VIEW_META } from './peopleViewRouting';

describe('guidedAclTasks', () => {
  it('maps each guided task to a unique view and destination sub-tab', () => {
    const views = GUIDED_ACL_TASKS.map((t) => t.view);
    expect(new Set(views).size).toBe(views.length);

    expect(GUIDED_ACL_TASKS.find((t) => t.view === 'advanced-users')?.sub).toBe('staff');
    expect(GUIDED_ACL_TASKS.find((t) => t.view === 'acl-help')?.sub).toBe('help');
    expect(GUIDED_ACL_TASKS.find((t) => t.view === 'membership')?.sub).toBe('access');
  });

  it('keeps PEOPLE_VIEW_META in sync with guided tasks', () => {
    for (const task of GUIDED_ACL_TASKS) {
      expect(PEOPLE_VIEW_META[task.view].sub).toBe(task.sub);
    }
  });
});

describe('initialPeopleRoute', () => {
  it('prefers view sub-tab over stale sub query param', () => {
    window.history.replaceState({}, '', '/admin.php?tab=people&sub=access&view=advanced-users');
    const route = initialPeopleRoute();
    expect(route.view).toBe('advanced-users');
    expect(route.sub).toBe('staff');
  });
});
