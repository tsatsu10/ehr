import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormsCatalog } from './FormsCatalog';
import type { FormsCatalogPayload } from './adminTypes';

const catalog: FormsCatalogPayload = {
  items: [
    {
      id: 1,
      name: 'Fee Sheet',
      directory: 'fee_sheet',
      category: 'Billing',
      priority: 0,
      nickname: '',
      enabled: false,
      sql_run: true,
      bundle_required: false,
      disable_blocked: false,
      disable_block_reason: null,
      enable_warning: 'Fee sheet forms are hidden for clinic roles.',
    },
  ],
  can_edit: true,
  forms_admin_url: '/forms',
  layout_editor_url: '/layout',
  list_editor_url: '/list',
  bundle_formdirs: [],
};

describe('FormsCatalog', () => {
  it('renders forms and calls toggle handler', () => {
    const onToggle = vi.fn();
    render(<FormsCatalog catalog={catalog} togglingId={null} onToggle={onToggle} />);

    expect(screen.getByText('Fee Sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    expect(onToggle).toHaveBeenCalledWith(catalog.items[0], true);
  });
});
