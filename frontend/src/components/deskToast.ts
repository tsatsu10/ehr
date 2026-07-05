import { toast } from 'sonner';

export type DeskToastVariant = 'success' | 'warning' | 'danger' | 'info';

export function showDeskToast(message: string, variant: DeskToastVariant = 'info'): void {
  switch (variant) {
    case 'success':
      toast.success(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    case 'danger':
      toast.error(message);
      break;
    case 'info':
      toast(message);
      break;
    default: {
      const _exhaustive: never = variant;
      toast(_exhaustive);
    }
  }
}

export function showDeskNotice(
  notice: { message: string; variant: DeskToastVariant } | null | undefined,
): void {
  if (!notice?.message) return;
  showDeskToast(notice.message, notice.variant);
}
