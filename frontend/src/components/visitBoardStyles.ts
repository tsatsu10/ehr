import { cn } from '@/lib/utils';

/** Visit Board root wrapper — default + optional kiosk wall profile. */
export function visitBoardRootClass(isKiosk: boolean, className?: string): string {
  return cn('nc-vb w-full', isKiosk && 'nc-vb--kiosk', className);
}

export const visitBoardLanesClass = 'nc-vb-lanes';
export const visitBoardLaneClass = 'nc-vb-lane';
export const visitBoardColumnClass = 'nc-vb-column';
export const visitBoardColumnHeaderClass = 'nc-vb-column-header';
export const visitBoardColumnLabelClass = 'nc-vb-column-label';
export const visitBoardColumnCountClass = 'nc-vb-column-count';
export const visitBoardColumnBodyClass = 'nc-vb-column-body';
export const visitBoardToolbarClass = 'nc-vb-toolbar';
export const visitBoardKioskToolbarClass = 'nc-vb-kiosk-toolbar';
export const visitBoardKioskTitleClass = 'nc-vb-kiosk-toolbar-title';
export const visitBoardSkeletonClass = 'nc-vb-skeleton';
export const visitBoardSkeletonCardClass = 'nc-vb-skeleton nc-vb-skeleton--card';

export function visitBoardSkeletonClassNames(className?: string): string {
  return cn(visitBoardSkeletonClass, className);
}
