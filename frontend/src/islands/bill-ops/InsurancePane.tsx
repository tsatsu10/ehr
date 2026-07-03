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
    <div className="oe-nc-billops-pane">
      <p className="text-muted small mb-3">
        Legacy US billing tools — not used for daily cash workflow.
      </p>
      <div className="row">
        {VAULT_LINKS.map((link) => (
          <div className="col-md-4 col-sm-6 mb-3" key={link.path}>
            <a
              href={`${webroot}${link.path}`}
              className="card card-body h-100 text-decoration-none"
              target="_blank"
              rel="noopener noreferrer"
            >
              <strong>{link.label}</strong>
              <span className="small text-muted d-block mt-1">Open in new tab</span>
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
