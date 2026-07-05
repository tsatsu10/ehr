import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { AdminConfigField } from '../AdminConfigField';
import {
  CLINIC_CURRENCY_FIELDS,
  CLINIC_PRINT_FIELDS,
  CLINIC_RECONCILIATION_FIELDS,
} from '../adminFieldDefs';
import type { CashProfileStatus } from '../adminTypes';
import { formatPrice } from '../adminUtils';

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
    <>
      <Card className="mb-3">
        <CardContent>
          <div className="flex flex-wrap items-start justify-between">
            <div className="mb-2 md:mb-0">
              <h5 className="text-base font-semibold mb-1">Cash clinic profile</h5>
              <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2">
                Applies recommended OpenEMR globals for a private cash clinic (Appendix E):
                disables insurance eligibility noise, enables E-Sign defaults, syncs currency
                symbol, and turns on pinned reception preview plus print Rx.
              </p>
              <p className="text-sm mb-0" id="nc-admin-cash-profile-status">
                <Badge variant={cashProfile.applied ? 'success' : 'neutral'} className="mr-2">
                  {cashProfile.applied ? 'Applied' : 'Not applied'}
                </Badge>
                Last applied: {formatAppliedAt(cashProfile.last_applied_at)}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              id="nc-admin-apply-cash-profile"
              disabled={cashProfileApplying}
              onClick={onApplyCashProfile}
            >
              {cashProfileApplying ? 'Applying…' : 'Apply cash clinic profile'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent>
          <h5 className="text-base font-semibold">Clinic currency</h5>
          <p className="text-[var(--oe-nc-text-muted)] text-sm">
            Example: {formatPrice(160, settings)}
          </p>
          {CLINIC_CURRENCY_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="mb-3">
        <CardContent>
          <h5 className="text-base font-semibold">Queue slip & receipt print</h5>
          {CLINIC_PRINT_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h5 className="text-base font-semibold">Cashier reconciliation</h5>
          {CLINIC_RECONCILIATION_FIELDS.map((def) => (
            <AdminConfigField
              key={def.key}
              def={def}
              value={settings[def.key]}
              onChange={onFieldChange}
            />
          ))}
          <p className="text-[var(--oe-nc-text-muted)] text-sm mb-2" id="nc-admin-reconciliation-status">
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
        </CardContent>
      </Card>
    </>
  );
}
