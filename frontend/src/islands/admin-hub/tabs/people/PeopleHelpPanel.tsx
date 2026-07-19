import { Button } from '@components/ui/button';
import { PeoplePanel } from '../../peopleUi';

const TOPICS = [
  {
    id: 'add-reception',
    title: 'Add a receptionist (RB-05)',
    body: 'Use Staff → Add staff, choose Reception template, review the plain-language summary, then save. The new user lands on Front Desk after login. Do not assign the stock Administrators group.',
  },
  {
    id: 'wrong-desk',
    title: 'Fix wrong desk access',
    body: 'Open the staff row menu → View access summary. If desks are wrong, use Access & ACL → Assign user to group, or deactivate and recreate with the correct template.',
  },
  {
    id: 'acl-basics',
    title: 'ACL basics',
    body: 'New Clinic uses role templates that map to GACL groups (e.g. New Clinic Reception). Desk toggles in Queue & roles must be ON for lab/pharmacy staff to see those queues.',
  },
  {
    id: 'facility-ids',
    title: 'Facility-specific user IDs',
    body: 'When your clinic uses per-facility provider or billing IDs, set them under Facilities. These feed FACUSR layout fields used on claims and receipts.',
  },
  {
    id: 'advanced',
    title: 'When to use Advanced',
    body: 'Advanced user admin and GACL are for edge cases: Emergency Login, multi-group power users, or vendor support. Incorrect changes can expose stock billing or EDI screens.',
  },
];

interface PeopleHelpPanelProps {
  focusId?: string;
  onOpenAclHelp?: () => void;
}

export function PeopleHelpPanel({ focusId, onOpenAclHelp }: PeopleHelpPanelProps) {
  return (
    <PeoplePanel
      title="People & access help"
      description="Quick guidance for clinic owners — links to day-2 runbooks RB-05 through RB-08."
    >
      <div className="space-y-4">
        {onOpenAclHelp && (
          <div className="rounded-lg border border-[var(--oe-nc-border)] p-4">
            <h3 className="text-sm font-semibold">Full ACL reference</h3>
            <p className="mt-2 text-sm text-[var(--oe-nc-text-muted)]">
              Open the complete access control list help (replaces stock adminacl_help.php).
            </p>
            <Button type="button" size="sm" className="mt-2" onClick={onOpenAclHelp}>
              Open ACL help
            </Button>
          </div>
        )}
        {TOPICS.map((topic) => (
          <article
            key={topic.id}
            id={`people-help-${topic.id}`}
            // ADM-4: a deep-link landing cue, not a done/success state.
            className={
              focusId === topic.id
                ? 'rounded-lg border border-[var(--oe-nc-primary)] bg-[var(--oe-nc-bg-tint,#f8fafc)] p-4'
                : 'rounded-lg border border-[var(--oe-nc-border)] p-4'
            }
          >
            <h3 className="text-sm font-semibold">{topic.title}</h3>
            <p className="mt-2 text-sm text-[var(--oe-nc-text-muted)]">{topic.body}</p>
          </article>
        ))}
      </div>
    </PeoplePanel>
  );
}
