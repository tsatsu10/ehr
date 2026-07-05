import type { BillOpsHubProps } from './billOpsTypes';

const VAULT_LINKS = [
  { label: 'Billing Manager', path: '/interface/billing/billing_report.php' },
  { label: 'ERA upload', path: '/interface/billing/era_payments.php' },
  { label: 'EOB posting', path: '/interface/billing/sl_eob_search.php' },
  { label: 'Eligibility 270', path: '/interface/billing/edi_270.php' },
  { label: 'Eligibility 271', path: '/interface/billing/edi_271.php' },
];

export function InsurancePane({ webroot }: { webroot: string }) {
  return (
    <div className="nc-billops-pane">
      <p className="text-[var(--oe-nc-text-muted)] text-sm mb-3">
        Legacy US billing tools — not used for daily cash workflow.
      </p>
      <div className="grid grid-cols-12 gap-3">
        {VAULT_LINKS.map((link) => (
          <div className="col-span-12 sm:col-span-6 md:col-span-4 mb-3" key={link.path}>
            <a
              href={`${webroot}${link.path}`}
              className="block h-full rounded-lg border border-[var(--oe-nc-border)] bg-white p-4 no-underline hover:bg-[var(--oe-nc-bg-tint)]"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>{link.label}</strong>
              <span className="text-sm text-[var(--oe-nc-text-muted)] block mt-1">Open in new tab</span>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsurancePaneWrapper(props: BillOpsHubProps) {
  return <InsurancePane webroot={props.webroot} />;
}
