import { useMemo, useState } from 'react';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { NativeSelect } from '@components/ui/native-select';
import { BookUser } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import type { DirectoryContactRow, DirectoryContactType } from '../adminTypes';
import { AdminEmptyState, AdminSection } from '../adminUi';

interface DirectoryTabProps {
  contacts: DirectoryContactRow[];
  types: DirectoryContactType[];
  onAdd: () => void;
  onEdit: (row: DirectoryContactRow) => void;
  onDelete: (row: DirectoryContactRow) => void;
}

export function DirectoryTab({ contacts, types, onAdd, onEdit, onDelete }: DirectoryTabProps) {
  const [typeFilter, setTypeFilter] = useState('');

  const filtered = useMemo(
    () => (typeFilter === '' ? contacts : contacts.filter((c) => c.abook_type === typeFilter)),
    [contacts, typeFilter],
  );

  return (
    <AdminSection
      title="Directory"
      description="External contacts — specialists, labs, and other referral targets."
      icon={<BookUser className="h-4 w-4" aria-hidden />}
      action={
        <Button type="button" size="sm" id="nc-admin-add-directory-contact" onClick={onAdd}>
          Add contact
        </Button>
      }
    >
      <div id="nc-admin-directory" className="space-y-3">
        {contacts.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="nc-admin-directory-type-filter" className="text-sm font-medium">
              Type
            </label>
            <NativeSelect
              id="nc-admin-directory-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-auto"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.option_id} value={t.option_id}>
                  {t.title}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        {!filtered.length ? (
          <AdminEmptyState
            title={contacts.length ? 'No contacts match this filter' : 'No directory contacts yet'}
          />
        ) : (
          <Table className={ncShadcnTableClass({ bordered: true, className: 'mb-0' })}>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.display_name || '—'}</TableCell>
                  <TableCell>{row.type_label || '—'}</TableCell>
                  <TableCell>{row.phone || '—'}</TableCell>
                  <TableCell>{row.email || '—'}</TableCell>
                  <TableCell className="text-nowrap">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 mr-2 nc-admin-edit-directory-contact"
                      onClick={() => onEdit(row)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-destructive nc-admin-delete-directory-contact"
                      onClick={() => onDelete(row)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminSection>
  );
}
