import { useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import type { DirectoryContactRow, DirectoryContactType } from '../adminTypes';

interface DirectoryModalProps {
  open: boolean;
  row: DirectoryContactRow | null;
  types: DirectoryContactType[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: {
    id: number;
    abook_type: string;
    organization: string;
    title: string;
    fname: string;
    lname: string;
    phone: string;
    fax: string;
    email: string;
    notes: string;
  }) => void;
}

export function DirectoryModal({
  open,
  row,
  types,
  saving,
  error,
  onClose,
  onSave,
}: DirectoryModalProps) {
  const [abookType, setAbookType] = useState('');
  const [organization, setOrganization] = useState('');
  const [title, setTitle] = useState('');
  const [fname, setFname] = useState('');
  const [lname, setLname] = useState('');
  const [phone, setPhone] = useState('');
  const [fax, setFax] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  useModalDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;
    setAbookType(row?.abook_type ?? types[0]?.option_id ?? '');
    setOrganization(row?.organization ?? '');
    setTitle(row?.title ?? '');
    setFname(row?.fname ?? '');
    setLname(row?.lname ?? '');
    setPhone(row?.phone ?? '');
    setFax(row?.fax ?? '');
    setEmail(row?.email ?? '');
    setNotes(row?.notes ?? '');
  }, [open, row, types]);

  const isCompany = useMemo(
    () => types.find((t) => t.option_id === abookType)?.is_company ?? false,
    [types, abookType],
  );

  const canSave = isCompany ? organization.trim() !== '' : lname.trim() !== '';

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        id="nc-admin-directory-modal"
        className={dialogContentSizeClass.lg}
        aria-labelledby="nc-admin-directory-title"
      >
        <DialogHeader>
          <DialogTitle id="nc-admin-directory-title">
            {row ? 'Edit contact' : 'Add contact'}
          </DialogTitle>
          <DialogClose id="nc-admin-directory-close" aria-label="Close">
            <span aria-hidden="true">&times;</span>
          </DialogClose>
        </DialogHeader>
        <DialogBody>
          <input type="hidden" id="nc-admin-directory-id" value={row?.id ?? ''} />
          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-admin-directory-type">Type</Label>
            <Select value={abookType} onValueChange={setAbookType}>
              <SelectTrigger id="nc-admin-directory-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.option_id} value={t.option_id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCompany ? (
            <div className="space-y-1.5 mb-3">
              <Label htmlFor="nc-admin-directory-organization">Organization name</Label>
              <Input
                type="text"
                id="nc-admin-directory-organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-admin-directory-title-field">Title</Label>
                <Input
                  type="text"
                  id="nc-admin-directory-title-field"
                  placeholder="Dr."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-admin-directory-fname">First name</Label>
                <Input
                  type="text"
                  id="nc-admin-directory-fname"
                  value={fname}
                  onChange={(e) => setFname(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-admin-directory-lname">Last name</Label>
                <Input
                  type="text"
                  id="nc-admin-directory-lname"
                  value={lname}
                  onChange={(e) => setLname(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-directory-phone">Phone</Label>
              <Input
                type="tel"
                id="nc-admin-directory-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-admin-directory-fax">Fax</Label>
              <Input
                type="tel"
                id="nc-admin-directory-fax"
                value={fax}
                onChange={(e) => setFax(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-admin-directory-email">Email</Label>
            <Input
              type="email"
              id="nc-admin-directory-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 mb-3">
            <Label htmlFor="nc-admin-directory-notes">Notes</Label>
            <Textarea
              id="nc-admin-directory-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && (
            <div className={deskCalloutClass('error', 'text-sm')} id="nc-admin-directory-error" role="alert">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" id="nc-admin-directory-cancel" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            id="nc-admin-directory-save"
            disabled={saving || !canSave || abookType === ''}
            onClick={() => onSave({
              id: row?.id ?? 0,
              abook_type: abookType,
              organization: organization.trim(),
              title: title.trim(),
              fname: fname.trim(),
              lname: lname.trim(),
              phone: phone.trim(),
              fax: fax.trim(),
              email: email.trim(),
              notes: notes.trim(),
            })}
          >
            {saving ? 'Saving…' : 'Save contact'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
