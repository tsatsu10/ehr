import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SystemHealthBoard } from './SystemHealthBoard';
import type { SystemHealthPayload } from './adminTypes';

const health: SystemHealthPayload = {
  overall_status: 'ok',
  checked_at: '2026-06-30T12:00:00Z',
  chips: [
    {
      key: 'backup',
      label: 'Backup',
      status: 'warning',
      summary: 'Backup in progress',
      detail: 'Started 1h ago',
      action_label: 'Run now',
      action_available: true,
      overall_impact: 'warn',
    },
    {
      key: 'database',
      label: 'Database',
      status: 'ok',
      summary: 'Connected',
      detail: 'Ping OK',
      action_label: null,
      action_available: false,
      overall_impact: 'none',
    },
  ],
  meta: {
    openemr_version: '8.0.0',
    module_version: 'test',
    errors_24h: 0,
    backup_retention_days: 30,
  },
  can_run_backup: true,
  backup_blocked_reason: null,
  backup_running: true,
  backup_run_id: 42,
  backup_url: '/openemr/interface/main/backup.php',
  logview_url: '/openemr/interface/logview/logview.php',
  backup_php_url: '/openemr/interface/main/backup.php',
  xampp_backup_hint: 'Schedule mysqldump.',
};

describe('SystemHealthBoard', () => {
  it('renders chips and mark-complete when backup is running', () => {
    const onCompleteBackup = vi.fn();

    render(
      <SystemHealthBoard
        ajaxUrl="/ajax.php"
        csrfToken="tok"
        health={health}
        reconciliationRunning={false}
        backupRunning={false}
        backupCompleting={false}
        onRunReconciliation={vi.fn()}
        onRunBackup={vi.fn()}
        onCompleteBackup={onCompleteBackup}
        onRefresh={vi.fn()}
        refreshing={false}
      />
    );

    expect(screen.getByText(/All critical checks passed/i)).toBeInTheDocument();
    expect(screen.getByText('Backup')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Mark backup complete/i }));
    expect(onCompleteBackup).toHaveBeenCalledTimes(1);
  });

  it('nags to save the recovery key when it was never exported', () => {
    render(
      <SystemHealthBoard
        ajaxUrl="/ajax.php"
        csrfToken="tok"
        health={{
          ...health,
          backup_native_enabled: true,
          recovery_key: {
            present: true,
            key_files: ['sevena', 'sevenb'],
            methods_dir: '/sites/default/documents/logs_and_misc/methods',
            exported_at: null,
            export_warning: true,
          },
        }}
        reconciliationRunning={false}
        backupRunning={false}
        backupCompleting={false}
        onRunReconciliation={vi.fn()}
        onRunBackup={vi.fn()}
        onCompleteBackup={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
      />
    );

    expect(screen.getByText(/Save your recovery key off this machine/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save recovery key/i })).toBeInTheDocument();
  });

  it('confirms when the recovery key has been exported', () => {
    render(
      <SystemHealthBoard
        ajaxUrl="/ajax.php"
        csrfToken="tok"
        health={{
          ...health,
          backup_native_enabled: true,
          recovery_key: {
            present: true,
            key_files: ['sevena', 'sevenb'],
            methods_dir: '/sites/default/documents/logs_and_misc/methods',
            exported_at: '2026-07-11 09:00:00',
            export_warning: false,
          },
        }}
        reconciliationRunning={false}
        backupRunning={false}
        backupCompleting={false}
        onRunReconciliation={vi.fn()}
        onRunBackup={vi.fn()}
        onCompleteBackup={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
      />
    );

    expect(screen.getByText(/Recovery key last saved 2026-07-11 09:00:00/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save recovery key again/i })).toBeInTheDocument();
  });
});
