import { useCallback, useState } from 'react';
import { Button } from '@components/ui/button';
import type { AclInventoryRow, RoleGroup, SensitivePermission } from '../adminTypes';
import { AdminSection } from '../adminUi';
import { PeopleLayout } from '../peopleUi';
import type { PeopleSubTabId, StaffRow } from '../peopleTypes';
import { taskForView } from '../guidedAclTasks';
import {
  clearPeopleViewUrl,
  initialPeopleRoute,
  peopleViewUrl,
  PEOPLE_VIEW_META,
  type PeopleViewId,
} from '../peopleViewRouting';
import { AccessAclPanel } from './people/AccessAclPanel';
import { AclGroupPermissionsEditor } from './people/AclGroupPermissionsEditor';
import { AclHelpPanel } from './people/AclHelpPanel';
import { AclMembershipEditor } from './people/AclMembershipEditor';
import { AddStaffWizard } from './people/AddStaffWizard';
import { AdvancedUserAdminPanel } from './people/AdvancedUserAdminPanel';
import { FacilityUserPanel } from './people/FacilityUserPanel';
import { FacilityUserMatrix } from './people/FacilityUserMatrix';
import { GaclAdvancedPanel } from './people/GaclAdvancedPanel';
import { PasswordResetPanel } from './people/PasswordResetPanel';
import { PeopleHelpPanel } from './people/PeopleHelpPanel';
import { StaffAccessSummaryDrawer } from './people/StaffAccessSummaryDrawer';
import { StaffDirectory } from './people/StaffDirectory';

interface PeopleAccessTabProps {
  webroot: string;
  ajaxUrl: string;
  csrfToken: string;
  facilityId: number;
  roleGroups: RoleGroup[];
  sensitivePermissions: SensitivePermission[];
  aclInventory: AclInventoryRow[];
  onGrantSelf: () => void;
  granting: boolean;
  onGoQueueTab: () => void;
}

