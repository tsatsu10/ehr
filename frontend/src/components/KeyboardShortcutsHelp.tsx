/**
 * Keyboard shortcuts help modal — shows available shortcuts when ? is pressed
 */
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, dialogContentSizeClass } from '@components/ui/dialog';
import { Keyboard, Command } from 'lucide-react';

interface KeyboardShortcut {
  keys: string[];
  description: string;
  context?: string;
}

const SHORTCUTS: KeyboardShortcut[] = [
  {
    keys: ['/'],
    description: 'Focus search input',
    context: 'Front Desk',
  },
  {
    keys: ['Ctrl', 'Z'],
    description: 'Undo - Go back to previous patient',
    context: 'Front Desk',
  },
  {
    keys: ['Ctrl', 'Shift', 'Z'],
    description: 'Redo - Go forward to next patient',
    context: 'Front Desk',
  },
  {
    keys: ['Esc'],
    description: 'Close dialogs / Clear selection',
    context: 'Global',
  },
  {
    keys: ['Enter'],
    description: 'Select highlighted patient',
    context: 'Search Results',
  },
  {
    keys: ['?'],
    description: 'Show keyboard shortcuts help',
    context: 'Global',
  },
];

interface KeyboardShortcutsHelpProps {
  /** Additional shortcuts specific to the current context */
  contextShortcuts?: KeyboardShortcut[];
}

export function KeyboardShortcutsHelp({ contextShortcuts = [] }: KeyboardShortcutsHelpProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Show help on ? key (Shift + /)
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        // Don't trigger if user is typing in an input
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
        
        event.preventDefault();
        setOpen(true);
      }

      // Close on Escape
      if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const allShortcuts = [...SHORTCUTS, ...contextShortcuts];
  const groupedShortcuts = allShortcuts.reduce((acc, shortcut) => {
    const ctx = shortcut.context || 'Other';
    if (!acc[ctx]) acc[ctx] = [];
    acc[ctx].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className={dialogContentSizeClass.lg}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {Object.entries(groupedShortcuts).map(([context, shortcuts]) => (
            <div key={context}>
              <h3 className="text-sm font-semibold text-[var(--oe-nc-text-muted)] mb-3">
                {context}
              </h3>
              <div className="space-y-2">
                {shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[var(--oe-nc-bg-tint)] transition-colors"
                  >
                    <span className="text-sm text-[var(--oe-nc-text)]">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <kbd
                          key={keyIdx}
                          className="nc-kbd inline-flex items-center justify-center min-w-[2rem] h-7 px-2 text-xs font-mono font-semibold"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-4 border-t border-[var(--oe-nc-border)]">
            <p className="text-xs text-[var(--oe-nc-text-muted)] flex items-center gap-2">
              <Command className="h-3.5 w-3.5" />
              Press <kbd className="nc-kbd">?</kbd> anytime to see this help
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
