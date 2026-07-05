import { useEffect, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  dialogContentSizeClass,
} from '@components/ui/dialog';
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-admin-fee-modal"
        className={dialogContentSizeClass.lg}
        aria-labelledby="nc-admin-fee-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-admin-fee-title">
            {row ? 'Edit fee line' : 'Add fee line'}
          </DialogTitle>
          <DialogClose
            id="nc-admin-fee-close"
            aria-label="Close"
          >
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
              <input type="hidden" id="nc-admin-fee-id" value={row?.id ?? ''} />
              <div className="space-y-1.5 mb-3" id="nc-admin-fee-template-wrap">
                <Label htmlFor="nc-admin-fee-template">Start from template (optional)</Label>
                <Select value={templateId || '_blank'} onValueChange={(val) => applyTemplate(val === '_blank' ? '' : val)}>
                  <SelectTrigger id="nc-admin-fee-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_blank">Blank fee line</SelectItem>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[var(--oe-nc-text-muted)] m-0" id="nc-admin-fee-template-hint">
                  {templateHint}
                </p>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-admin-fee-code">Schedule code</Label>
                  <Input
                    type="text"
                    id="nc-admin-fee-code"
                    maxLength={32}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">
                    Short ID used in this clinic module (e.g. OPD_CONSULT).
                  </p>
                </div>
                <div className="nc-form-group col-span-12 md:col-span-8 space-y-1.5">
                  <Label htmlFor="nc-admin-fee-name">Description</Label>
                  <Input
                    type="text"
                    id="nc-admin-fee-name"
                    maxLength={128}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">Shown to cashier when picking charges.</p>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-admin-fee-category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="nc-admin-fee-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="nc-form-group col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-admin-fee-price">Default price</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    id="nc-admin-fee-price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <p className="text-xs text-[var(--oe-nc-text-muted)] m-0" id="nc-admin-fee-price-hint">{priceHint}</p>
                </div>
                <div className="nc-form-group col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-admin-fee-sort">Sort order</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    id="nc-admin-fee-sort"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  />
                  <p className="text-xs text-[var(--oe-nc-text-muted)] m-0">Lower numbers appear first in lists.</p>
                </div>
              </div>
              <div className="grid grid-cols-12 gap-3">
                <div className="nc-form-group col-span-12 md:col-span-4 space-y-1.5">
                  <Label htmlFor="nc-admin-fee-code-type">OpenEMR code type</Label>
                  <Select
                    value={codeType || '_empty'}
                    onValueChange={(val) => {
                      const next = val === '_empty' ? '' : val;
                      setCodeType(next);
                      setBillingCode('');
                      onCodeTypeChange(next);
                    }}
                  >
                    <SelectTrigger id="nc-admin-fee-code-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!billingCodeTypes.length ? (
                        <SelectItem value="_empty">No billable code types</SelectItem>
                      ) : (
                        billingCodeTypes.map((t) => (
                          <SelectItem key={t.ct_key} value={t.ct_key}>
                            {t.label} ({t.ct_key})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--oe-nc-text-muted)] m-0" id="nc-admin-fee-code-type-hint">
                    {billingCodeTypes.length
                      ? 'CPT4/HCPCS for standard codes; use the type where your clinic codes live.'
                      : 'Enable fee types under Administration → Codes in OpenEMR.'}
                  </p>
                </div>
                <div className="nc-form-group col-span-12 md:col-span-8 space-y-1.5">
                  <Label htmlFor="nc-admin-fee-billing-code">Billing code</Label>
                  <Select
                    value={billingCode || '_empty'}
                    disabled={billingCodesLoading}
                    onValueChange={(val) => onBillingCodePicked(val === '_empty' ? '' : val)}
                  >
                    <SelectTrigger id="nc-admin-fee-billing-code">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!billingCodes.length ? (
                        <SelectItem value="_empty">No codes found — add in OpenEMR first</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="_empty">Select billing code…</SelectItem>
                          {billingCodes.map((b) => {
                            let optionLabel = `${b.code} — ${b.name || 'No description'}`;
                            if (b.fee) optionLabel += ` (${formatPrice(b.fee, settings)})`;
                            return (
                              <SelectItem key={b.code} value={b.code}>{optionLabel}</SelectItem>
                            );
                          })}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--oe-nc-text-muted)] m-0" id="nc-admin-fee-billing-hint">
                    {billingCodesLoading
                      ? 'Loading codes…'
                      : billingCodes.length
                        ? `${billingCodes.length} active code(s) for this type.`
                        : 'Open Codes admin, add the billing code, then refresh this dialog.'}
                  </p>
                </div>
              </div>
              {error && (
                <div className={deskCalloutClass('error', 'text-sm')} id="nc-admin-fee-error" role="alert">
                  {error}
                </div>
              )}
            </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            id="nc-admin-fee-cancel"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
