/**
 * ClinicalTimelineEntry — Timeline entry component for clinical action stream
 * 
 * Renders visit, medication, lab result, and appointment entries in a
 * scannable, date-ordered timeline with progressive disclosure.
 * 
 * Design principles:
 * - Date-ordered, scannable layout
 * - Type-specific icons and color coding
 * - Progressive disclosure (collapsed by default, expand on demand)
 * - Status indicators (active/discontinued meds, normal/abnormal labs)
 * - Quick actions per entry type
 * 
 * Entry types:
 * - Visit: date, provider, chief complaint, outcome
 * - Medication: name, dose, status (active/discontinued), start date
 * - Lab: test name, date, result value, normal/abnormal flag
 * - Appointment: date/time, type, status (scheduled/completed/cancelled)
 * 
 * WCAG 2.1 AA: Color + text for status, keyboard expandable, focus visible
 */

import React, { useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import {
  FileText,
  Pill,
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
} from 'lucide-react';

export type TimelineEntryType = 'visit' | 'medication' | 'lab' | 'appointment';

export interface BaseTimelineEntry {
  /** Entry ID */
  id: string;
  
  /** Entry type */
  type: TimelineEntryType;
  
  /** Entry date (ISO string) */
  date: string;
  
  /** Entry title */
  title: string;
  
  /** Entry subtitle/summary */
  subtitle?: string;
  
  /** Expanded content (optional) */
  details?: React.ReactNode;
  
  /** Quick actions */
  actions?: Array<{
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
  
  /** Status badge */
  status?: {
    label: string;
    variant: 'default' | 'success' | 'warning' | 'danger';
  };
}

export interface VisitEntry extends BaseTimelineEntry {
  type: 'visit';
  /** Provider name */
  provider?: string;
  /** Chief complaint */
  chiefComplaint?: string;
  /** Visit outcome */
  outcome?: string;
}

export interface MedicationEntry extends BaseTimelineEntry {
  type: 'medication';
  /** Medication name */
  name: string;
  /** Dosage */
  dose?: string;
  /** Active or discontinued */
  active: boolean;
  /** Start date */
  startDate?: string;
}

export interface LabEntry extends BaseTimelineEntry {
  type: 'lab';
  /** Test name */
  testName: string;
  /** Result value */
  result?: string;
  /** Normal or abnormal */
  abnormal: boolean;
}

export interface AppointmentEntry extends BaseTimelineEntry {
  type: 'appointment';
  /** Appointment type */
  appointmentType?: string;
  /** Status (scheduled, completed, cancelled) */
  appointmentStatus: 'scheduled' | 'completed' | 'cancelled';
}

export type TimelineEntry = VisitEntry | MedicationEntry | LabEntry | AppointmentEntry;

export interface ClinicalTimelineEntryProps {
  /** Entry data */
  entry: TimelineEntry;
  
  /** Initially expanded (default false) */
  defaultExpanded?: boolean;
  
  /** CSS class name */
  className?: string;
  
  /** Compact mode */
  compact?: boolean;
}

/**
 * Entry type config (icon, color, label)
 */
const ENTRY_TYPE_CONFIG: Record<TimelineEntryType, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}> = {
  visit: {
    icon: FileText,
    color: 'text-[var(--oe-clinical-primary)]',
    bgColor: 'bg-[var(--oe-clinical-primary-bg)]',
  },
  medication: {
    icon: Pill,
    color: 'text-[var(--oe-clinical-secondary)]',
    bgColor: 'bg-[var(--oe-clinical-secondary-bg)]',
  },
  lab: {
    icon: Activity,
    color: 'text-[var(--oe-clinical-warning)]',
    bgColor: 'bg-[var(--oe-clinical-warning-bg)]',
  },
  appointment: {
    icon: Calendar,
    color: 'text-[var(--oe-clinical-success)]',
    bgColor: 'bg-[var(--oe-clinical-success-bg)]',
  },
};

/**
 * Format date for display
 */
function formatEntryDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  
  // Format as "DD MMM YYYY"
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ClinicalTimelineEntry({
  entry,
  defaultExpanded = false,
  className,
  compact = false,
}: ClinicalTimelineEntryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasDetails = !!entry.details;
  
  const config = ENTRY_TYPE_CONFIG[entry.type];
  const Icon = config.icon;
  const formattedDate = formatEntryDate(entry.date);
  
  return (
    <div
      className={cn(
        'nc-clinical-timeline-entry',
        'bg-[var(--oe-clinical-surface)] rounded-lg',
        'border border-[var(--oe-clinical-border)]',
        'shadow-[var(--oe-clinical-shadow-sm)]',
        'transition-all duration-[var(--oe-clinical-duration-normal)]',
        'hover:shadow-[var(--oe-clinical-shadow-md)]',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      {/* Entry Header */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'shrink-0 rounded-full p-2',
          config.bgColor
        )}>
          <Icon className={cn('h-5 w-5', config.color)} aria-hidden={true} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title Row */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className="text-sm font-semibold text-[var(--oe-clinical-text)] leading-tight">
              {entry.title}
            </h4>
            {entry.status && (
              <Badge
                variant={entry.status.variant}
                className="shrink-0 text-xs"
              >
                {entry.status.label}
              </Badge>
            )}
          </div>
          
          {/* Subtitle / Date */}
          <div className="flex items-center gap-2 text-xs text-[var(--oe-clinical-text-muted)] mb-2">
            <Clock className="h-3 w-3" aria-hidden={true} />
            <span>{formattedDate}</span>
            {entry.subtitle && (
              <>
                <span className="text-[var(--oe-clinical-border-strong)]">·</span>
                <span className="truncate">{entry.subtitle}</span>
              </>
            )}
          </div>
          
          {/* Type-specific preview */}
          {entry.type === 'visit' && (entry as VisitEntry).provider && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--oe-clinical-text-secondary)] mb-2">
              <User className="h-3 w-3" aria-hidden={true} />
              <span>{(entry as VisitEntry).provider}</span>
            </div>
          )}
          
          {entry.type === 'medication' && (
            <div className="flex items-center gap-2 text-xs mb-2">
              <Badge
                variant={(entry as MedicationEntry).active ? 'default' : 'neutral'}
                className="text-xs"
              >
                {(entry as MedicationEntry).active ? 'Active' : 'Discontinued'}
              </Badge>
              {(entry as MedicationEntry).dose && (
                <span className="text-[var(--oe-clinical-text-muted)]">
                  {(entry as MedicationEntry).dose}
                </span>
              )}
            </div>
          )}
          
          {entry.type === 'lab' && (entry as LabEntry).result && (
            <div className="text-sm font-medium mb-2">
              <span className={cn(
                (entry as LabEntry).abnormal
                  ? 'text-[var(--oe-clinical-danger)]'
                  : 'text-[var(--oe-clinical-success)]'
              )}>
                {(entry as LabEntry).result}
              </span>
              {(entry as LabEntry).abnormal && (
                <Badge variant="danger" className="ml-2 text-xs">
                  Abnormal
                </Badge>
              )}
            </div>
          )}
          
          {/* Quick Actions */}
          {entry.actions && entry.actions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {entry.actions.map((action, index) => {
                const ActionIcon = action.icon;
                return (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={action.onClick}
                  >
                    {ActionIcon && <ActionIcon className="h-3 w-3 mr-1" aria-hidden={true} />}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Expand/Collapse Button */}
        {hasDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={cn(
              'shrink-0 p-1 rounded hover:bg-[var(--oe-clinical-bg-tint)]',
              'transition-colors duration-[var(--oe-clinical-duration-fast)]',
              'nc-clinical-focus-ring'
            )}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-[var(--oe-clinical-text-muted)]" />
            ) : (
              <ChevronRight className="h-4 w-4 text-[var(--oe-clinical-text-muted)]" />
            )}
          </button>
        )}
      </div>
      
      {/* Expanded Details */}
      {hasDetails && expanded && (
        <div className={cn(
          'mt-3 pt-3 border-t border-[var(--oe-clinical-border-light)]',
          'text-sm text-[var(--oe-clinical-text-secondary)]',
          'animate-in slide-in-from-top-2 duration-200'
        )}>
          {entry.details}
        </div>
      )}
    </div>
  );
}

// Export memoized version for performance
export const MemoizedClinicalTimelineEntry = React.memo(ClinicalTimelineEntry);
