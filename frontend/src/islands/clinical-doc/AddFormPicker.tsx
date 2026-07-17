import { useState } from 'react';
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
import type { ClinicalDocCard, ClinicalDocLens } from './clinicalDocTypes';
import { openClinicalDocForm } from './clinicalDocApi';

interface AddFormPickerProps {
  addableForms: ClinicalDocCard[];
  visitId: number;
  ajaxUrl: string;
  csrfToken: string;
  lens: ClinicalDocLens;
  onOpenError: (message: string) => void;
  onOpenInstructions?: () => void;
  onOpenVitals?: () => void;
  onOpenScreening?: (instrument: string) => void;
  onOpenCertificate?: () => void;
  onOpenEyeExam?: () => void;
}

const NATIVE_SCREENING = ['phq9', 'gad7'];

export function AddFormPicker({
  addableForms,
  visitId,
  ajaxUrl,
  csrfToken,
  lens,
  onOpenError,
  onOpenInstructions,
  onOpenVitals,
  onOpenScreening,
  onOpenCertificate,
  onOpenEyeExam,
}: AddFormPickerProps) {
  const [open, setOpen] = useState(false);

  if (addableForms.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mb-3"
        onClick={() => setOpen(true)}
      >
        Add form
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          id="nc-clinicaldoc-add-form-modal"
          className={dialogContentSizeClass.confirm}
          aria-labelledby="nc-clinicaldoc-add-form-title"
        >
          <DialogHeader>
            <DialogTitle id="nc-clinicaldoc-add-form-title">Add form</DialogTitle>
            <DialogClose aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </DialogClose>
          </DialogHeader>
          <DialogBody className="max-h-[min(24rem,70vh)] overflow-y-auto p-0">
            <ul className="nc-list-group nc-list-group-flush">
              {addableForms.map((card) => (
                <li key={card.id} className="nc-list-group-item">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{card.title}</div>
                      <div className="text-sm text-[var(--oe-nc-text-muted)]">{card.description}</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="ml-2"
                      onClick={() => {
                        // Native editors open their drawer directly (consistent
                        // with the lens-pane cards), never the stock bridge.
                        const fd = card.formdir.toLowerCase();
                        if (onOpenInstructions && fd === 'clinical_instructions') {
                          setOpen(false);
                          onOpenInstructions();
                          return;
                        }
                        if (onOpenVitals && fd === 'vitals') {
                          setOpen(false);
                          onOpenVitals();
                          return;
                        }
                        if (onOpenScreening && NATIVE_SCREENING.includes(fd)) {
                          setOpen(false);
                          onOpenScreening(fd);
                          return;
                        }
                        if (onOpenCertificate && fd === 'nc_certificate') {
                          setOpen(false);
                          onOpenCertificate();
                          return;
                        }
                        if (onOpenEyeExam && fd === 'nc_eye_exam') {
                          setOpen(false);
                          onOpenEyeExam();
                          return;
                        }
                        void openClinicalDocForm(ajaxUrl, csrfToken, visitId, card, {
                          lens: card.source_lens ?? card.lens ?? lens,
                          returnTo: 'hub',
                        }).catch((err: unknown) => {
                          onOpenError(err instanceof Error ? err.message : 'Could not open form');
                        });
                      }}
                    >
                      Open
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
