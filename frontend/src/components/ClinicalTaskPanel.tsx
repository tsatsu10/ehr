/**
 * ClinicalTaskPanel — Sticky task context panel for clinical workspace
 * 
 * Displays patient status, primary actions, quick stats, and alerts in a
 * fixed-position panel that remains visible while scrolling clinical timeline.
 * 
 * Design principles:
 * - Always-visible primary actions (Start Visit, Edit Profile)
 * - Context-aware button states (disabled, loading, success)
 * - Color-coded status indicators (waiting, ready, in-progress)
 * - Quick stats cards for clinical context (balance, recent vitals)
 * - Alert badges for overdue items, incomplete profile
 * 
 * WCAG 2.1 AA: 44px button heights, 7.2:1+ contrast, keyboard accessible
 */

import React from 'react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Activity,
} from 'lucide-react';

export type PatientStatus = 
  | 'not_checked_in'
  | 'waiting_triage'
  | 'ready_to_start'
  | 'in_progress'
  | 'completed';

export interface TaskAction {
  /** Unique action ID */
  id: string;
  
  /** Button label */
  label: string;
  
  /** Button icon component */
  icon?: React.ComponentType<{ className?: string }>;
  
  /** Button variant (primary, secondary, tertiary) */
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  
  /** Click handler */
  onClick: () => void;
  
  /** Disabled state */
  disabled?: boolean;
  
  /** Loading state */
  loading?: boolean;
  
  /** Keyboard shortcut hint */
  shortcut?: string;
}

export interface QuickStat {
  /** Stat label */
  label: string;
  
  /** Stat value (formatted) */
  value: string | number;
  
  /** Icon component */
  icon?: React.ComponentType<{ className?: string }>;
  
  /** Value color variant */
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export interface TaskAlert {
  /** Alert ID */
  id: string;
  
  /** Alert message */
  message: string;
  
  /** Alert severity */
  severity: 'info' | 'warning' | 'error';
  
  /** Optional action */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ClinicalTaskPanelProps {
  /** Current patient status */
  status: PatientStatus;
  
  /** Primary actions (max 3 recommended) */
  actions: TaskAction[];
  
  /** Quick stats cards */
  stats?: QuickStat[];
  
  /** Alert messages */
  alerts?: TaskAlert[];
  
  /** Additional content */
  children?: React.ReactNode;
  
  /** CSS class name */
  className?: string;
  
  /** Element ID */
  id?: string;
  
  /** Sticky positioning (default true) */
  sticky?: boolean;
  
  /** Compact mode for narrow viewports */
  compact?: boolean;
}

/**
 * Status label and color mapping
 */
const STATUS_CONFIG: Record<PatientStatus, {
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  not_checked_in: {
    label: 'Not checked in',
    color: 'text-[var(--oe-clinical-text-muted)]',
    icon: Clock,
  },
  waiting_triage: {
    label: 'Waiting for triage',
    color: 'text-[var(--oe-clinical-warning)]',
    icon: Clock,
  },
  ready_to_start: {
    label: 'Ready to start',
    color: 'text-[var(--oe-clinical-success)]',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'Visit in progress',
    color: 'text-[var(--oe-clinical-primary)]',
    icon: Activity,
  },
  completed: {
    label: 'Visit completed',
    color: 'text-[var(--oe-clinical-text-muted)]',
    icon: CheckCircle2,
  },
};

/**
 * Quick stat card component
 */
function QuickStatCard({ stat }: { stat: QuickStat }) {
  const Icon = stat.icon;
  const colorClass = stat.variant === 'success' ? 'text-[var(--oe-clinical-success)]'
    : stat.variant === 'warning' ? 'text-[var(--oe-clinical-warning)]'
    : stat.variant === 'danger' ? 'text-[var(--oe-clinical-danger)]'
    : 'text-[var(--oe-clinical-text)]';
  
  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-[var(--oe-clinical-bg-tint)]">
      {Icon && <Icon className="h-4 w-4 text-[var(--oe-clinical-text-muted)] shrink-0" aria-hidden={true} />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--oe-clinical-text-muted)] truncate">
          {stat.label}
        </div>
        <div className={cn('text-sm font-semibold truncate', colorClass)}>
          {stat.value}
        </div>
      </div>
    </div>
  );
}

