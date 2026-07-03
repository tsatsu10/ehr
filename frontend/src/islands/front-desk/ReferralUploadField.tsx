import { useRef } from 'react';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { AlertCircle, CheckCircle2, FileUp, Loader2, X } from 'lucide-react';

interface ReferralUploadFieldProps {
  referralRequired?: boolean;
  documentId: number | null;
  filename: string | null;
  uploading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onSelectFile: (file: File) => void;
  onClear: () => void;
}

export function ReferralUploadField({
  referralRequired = false,
  documentId,
  filename,
  uploading = false,
  error = null,
  disabled = false,
  onSelectFile,
  onClear,
}: ReferralUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2 rounded-lg border border-(--oe-nc-border) bg-(--oe-nc-surface-muted) px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">Referral document (optional)</Label>
          <p className="text-xs text-(--oe-nc-text-muted) mt-1">
            Upload a PDF or image if the patient brought an external lab referral. Start visit is not blocked
            when no file is attached.
          </p>
        </div>
        {documentId != null && (
          <span className="badge badge-info text-xs shrink-0">On file</span>
        )}
      </div>

      {referralRequired && documentId == null && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          This visit type is configured to expect a referral. You can still start the visit and add the scan later.
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,image/jpeg,image/png,image/gif,image/webp"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onSelectFile(file);
          }
          event.target.value = '';
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          {uploading ? 'Uploading…' : documentId != null ? 'Replace referral' : 'Upload referral'}
        </Button>
        {documentId != null && filename && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || uploading}
            onClick={onClear}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {documentId != null && filename && (
        <div className="flex items-center gap-2 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{filename}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
