import { useEffect, useState } from 'react';
import { useModalDismiss } from '@components/useModalDismiss';
import { Button } from '@components/ui/button';
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
import { Label } from '@components/ui/label';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { Input } from '@components/ui/input';
import { Switch } from '@components/ui/switch';
import type { FacilityRow } from '../adminTypes';

interface FacilityModalProps {
  open: boolean;
  row: FacilityRow | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    id: number;
    name: string;
    phone: string;
    email: string;
    website: string;
    street: string;
    city: string;
    state: string;
    postal_code: string;
    country_code: string;
    color: string;
    service_location: boolean;
    billing_location: boolean;
    inactive: boolean;
  }) => void;
}

export function FacilityModal({ open, row, saving, error, onClose, onSave }: FacilityModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [color, setColor] = useState('');
  const [serviceLocation, setServiceLocation] = useState(true);
  const [billingLocation, setBillingLocation] = useState(true);
  const [inactive, setInactive] = useState(false);

  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setName(row?.name ?? '');
    setPhone(row?.phone ?? '');
    setEmail(row?.email ?? '');
    setWebsite(row?.website ?? '');
    setStreet(row?.street ?? '');
    setCity(row?.city ?? '');
    setState(row?.state ?? '');
    setPostalCode(row?.postal_code ?? '');
    setCountryCode(row?.country_code ?? '');
    setColor(row?.color ?? '');
    setServiceLocation(row ? row.service_location : true);
    setBillingLocation(row ? row.billing_location : true);
    setInactive(row?.inactive ?? false);
  }, [open, row]);

  const canSave = name.trim() !== '';

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-admin-facility-modal"
        className={dialogContentSizeClass.lg}
        aria-labelledby="nc-admin-facility-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-admin-facility-title">
            {row ? 'Edit clinic details' : 'Add facility'}
          </DialogTitle>
          <DialogClose id="nc-admin-facility-close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-admin-facility-name">Facility name</Label>
            <Input
              type="text"
              id="nc-admin-facility-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-facility-phone">Phone</Label>
              <Input
                type="tel"
                id="nc-admin-facility-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-facility-email">Email</Label>
              <Input
                type="email"
                id="nc-admin-facility-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-admin-facility-website">Website</Label>
            <Input
              type="text"
              id="nc-admin-facility-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-admin-facility-street">Street address</Label>
            <Input
              type="text"
              id="nc-admin-facility-street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-facility-city">City</Label>
              <Input
                type="text"
                id="nc-admin-facility-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-facility-state">State / region</Label>
              <Input
                type="text"
                id="nc-admin-facility-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-facility-postal">Postal code</Label>
              <Input
                type="text"
                id="nc-admin-facility-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-facility-country">Country</Label>
              <Input
                type="text"
                id="nc-admin-facility-country"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-admin-facility-color">Calendar color</Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                id="nc-admin-facility-color"
                placeholder="#99FFFF"
                maxLength={7}
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-32"
              />
              <span
                className="h-6 w-6 shrink-0 rounded-[0.25rem]"
                style={{
                  backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? color : 'transparent',
                  border: '1px solid var(--oe-nc-border)',
                }}
                aria-hidden
              />
            </div>
          </div>

          <div className="divide-y divide-[var(--oe-nc-border)]/60 mb-1">
            <div className="flex items-center justify-between gap-4 py-2">
              <Label htmlFor="nc-admin-facility-service-location" className="font-normal normal-case cursor-pointer">
                Service location
              </Label>
              <Switch
                id="nc-admin-facility-service-location"
                checked={serviceLocation}
                onCheckedChange={setServiceLocation}
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <Label htmlFor="nc-admin-facility-billing-location" className="font-normal normal-case cursor-pointer">
                Billing location
              </Label>
              <Switch
                id="nc-admin-facility-billing-location"
                checked={billingLocation}
                onCheckedChange={setBillingLocation}
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <Label htmlFor="nc-admin-facility-inactive" className="font-normal normal-case cursor-pointer">
                Inactive
              </Label>
              <Switch
                id="nc-admin-facility-inactive"
                checked={inactive}
                onCheckedChange={setInactive}
              />
            </div>
          </div>

          {error && (
            <div className={deskCalloutClass('error', 'text-sm')} id="nc-admin-facility-error" role="alert">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" id="nc-admin-facility-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            id="nc-admin-facility-save"
            disabled={saving || !canSave}
            onClick={() => onSave({
              id: row?.id ?? 0,
              name: name.trim(),
              phone: phone.trim(),
              email: email.trim(),
              website: website.trim(),
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              postal_code: postalCode.trim(),
              country_code: countryCode.trim(),
              color: color.trim(),
              service_location: serviceLocation,
              billing_location: billingLocation,
              inactive,
            })}
          >
            {saving ? 'Saving…' : 'Save facility'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