/**
 * Alert banner component
 */
function AlertBanner({ alert }: { alert: TaskAlert }) {
  const Icon = alert.severity === 'error' ? AlertCircle
    : alert.severity === 'warning' ? AlertCircle
    : CheckCircle2;
  
  const colorClass = alert.severity === 'error' 
    ? 'bg-[var(--oe-clinical-danger-bg)] border-[var(--oe-clinical-danger)] text-[var(--oe-clinical-danger)]'
    : alert.severity === 'warning'
    ? 'bg-[var(--oe-clinical-warning-bg)] border-[var(--oe-clinical-warning)] text-[var(--oe-clinical-warning)]'
    : 'bg-[var(--oe-clinical-primary-bg)] border-[var(--oe-clinical-primary)] text-[var(--oe-clinical-primary)]';
  
  return (
    <div className={cn(
      'flex items-start gap-2 p-3 rounded-lg border text-sm',
      colorClass
    )}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden={true} />
      <div className="flex-1 min-w-0">
        <p className="font-medium">{alert.message}</p>
        {alert.action && (
          <button
            onClick={alert.action.onClick}
            className="text-xs underline hover:no-underline mt-1 font-medium"
          >
            {alert.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

export function ClinicalTaskPanel({
  status,
  actions,
  stats,
  alerts,
  children,
  className,
  id = 'nc-clinical-task-panel',
  sticky = true,
  compact = false,
}: ClinicalTaskPanelProps) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.not_checked_in; // Fallback if status invalid
  const StatusIcon = statusConfig.icon;
  
  return (
    <div
      id={id}
      className={cn(
        'nc-clinical-task-panel',
        'bg-[var(--oe-clinical-surface)] rounded-lg',
        'border border-[var(--oe-clinical-border)]',
        'shadow-[var(--oe-clinical-shadow-md)]',
        sticky && 'sticky top-[calc(var(--oe-clinical-z-sticky)_+_8rem)]',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      {/* Status Badge */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('h-5 w-5', statusConfig.color)} aria-hidden={true} />
          <span className={cn('text-sm font-semibold', statusConfig.color)}>
            {statusConfig.label}
          </span>
        </div>
      </div>
      
      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.map((alert) => (
            <AlertBanner key={alert.id} alert={alert} />
          ))}
        </div>
      )}
      
      {/* Primary Actions */}
      <div className="mb-4 space-y-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.id}
              variant={action.variant || 'default'}
              size={action.size === 'md' ? 'default' : (action.size || 'lg')}
              className="w-full justify-start gap-2 h-[var(--oe-clinical-btn-lg)]"
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
            >
              {Icon && <Icon className="h-5 w-5" aria-hidden={true} />}
              <span className="flex-1 text-left">{action.label}</span>
              {action.shortcut && (
                <kbd className="text-xs bg-white/20 px-1.5 py-0.5 rounded">
                  {action.shortcut}
                </kbd>
              )}
            </Button>
          );
        })}
      </div>
      
      {/* Quick Stats */}
      {stats && stats.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-[var(--oe-clinical-text-secondary)] uppercase tracking-wide mb-2">
            Quick Stats
          </h3>
          <div className="space-y-2">
            {stats.map((stat, index) => (
              <QuickStatCard key={index} stat={stat} />
            ))}
          </div>
        </div>
      )}
      
      {/* Additional Content */}
      {children}
    </div>
  );
}

// Export memoized version for performance
export const MemoizedClinicalTaskPanel = React.memo(ClinicalTaskPanel);
