import { useState } from 'react';
import { Button } from '@components/ui/button';
import type { GuidedAclTone } from '../../guidedAclTasks';
import type { PeopleSubTabId } from '../../peopleTypes';
import { ACL_ACO_CATEGORIES, ACL_HELP_INTRO, ACL_HELP_SECTIONS } from './aclHelpContent';
import { PeopleViewShell } from './PeopleViewShell';

interface AclHelpPanelProps {
  originSub: PeopleSubTabId;
  tone?: GuidedAclTone;
  onBack: () => void;
}

export function AclHelpPanel({ originSub, tone = 'help', onBack }: AclHelpPanelProps) {
  const [showAcos, setShowAcos] = useState(false);

  return (
    <PeopleViewShell
      title="Access control list help"
      description="Concepts and workflows for membership, groups, and permissions."
      originSub={originSub}
      tone={tone}
      onBack={onBack}
    >
      <article className="space-y-3 text-sm text-[var(--oe-nc-text-muted)]">
        <h3 className="text-base font-semibold text-[var(--oe-nc-text)]">Access control lists</h3>
        {ACL_HELP_INTRO.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </article>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAcos((v) => !v)}>
          {showAcos ? 'Hide' : 'Show'} ACO categories
        </Button>
        {showAcos && (
          <ul className="mt-3 space-y-3 text-sm">
            {ACL_ACO_CATEGORIES.map((category) => (
              <li key={category.title}>
                <strong>{category.title}</strong>
                <ul className="mt-1 list-disc pl-5 text-[var(--oe-nc-text-muted)]">
                  {category.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ACL_HELP_SECTIONS.map((section) => (
        <article key={section.id} id={`acl-help-${section.id}`} className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--oe-nc-text)]">{section.title}</h3>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm text-[var(--oe-nc-text-muted)]">{paragraph}</p>
          ))}
        </article>
      ))}
    </PeopleViewShell>
  );
}
