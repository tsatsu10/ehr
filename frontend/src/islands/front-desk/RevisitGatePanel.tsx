import type { VisitState } from '@core/types';
import { StatusPill } from '@components/StatusPill';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { DeskAlert } from '@components/DeskAlert';
import { AlertTriangle } from 'lucide-react';

export type RevisitPath = 'complete_now' | 'manager_override' | 'awaiting_documents';

interface RevisitGatePanelProps {
  score: number;
  threshold: number;
  pediatricDobBlock: boolean;
  missingLabels: string[];
  canManagerOverride: boolean;
  selectedPath: RevisitPath | null;
  overrideReason: string;
  onSelectPath: (path: RevisitPath) => void;
  onOverrideReasonChange: (value: string) => void;
}

function RevisitPathOption({
  name,
  value,
  checked,
  label,
  onSelect,
}: {
  name: string;
  value: RevisitPath;
  checked: boolean;
  label: string;
  onSelect: (path: RevisitPath) => void;
}) {
  return (
    <label className="flex items-center gap-2 mb-1 cursor-pointer text-sm">
      <input
        type="radio"
        name={name}
        className="h-4 w-4 accent-[var(--oe-nc-primary)]"
        checked={checked}
        onChange={() => onSelect(value)}
      />
      {label}
    </label>
  );
}

export function RevisitGatePanel({
  score,
  threshold,
  pediatricDobBlock,
  missingLabels,
  canManagerOverride,
  selectedPath,
  overrideReason,
  onSelectPath,
  onOverrideReasonChange,
}: RevisitGatePanelProps) {
  return (
    <DeskAlert
      tone="warn"
      className="mb-3"
      id="nc-revisit-gate"
      role="group"
      aria-labelledby="nc-revisit-gate-title"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <strong id="nc-revisit-gate-title" className="text-sm font-semibold">
            Profile below billing threshold
          </strong>
          <span className="text-sm">
            {' — '}
            {score}% of {threshold}% required.
          </span>
          {pediatricDobBlock && (
            <div className="text-xs mt-1 opacity-90">
              Pediatric patient needs an exact date of birth before billing.
            </div>
          )}
          {missingLabels.length > 0 && (
            <div className="text-xs mt-1 opacity-80">
              Missing: {missingLabels.slice(0, 3).join(', ')}{missingLabels.length > 3 ? '…' : ''}
            </div>
          )}
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wide mb-2">Pick a path</div>
            <RevisitPathOption
              name="nc-revisit-path"
              value="complete_now"
              checked={selectedPath === 'complete_now'}
              label="Complete profile now"
              onSelect={onSelectPath}
            />
            {canManagerOverride && (
              <RevisitPathOption
                name="nc-revisit-path"
                value="manager_override"
                checked={selectedPath === 'manager_override'}
                label="Manager override (reason required)"
                onSelect={onSelectPath}
              />
            )}
            <RevisitPathOption
              name="nc-revisit-path"
              value="awaiting_documents"
              checked={selectedPath === 'awaiting_documents'}
              label="Patient fetches documents"
              onSelect={onSelectPath}
            />
          </div>
          {selectedPath === 'manager_override' && (
            <div className="mt-3 space-y-1">
              <Label htmlFor="nc-revisit-override-reason" className="text-sm">
                Override reason
              </Label>
              <Textarea
                id="nc-revisit-override-reason"
                rows={2}
                value={overrideReason}
                onChange={(e) => onOverrideReasonChange(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </DeskAlert>
  );
}

interface ActiveVisitBannerProps {
  queueNumber: number | string;
  state: VisitState;
  visitBoardUrl?: string;
  canCancelVisit: boolean;
  onCancelVisit: () => void;
  showWrongVisitTypeHint?: boolean;
}

export function ActiveVisitBanner({
  queueNumber,
  state,
  visitBoardUrl,
  canCancelVisit,
  onCancelVisit,
  showWrongVisitTypeHint = false,
}: ActiveVisitBannerProps) {
  return (
    <DeskAlert
      tone="warn"
      className="mb-3"
      id="nc-active-visit-banner"
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="text-sm font-semibold">
            Patient already has visit #{queueNumber} today
          </strong>
          <div className="mt-1">
            <StatusPill state={state} queueNumber={String(queueNumber)} />
          </div>
          <div className="text-xs mt-1 opacity-80">
            Start visit is disabled until this visit is finished or cancelled.
          </div>
          {showWrongVisitTypeHint && canCancelVisit && (
            <div className="text-xs mt-1">
              Wrong visit type? Cancel this visit and start again with the correct type.
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {visitBoardUrl && (
            <Button variant="default" size="sm" asChild>
              <a href={visitBoardUrl} target="_top">
                Open Visit Board
              </a>
            </Button>
          )}
          {canCancelVisit && (
            <Button type="button" variant="outline" size="sm" onClick={onCancelVisit}>
              Cancel visit
            </Button>
          )}
        </div>
      </div>
    </DeskAlert>
  );
}
