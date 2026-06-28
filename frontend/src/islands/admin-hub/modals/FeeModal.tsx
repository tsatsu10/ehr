import { useEffect, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import type {
  BillingCode,
  BillingCodeType,
  FeeCategoryOption,
  FeeScheduleRow,
  FeeTemplate,
} from '../adminTypes';
import { formatPrice } from '../adminUtils';

interface FeeModalProps {
  open: boolean;
  row: FeeScheduleRow | null;
  settings: Record<string, unknown>;
  categories: FeeCategoryOption[];
  templates: FeeTemplate[];
  billingCodeTypes: BillingCodeType[];
  defaultCodeType: string;
  billingCodes: BillingCode[];
  billingCodesLoading: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onCodeTypeChange: (codeType: string) => void;
  onSave: (payload: {
    id: number;
    code: string;
    name: string;
    category: string;
    price_amount: number;
    sort_order: number;
    code_type: string;
    billing_code: string;
  }) => void;
}

export function FeeModal({
  open,
  row,
  settings,
  categories,
  templates,
  billingCodeTypes,
  defaultCodeType,
  billingCodes,
  billingCodesLoading,
  saving,
  error,
  onClose,
  onCodeTypeChange,
  onSave,
}: FeeModalProps) {
  const [templateId, setTemplateId] = useState('');
  const [templateHint, setTemplateHint] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('consult');
  const [price, setPrice] = useState('0');
  const [sortOrder, setSortOrder] = useState('0');
  const [codeType, setCodeType] = useState(defaultCodeType);
  const [billingCode, setBillingCode] = useState('');

  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setTemplateId('');
    setTemplateHint('');
    setCode(row?.code ?? '');
    setName(row?.name ?? '');
    setCategory(row?.category ?? 'consult');
    setPrice(String(row?.price_amount ?? '0'));
    setSortOrder(String(row?.sort_order ?? '0'));
    const ct = row?.code_type ?? defaultCodeType;
    setCodeType(ct);
    setBillingCode(row?.billing_code ?? '');
    if (!row) {
      onCodeTypeChange(ct);
    }
  }, [open, row, defaultCodeType, onCodeTypeChange]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    if (!id) {
      setTemplateHint('');
      return;
    }
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setCode(template.code ?? '');
    setName(template.name ?? '');
    setCategory(template.category ?? 'consult');
    setPrice(String(template.price_amount ?? 0));
    setSortOrder(String(template.sort_order ?? 0));
    setCodeType(template.code_type ?? defaultCodeType);
    setTemplateHint(template.hint ?? '');
    onCodeTypeChange(template.code_type ?? defaultCodeType);
  };

  const onBillingCodePicked = (picked: string) => {
    setBillingCode(picked);
    const match = billingCodes.find((b) => b.code === picked);
    if (!match) return;
    if (!name.trim() && match.name) setName(match.name);
    if (!code.trim()) setCode(match.code);
    if ((price === '' || Number.parseFloat(price) === 0) && match.fee) {
      setPrice(String(match.fee));
    }
  };

  const priceHint = settings.currency_symbol
    ? `Clinic currency: ${String(settings.currency_symbol)}`
    : 'Default amount suggested to cashier; editable at payment.';

  if (!open) return null;

  return (
    <>
      <div
        className="modal fade show d-block"
        id="nc-admin-fee-modal"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="nc-admin-fee-title"
        aria-modal="true"
      >
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title" id="nc-admin-fee-title">
                {row ? 'Edit fee line' : 'Add fee line'}
              </h5>
              <button
                type="button"
                className="btn btn-link close"
                id="nc-admin-fee-close"
                aria-label="Close"
                onClick={onClose}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div className="modal-body">
              <input type="hidden" id="nc-admin-fee-id" value={row?.id ?? ''} />
              <div className="form-group" id="nc-admin-fee-template-wrap">
                <label htmlFor="nc-admin-fee-template">Start from template (optional)</label>
                <select
                  className="form-control"
                  id="nc-admin-fee-template"
                  value={templateId}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">Blank fee line</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <small className="form-text text-muted" id="nc-admin-fee-template-hint">
                  {templateHint}
                </small>
              </div>
              <div className="form-row">
                <div className="form-group col-md-4">
                  <label htmlFor="nc-admin-fee-code">Schedule code</label>
                  <input
                    type="text"
                    className="form-control"
                    id="nc-admin-fee-code"
                    maxLength={32}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <small className="form-text text-muted">
                    Short ID used in this clinic module (e.g. OPD_CONSULT).
                  </small>
                </div>
                <div className="form-group col-md-8">
                  <label htmlFor="nc-admin-fee-name">Description</label>
                  <input
                    type="text"
                    className="form-control"
                    id="nc-admin-fee-name"
                    maxLength={128}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <small className="form-text text-muted">Shown to cashier when picking charges.</small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group col-md-4">
                  <label htmlFor="nc-admin-fee-category">Category</label>
                  <select
                    className="form-control"
                    id="nc-admin-fee-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group col-md-4">
                  <label htmlFor="nc-admin-fee-price">Default price</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="form-control"
                    id="nc-admin-fee-price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <small className="form-text text-muted" id="nc-admin-fee-price-hint">{priceHint}</small>
                </div>
                <div className="form-group col-md-4">
                  <label htmlFor="nc-admin-fee-sort">Sort order</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="form-control"
                    id="nc-admin-fee-sort"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                  <small className="form-text text-muted">Lower numbers appear first in lists.</small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group col-md-4">
                  <label htmlFor="nc-admin-fee-code-type">OpenEMR code type</label>
                  <select
                    className="form-control"
                    id="nc-admin-fee-code-type"
                    value={codeType}
                    onChange={(e) => {
                      setCodeType(e.target.value);
                      setBillingCode('');
                      onCodeTypeChange(e.target.value);
                    }}
                  >
                    {!billingCodeTypes.length ? (
                      <option value="">No billable code types</option>
                    ) : (
                      billingCodeTypes.map((t) => (
                        <option key={t.ct_key} value={t.ct_key}>
                          {t.label} ({t.ct_key})
                        </option>
                      ))
                    )}
                  </select>
                  <small className="form-text text-muted" id="nc-admin-fee-code-type-hint">
                    {billingCodeTypes.length
                      ? 'CPT4/HCPCS for standard codes; use the type where your clinic codes live.'
                      : 'Enable fee types under Administration → Codes in OpenEMR.'}
                  </small>
                </div>
                <div className="form-group col-md-8">
                  <label htmlFor="nc-admin-fee-billing-code">Billing code</label>
                  <select
                    className="form-control"
                    id="nc-admin-fee-billing-code"
                    value={billingCode}
                    disabled={billingCodesLoading}
                    onChange={(e) => onBillingCodePicked(e.target.value)}
                  >
                    {!billingCodes.length ? (
                      <option value="">No codes found — add in OpenEMR first</option>
                    ) : (
                      <>
                        <option value="">Select billing code…</option>
                        {billingCodes.map((b) => {
                          let label = `${b.code} — ${b.name || 'No description'}`;
                          if (b.fee) label += ` (${formatPrice(b.fee, settings)})`;
                          return (
                            <option key={b.code} value={b.code}>{label}</option>
                          );
                        })}
                      </>
                    )}
                  </select>
                  <small className="form-text text-muted" id="nc-admin-fee-billing-hint">
                    {billingCodesLoading
                      ? 'Loading codes…'
                      : billingCodes.length
                        ? `${billingCodes.length} active code(s) for this type.`
                        : 'Open Codes admin, add the billing code, then refresh this dialog.'}
                  </small>
                </div>
              </div>
              {error && (
                <div className="alert alert-danger" id="nc-admin-fee-error">{error}</div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                id="nc-admin-fee-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                id="nc-admin-fee-save"
                disabled={saving}
                onClick={() => onSave({
                  id: row?.id ?? 0,
                  code: code.trim(),
                  name: name.trim(),
                  category,
                  price_amount: Number.parseFloat(price) || 0,
                  sort_order: Number.parseInt(sortOrder, 10) || 0,
                  code_type: codeType,
                  billing_code: billingCode,
                })}
              >
                {saving ? 'Saving…' : 'Save fee line'}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>
  );
}