export function PeopleAccessTab({
  ajaxUrl,
  csrfToken,
  facilityId,
  roleGroups,
  sensitivePermissions,
  aclInventory,
  onGrantSelf,
  granting,
  onGoQueueTab,
}: PeopleAccessTabProps) {
  const initialRoute = initialPeopleRoute();
  const [subTab, setSubTab] = useState<PeopleSubTabId>(initialRoute.sub);
  const [peopleView, setPeopleView] = useState<PeopleViewId | null>(initialRoute.view);
  const [helpFocus, setHelpFocus] = useState<string | undefined>();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [staffRefresh, setStaffRefresh] = useState(0);
  const [summaryUserId, setSummaryUserId] = useState<number | null>(null);
  const [advancedUserId, setAdvancedUserId] = useState<number | undefined>();
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | undefined>();
  const [facilityEdit, setFacilityEdit] = useState<{ userId: number; facilityId: number } | null>(null);
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  const navigateView = useCallback((view: PeopleViewId | null, sub: PeopleSubTabId = subTab) => {
    setPeopleView(view);
    const href = view ? peopleViewUrl(sub, view) : clearPeopleViewUrl(sub);
    window.history.replaceState({}, '', href);
  }, [subTab]);

  const changeSubTab = useCallback((id: PeopleSubTabId) => {
    setSubTab(id);
    setPeopleView(null);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'people');
    url.searchParams.set('sub', id);
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.toString());
  }, []);

  const openView = useCallback((view: PeopleViewId, destinationSub?: PeopleSubTabId) => {
    const targetSub = destinationSub ?? PEOPLE_VIEW_META[view].sub;
    setSubTab(targetSub);
    navigateView(view, targetSub);
  }, [navigateView]);

  const closeView = useCallback(() => {
    const originSub = peopleView ? PEOPLE_VIEW_META[peopleView].sub : subTab;
    navigateView(null, originSub);
    setSubTab(originSub);
    setAdvancedUserId(undefined);
    setResetPasswordUserId(undefined);
  }, [navigateView, peopleView, subTab]);

  const openFacilityEditorFromMatrix = useCallback((userId: number, facId: number) => {
    setFacilityEdit({ userId, facilityId: facId });
    navigateView(null, 'facilities');
    setSubTab('facilities');
  }, [navigateView]);

  const openHelp = useCallback(() => {
    setHelpFocus(undefined);
    changeSubTab('help');
  }, [changeSubTab]);

  const openAdvancedUser = useCallback((row?: StaffRow) => {
    setAdvancedUserId(row?.id);
    openView('advanced-users', 'staff');
  }, [openView]);

  const openResetPassword = useCallback((userId?: number) => {
    setResetPasswordUserId(userId);
    openView('reset-password', 'staff');
  }, [openView]);

  const developerTools = (
    <AdminSection title="Developer tools" variant="muted">
      <Button type="button" variant="ghost" size="sm" onClick={() => setDevToolsOpen((v) => !v)}>
        {devToolsOpen ? 'Hide' : 'Show'} pilot shortcuts
      </Button>
      {devToolsOpen && (
        <div className="mt-2">
          <Button
            type="button"
            variant="warning"
            size="sm"
            id="nc-admin-grant-self-roles"
            disabled={granting}
            onClick={onGrantSelf}
          >
            {granting ? 'Granting…' : 'Grant New Clinic roles to my account'}
          </Button>
          <p className="mb-0 mt-2 text-sm text-[var(--oe-nc-text-muted)]">
            Grants all desk groups for pilot testing. Log out and back in afterward.
          </p>
        </div>
      )}
    </AdminSection>
  );

  const renderView = () => {
    if (!peopleView) {
      return null;
    }
    const task = taskForView(peopleView);
    const originSub = PEOPLE_VIEW_META[peopleView].sub;
    const tone = task?.tone ?? 'primary';

    switch (peopleView) {
      case 'membership':
        return (
          <AclMembershipEditor
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            originSub={originSub}
            tone={tone}
            onBack={closeView}
          />
        );
      case 'group-perms':
        return (
          <AclGroupPermissionsEditor
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            originSub={originSub}
            tone={tone}
            onBack={closeView}
          />
        );
      case 'advanced-users':
        return (
          <AdvancedUserAdminPanel
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            originSub={originSub}
            tone={tone}
            onBack={closeView}
            initialUserId={advancedUserId}
            onResetPassword={(userId) => openResetPassword(userId)}
          />
        );
      case 'reset-password':
        return (
          <PasswordResetPanel
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            originSub={originSub}
            tone={tone}
            onBack={closeView}
            initialUserId={resetPasswordUserId}
          />
        );
      case 'gacl':
        return (
          <GaclAdvancedPanel
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            originSub={originSub}
            tone={tone}
            onBack={closeView}
          />
        );
      case 'acl-help':
        return <AclHelpPanel originSub={originSub} tone={tone} onBack={closeView} />;
      case 'facility-matrix':
        return (
          <FacilityUserMatrix
            ajaxUrl={ajaxUrl}
            csrfToken={csrfToken}
            defaultFacilityId={facilityId}
            originSub={originSub}
            tone={tone}
            onBack={closeView}
            onEditCell={openFacilityEditorFromMatrix}
          />
        );
      default: {
        const _exhaustive: never = peopleView;
        return _exhaustive;
      }
    }
  };

  const viewContent = renderView();

  return (
    <PeopleLayout
      subTab={subTab}
      onSubTabChange={changeSubTab}
      onHelp={subTab !== 'help' && !peopleView ? openHelp : undefined}
      header={subTab === 'staff' && !peopleView ? (
        <Button type="button" size="sm" onClick={() => setWizardOpen(true)}>
          + Add staff
        </Button>
      ) : undefined}
    >
      {viewContent ?? (
        <>
          {subTab === 'staff' && (
            <>
              <StaffDirectory
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                refreshKey={staffRefresh}
                onAccessSummary={(row) => setSummaryUserId(row.id)}
                onAdvancedEdit={openAdvancedUser}
                onResetPassword={(row) => openResetPassword(row.id)}
              />
              <AddStaffWizard
                open={wizardOpen}
                ajaxUrl={ajaxUrl}
                csrfToken={csrfToken}
                facilityId={facilityId}
                onClose={() => setWizardOpen(false)}
                onCreated={() => setStaffRefresh((k) => k + 1)}
              />
            </>
          )}

          {subTab === 'access' && (
            <AccessAclPanel
              roleGroups={roleGroups}
              sensitivePermissions={sensitivePermissions}
              aclInventory={aclInventory}
              onOpenView={openView}
              onGoQueueTab={onGoQueueTab}
              developerTools={developerTools}
            />
          )}

          {subTab === 'facilities' && (
            <FacilityUserPanel
              ajaxUrl={ajaxUrl}
              csrfToken={csrfToken}
              defaultFacilityId={facilityId}
              initialUserId={facilityEdit?.userId}
              initialFacilityId={facilityEdit?.facilityId}
              onOpenMatrix={() => openView('facility-matrix', 'facilities')}
            />
          )}

          {subTab === 'help' && (
            <PeopleHelpPanel
              focusId={helpFocus}
              onOpenAclHelp={() => openView('acl-help', 'help')}
            />
          )}
        </>
      )}

      <StaffAccessSummaryDrawer
        userId={summaryUserId}
        ajaxUrl={ajaxUrl}
        csrfToken={csrfToken}
        onClose={() => setSummaryUserId(null)}
        onOpenMembership={() => openView('membership', 'access')}
      />
    </PeopleLayout>
  );
}

export { adminPeopleTabUrl } from '../peopleLegacyUrls';
