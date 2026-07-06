import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  Banknote,
  Coins,
  Printer,
  Scale,
} from 'lucide-react';
import { AdminConfigField } from '../AdminConfigField';
import {
  CLINIC_CURRENCY_FIELDS,
  CLINIC_PRINT_FIELDS,
  CLINIC_RECONCILIATION_FIELDS,
} from '../adminFieldDefs';
import type { CashProfileStatus } from '../adminTypes';
import { formatPrice } from '../adminUtils';
import { AdminSection, AdminStack } from '../adminUi';

interface ClinicTabProps {
  settings: Record<string, unknown>;
  cashProfile: CashProfileStatus;
  cashProfileApplying: boolean;
  reconciliationStatus: string;
  reconciliationRunning: boolean;
  onFieldChange: (key: string, value: unknown) => void;
  onApplyCashProfile: () => void;
  onRunReconciliation: () => void;
}

function formatAppliedAt(value?: string | null): string {
  if (!value) {
    return 'Not applied yet';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export function ClinicTab({
  settings,
  cashProfile,
  cashProfileApplying,
  reconciliationStatus,
  reconciliationRunning,
  onFieldChange,
  onApplyCashProfile,
  onRunReconciliation,
}: ClinicTabProps) {
  return (
    <AdminStack>
      <AdminSection
        title="Cash clinic profile"
        description="Recommended OpenEMR globals for a private cash clinic (Appendix E)"
        icon={<Banknote className="h-4 w-4" aria-hidden />}
        variant={cashProfile.applied ? 'success' : 'accent'}
        action={
          <Button
            type="button"
            size="sm"
            id="nc-admin-apply-cash-profile"
            disabled={cashProfileApplying}
            onClick={onApplyCashProfile}
          >
            {cashProfileApplying ? 'Applying…' : 'Apply cash clinic profile'}
          </Button>
        }
      >
        <p className="mb-2 text-sm text-[var(--oe-nc-text-muted)]" id="nc-admin-cash-profile-status">
          <Badge variant={cashProfile.applied ? 'success' : 'neutral'} className="mr-2">
            {cashProfile.applied ? 'Applied' : 'Not applied'}
          </Badge>
          Last applied: {formatAppliedAt(cashProfile.last_applied_at)}
        </p>
      </AdminSection>

      <AdminSection
        title="Clinic currency"
        description={`Example: ${formatPrice(160, settings)}`}
        icon={<Coins className="h-4 w-4" aria-hidden />}
      >
        {CLINIC_CURRENCY_FIELDS.map((def) => (
          <AdminConfigField
            key={def.key}
            def={def}
            value={settings[def.key]}
            onChange={onFieldChange}
          />
        ))}
      </AdminSection>

      <AdminSection
        title="Queue slip & receipt print"
        icon={<Printer className="h-4 w-4" aria-hidden />}
      >
        {CLINIC_PRINT_FIELDS.map((def) => (
          <AdminConfigField
            key={def.key}
            def={def}
            value={settings[def.key]}
            onChange={onFieldChange}
          />
        ))}
      </AdminSection>

      <AdminSection
        title="Cashier reconciliation"
        icon={<Scale className="h-4 w-4" aria-hidden />}
      >
        {CLINIC_RECONCILIATION_FIELDS.map((def) => (
          <AdminConfigField
            key={def.key}
            def={def}
            value={settings[def.key]}
            onChange={onFieldChange}
          />
        ))}
        <p className="mb-2 text-sm text-[var(--oe-nc-text-muted)]" id="nc-admin-reconciliation-status">
          {reconciliationStatus}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          id="nc-admin-run-reconciliation"
          disabled={reconciliationRunning}
          onClick={onRunReconciliation}
        >
          {reconciliationRunning ? 'Running…' : 'Run reconciliation now'}
        </Button>
      </AdminSection>
    </AdminStack>
  );
}
