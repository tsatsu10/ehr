import { useEffect } from 'react';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import {
  Banknote,
  Building2,
  Coins,
  Globe2,
  Printer,
  Scale,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { AdminConfigField } from '../AdminConfigField';
import {
  CLINIC_CURRENCY_FIELDS,
  CLINIC_PRINT_FIELDS,
  CLINIC_RECONCILIATION_FIELDS,
  CLINIC_REGIONAL_SECTION,
} from '../adminFieldDefs';
import type { CashProfileStatus, FacilityRow, SettingOverrideInfo } from '../adminTypes';
import { formatPrice } from '../adminUtils';
import { AdminEmptyState, AdminSection, AdminStack } from '../adminUi';
import { scrollToAndFlashField } from '../scrollToField';

interface ClinicTabProps {
  settings: Record<string, unknown>;
  /** ADM-5: facility-scope override transparency — undefined under global scope. */
  settingsOverrides?: Record<string, SettingOverrideInfo>;
  resettingOverrideKey?: string | null;
  onResetOverride?: (key: string, label: string) => void;
  cashProfile: CashProfileStatus;
  cashProfileApplying: boolean;
  reconciliationStatus: string;
  reconciliationRunning: boolean;
  facilities: FacilityRow[];
  currentFacilityId: number;
  onFieldChange: (key: string, value: unknown) => void;
  onApplyCashProfile: () => void;
  onRunReconciliation: () => void;
  onEditFacility: (row: FacilityRow) => void;
  /** ADM-1: a field key to scroll to and flash — set by the global sidebar search. */
  highlightKey?: string | null;
  onHighlightHandled?: () => void;
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

function ClinicDetail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="mb-0 text-xs font-medium uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
        {label}
      </dt>
      <dd className="mb-0 mt-0.5 text-sm text-[var(--oe-nc-text)]">{value}</dd>
    </div>
  );
}

export function ClinicTab({
  settings,
  settingsOverrides,
  resettingOverrideKey,
  onResetOverride,
  cashProfile,
  cashProfileApplying,
  reconciliationStatus,
  reconciliationRunning,
  facilities,
  currentFacilityId,
  onFieldChange,
  onApplyCashProfile,
  onRunReconciliation,
  onEditFacility,
  highlightKey,
  onHighlightHandled,
}: ClinicTabProps) {
  useEffect(() => {
    if (!highlightKey) {
      return;
    }
    scrollToAndFlashField(highlightKey);
    onHighlightHandled?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the target key itself changes
  }, [highlightKey]);

  // Single-clinic product: edit the one clinic you're in, not a list of sites.
  const clinic = facilities.find((f) => f.id === currentFacilityId) ?? facilities[0] ?? null;
  const address = clinic
    ? [clinic.street, clinic.city, clinic.state, clinic.postal_code, clinic.country_code]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <AdminStack>
      <AdminSection
        title="Clinic details"
        description="Your clinic's name, contact info, and address. NPI/tax and other US-billing fields stay on the stock Facilities screen."
        icon={<Building2 className="h-4 w-4" aria-hidden />}
        action={
          clinic ? (
            <Button
              type="button"
              size="sm"
              id="nc-admin-edit-facility"
              onClick={() => onEditFacility(clinic)}
            >
              Edit clinic details
            </Button>
          ) : undefined
        }
      >
        {clinic ? (
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <dt className="mb-0 text-xs font-medium uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                Name
              </dt>
              <dd className="mb-0 mt-0.5 flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--oe-nc-text)]">
                {clinic.name || '—'}
                {clinic.inactive && <Badge variant="neutral">Inactive</Badge>}
              </dd>
            </div>
            <ClinicDetail label="Phone" value={clinic.phone || '—'} />
            <ClinicDetail label="Email" value={clinic.email || '—'} />
            <div className="sm:col-span-2">
              <dt className="mb-0 text-xs font-medium uppercase tracking-wide text-[var(--oe-nc-text-muted)]">
                Address
              </dt>
              <dd className="mb-0 mt-0.5 text-sm text-[var(--oe-nc-text)]">{address || '—'}</dd>
            </div>
          </dl>
        ) : (
          <AdminEmptyState
            title="Clinic details unavailable"
            description="Reload the page to load your clinic's record."
          />
        )}
      </AdminSection>

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
            overrideInfo={settingsOverrides?.[def.key]}
            onResetOverride={onResetOverride}
            resettingOverride={resettingOverrideKey === def.key}
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
            overrideInfo={settingsOverrides?.[def.key]}
            onResetOverride={onResetOverride}
            resettingOverride={resettingOverrideKey === def.key}
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
            overrideInfo={settingsOverrides?.[def.key]}
            onResetOverride={onResetOverride}
            resettingOverride={resettingOverrideKey === def.key}
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

      <AdminSection
        title={CLINIC_REGIONAL_SECTION.title}
        description={CLINIC_REGIONAL_SECTION.description}
        icon={<Globe2 className="h-4 w-4" aria-hidden />}
      >
        {CLINIC_REGIONAL_SECTION.fields.map((def) => (
          <AdminConfigField
            key={def.key}
            def={def}
            value={settings[def.key]}
            onChange={onFieldChange}
            overrideInfo={settingsOverrides?.[def.key]}
            onResetOverride={onResetOverride}
            resettingOverride={resettingOverrideKey === def.key}
          />
        ))}
      </AdminSection>
    </AdminStack>
  );
}
