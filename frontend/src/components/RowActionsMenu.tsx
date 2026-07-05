import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RowActionItem {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface RowActionsMenuProps {
  /** Accessible name for the trigger (e.g. "Actions for Jane Doe"). */
  label: string;
  items: RowActionItem[];
  align?: 'left' | 'right';
}

export function RowActionsMenu({ label, items, align = 'right' }: RowActionsMenuProps) {
  if (!items.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-11 w-11 shrink-0', align === 'right' && 'ml-auto')}
          aria-label={label}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align === 'right' ? 'end' : 'start'}>
        {items.map((item) => {
          if (item.href) {
            return (
              <DropdownMenuLinkItem
                key={item.id}
                href={item.href}
                onClick={item.onClick}
              >
                {item.label}
              </DropdownMenuLinkItem>
            );
          }

          return (
            <DropdownMenuItem
              key={item.id}
              destructive={item.destructive}
              disabled={item.disabled}
              onSelect={() => item.onClick?.()}
            >
              {item.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
