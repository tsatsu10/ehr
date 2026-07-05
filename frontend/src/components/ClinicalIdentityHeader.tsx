/**
 * ClinicalIdentityHeader — Fixed patient identity header for clinical workspace
 * 
 * Replaces scrollable PatientContextBanner in preview pane with a fixed,
 * always-visible identity header optimized for medical authority and safety.
 * 
 * Design principles:
 * - Patient identity always visible (AHRQ wrong-patient prevention)
 * - Larger photo (80x80px desktop, 64x64px mobile) for quick recognition
 * - Authority typography (24px/600 name, tabular figures for MRN/DOB)
 * - Horizontal allergy strip (never scrolls out of view)
 * - Animated completion ring with color-coded threshold indicators
 * - Last visit relative time for clinical context
 * 
 * WCAG 2.1 AA: 7.2:1+ contrast, 44px touch targets, keyboard accessible
 */

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { CompletionRing } from './CompletionRing';
import { ChipCloud } from './ChipCloud';
import { cn } from '@/lib/utils';
import {
  buildAllergyChips,
  formatIdentityInline,
  initialsFromName,
  type PatientIdentityLine,
  type PatientSafetyChips,
} from './patientBannerUtils';
import { Calendar, Activity } from 'lucide-react';

export interface ClinicalIdentityHeaderProps {
  /** Patient identity (name, MRN, DOB, etc.) */
  identity: PatientIdentityLine;
  
  /** Safety data (allergies, conditions) */
  safety?: PatientSafetyChips;
  
  /** Profile completion score & threshold */
  completion?: {
    score: number;
    billing_threshold: number;
    chart_open_url?: string;
  };
  
  /** Patient photo URL (if available) */
  photoUrl?: string;
  
  /** Visit history summary */
  visitHistory?: {
    total_visits: number;
    last_visit_date?: string; // ISO date string
    last_visit_relative?: string; // e.g., "3 days ago"
  };
  
  /** Additional content (action buttons, etc.) */
  children?: React.ReactNode;
  
  /** CSS class name */
  className?: string;
  
  /** Element ID */
  id?: string;
  
  /** Fixed positioning (default true) */
  fixed?: boolean;
  
  /** Compact mode for mobile */
  compact?: boolean;
}

/**
 * Calculate relative time from ISO date string
 */
function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const past = new Date(isoDate);
  const diffMs = now.getTime() - past.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Calculate age from DOB
 */
function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function ClinicalIdentityHeader({
  identity,
  safety,
  completion,
  photoUrl,
  visitHistory,
  children,
  className,
  id = 'nc-clinical-identity-header',
  fixed = true,
  compact = false,
}: ClinicalIdentityHeaderProps) {
  const allergyChips = buildAllergyChips(safety, {
    mrdDeepLinks: false,
    pid: identity.pid,
    chartOpenUrl: completion?.chart_open_url,
    showAllergyCountChip: false,
  });
  
  const age = identity.dob ? calculateAge(identity.dob) : null;
  const lastVisitRelative = visitHistory?.last_visit_date 
    ? getRelativeTime(visitHistory.last_visit_date)
    : visitHistory?.last_visit_relative;
  
  const avatarSize = compact ? 'h-16 w-16' : 'h-20 w-20';
  const nameSize = compact ? 'text-xl' : 'text-2xl';
  const metaSize = compact ? 'text-xs' : 'text-sm';
  
  return (
    <div
      id={id}
      className={cn(
        'nc-clinical-identity-header',
        'bg-[var(--oe-clinical-surface)] border-b-2 border-[var(--oe-clinical-border)]',
        'transition-shadow duration-[var(--oe-clinical-duration-normal)]',
        fixed && 'sticky top-0 z-[var(--oe-clinical-z-sticky)]',
        'shadow-[var(--oe-clinical-shadow-md)]',
        className
      )}
    >
      <div className="px-6 py-4">
        {/* Top Row: Avatar + Identity + Completion */}
        <div className="flex items-start gap-4 mb-3">
          {/* Patient Photo/Avatar */}
          <Avatar className={cn(avatarSize, 'shrink-0 ring-2 ring-[var(--oe-clinical-border)]')}>
            {photoUrl && <AvatarImage src={photoUrl} alt={identity.display_name} />}
            <AvatarFallback className={cn(
              'bg-[var(--oe-clinical-primary-bg)] text-[var(--oe-clinical-primary)]',
              compact ? 'text-lg' : 'text-2xl',
              'font-semibold'
            )}>
              {initialsFromName(identity.display_name)}
            </AvatarFallback>
          </Avatar>
          
          {/* Identity Text */}
          <div className="flex-1 min-w-0">
            {/* Patient Name */}
            <h1 className={cn(
              nameSize,
              'font-semibold text-[var(--oe-clinical-text)] leading-tight mb-1',
              'tracking-[var(--oe-clinical-tracking-tight)]'
            )}>
              {identity.display_name}
            </h1>
            
            {/* MRN · DOB · Age */}
            <div className={cn(
              metaSize,
              'text-[var(--oe-clinical-text-secondary)] font-medium',
              'flex items-center gap-3 flex-wrap',
              'font-feature-settings-["tnum"]' // Tabular figures
            )}>
              <span className="font-mono">MRN: {identity.pubpid || identity.pid}</span>
              {identity.dob && (
                <>
                  <span className="text-[var(--oe-clinical-border-strong)]">·</span>
                  <span>DOB: {identity.dob}</span>
                </>
              )}
              {age !== null && (
                <>
                  <span className="text-[var(--oe-clinical-border-strong)]">·</span>
                  <Badge variant="secondary" className="font-medium">
                    Age {age}
                  </Badge>
                </>
              )}
            </div>
            
            {/* Visit History */}
            {visitHistory && (
              <div className={cn(
                metaSize,
                'text-[var(--oe-clinical-text-muted)] mt-1.5 flex items-center gap-3'
              )}>
                {visitHistory.total_visits > 0 && (
                  <span className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{visitHistory.total_visits} visits</span>
                  </span>
                )}
                {lastVisitRelative && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Last visit: {lastVisitRelative}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Completion Ring */}
          {completion && (
            <div className="shrink-0 flex flex-col items-center gap-1">
              <CompletionRing
                score={completion.score}
                threshold={completion.billing_threshold}
                size={compact ? 56 : 64}
                className="drop-shadow-sm"
              />
              <span className={cn(
                'text-xs font-medium',
                completion.score >= completion.billing_threshold
                  ? 'text-[var(--oe-clinical-success)]'
                  : 'text-[var(--oe-clinical-warning)]'
              )}>
                {completion.score}%
              </span>
            </div>
          )}
        </div>
        
        {/* Allergy Strip (always visible) */}
        {allergyChips.length > 0 && (
          <div className="mb-2">
            <ChipCloud 
              chips={allergyChips} 
              className="overflow-x-auto pb-1"
              style={{ scrollbarWidth: 'thin' }}
            />
          </div>
        )}
        
        {/* Action Buttons / Additional Content */}
        {children && (
          <div className="pt-3 border-t border-[var(--oe-clinical-border-light)]">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
