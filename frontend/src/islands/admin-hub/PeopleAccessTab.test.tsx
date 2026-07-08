import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { PeopleAccessTab } from './tabs/PeopleAccessTab';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn().mockResolvedValue({ rows: [], total: 0, page: 1, page_size: 25 }),
}));

describe('PeopleAccessTab', () => {
  it('renders staff sub-tab directory by default', async () => {
    window.history.replaceState({}, '', '/admin.php?tab=people&sub=staff');
    render(
      <PeopleAccessTab
        webroot="/openemr"
        ajaxUrl="/openemr/ajax.php"
        csrfToken="token"
        facilityId={3}
        roleGroups={[]}
        sensitivePermissions={[]}
        aclInventory={[]}
        onGrantSelf={() => {}}
        granting={false}
        onGoQueueTab={() => {}}
      />,
    );
    expect(await screen.findByText('Staff directory')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add staff' })).toBeInTheDocument();
  });

  it('renders access panel when sub=access', async () => {
    window.history.replaceState({}, '', '/admin.php?tab=people&sub=access');
    render(
      <PeopleAccessTab
        webroot="/openemr"
        ajaxUrl="/openemr/ajax.php"
        csrfToken="token"
        facilityId={3}
        roleGroups={[]}
        sensitivePermissions={[]}
        aclInventory={[]}
        onGrantSelf={() => {}}
        granting={false}
        onGoQueueTab={() => {}}
      />,
    );
    expect(await screen.findByText('Guided ACL tasks')).toBeInTheDocument();
  });
});
