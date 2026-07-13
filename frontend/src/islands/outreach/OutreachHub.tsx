import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Users } from 'lucide-react';
import { deskCalloutClass } from '@components/deskCalloutStyles';
import { showDeskToast } from '@components/deskToast';
import { ConfirmModal } from '@components/ConfirmModal';
import { SegmentedControl } from '@components/SegmentedControl';
import { ncShadcnTableClass } from '@components/ncTableStyles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { NativeSelect } from '@components/ui/native-select';
import { Textarea } from '@components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { AdminLoadingState, AdminSection } from '@islands/admin-hub/adminUi';
import { oeFetch } from '@core/oeFetch';
import type {
  OutreachHistoryData,
  OutreachPreset,
  OutreachPresetsData,
  OutreachPreviewData,
  OutreachProps,
  OutreachQueueResult,
} from './outreachTypes';

type Channel = 'sms' | 'email';

export function OutreachHub({ ajaxUrl, csrfToken }: OutreachProps) {
  const fetchOptions = useMemo(() => ({ ajaxUrl, csrfToken }), [ajaxUrl, csrfToken]);

  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState<OutreachPreset[]>([]);
  const [gatewayConfigured, setGatewayConfigured] = useState(false);
  const [history, setHistory] = useState<OutreachHistoryData['campaigns']>([]);

  const [channel, setChannel] = useState<Channel>('sms');
  const [presetId, setPresetId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [preview, setPreview] = useState<OutreachPreviewData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [queuing, setQueuing] = useState(false);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === presetId) ?? null,
    [presets, presetId]
  );

  const loadHistory = useCallback(async () => {
    try {
      const data = await oeFetch<OutreachHistoryData>('outreach.history', fetchOptions);
      setHistory(data.campaigns ?? []);
    } catch {
      /* non-fatal */
    }
  }, [fetchOptions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await oeFetch<OutreachPresetsData>('outreach.presets', fetchOptions);
        if (cancelled) return;
        const builtins = data.presets?.builtins ?? [];
        setPresets(builtins);
        setPresetId(builtins[0]?.id ?? '');
        setGatewayConfigured(!!data.gateway_configured);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load outreach.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    void loadHistory();
    return () => { cancelled = true; };
  }, [fetchOptions, loadHistory]);

  // Editing the audience/channel invalidates a stale preview.
  useEffect(() => { setPreview(null); }, [presetId, channel]);

  const runPreview = async () => {
    if (!selectedPreset) return;
    setPreviewing(true);
    setError(null);
    try {
      const data = await oeFetch<OutreachPreviewData>('outreach.preview', {
        ...fetchOptions,
        method: 'POST',
        json: { channel, filters: selectedPreset.filters },
      });
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not preview recipients.');
    } finally {
      setPreviewing(false);
    }
  };

  const confirmQueue = async () => {
    if (!selectedPreset) return;
    setQueuing(true);
    setError(null);
    try {
      const result = await oeFetch<OutreachQueueResult>('outreach.queue', {
        ...fetchOptions,
        method: 'POST',
        json: { channel, filters: selectedPreset.filters, subject, body },
      });
      setConfirmOpen(false);
      showDeskToast(
        result.status === 'stubbed'
          ? `Recorded for ${result.reachable_count} recipient(s). No gateway configured yet, so nothing was sent.`
          : `Queued for ${result.reachable_count} recipient(s).`,
        result.status === 'stubbed' ? 'info' : 'success'
      );
      setBody('');
      setSubject('');
      setPreview(null);
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not queue the campaign.');
    } finally {
      setQueuing(false);
    }
  };

  if (loading) {
    return <AdminLoadingState label="Loading outreach…" />;
  }

  const bodyReady = body.trim() !== '' && (channel === 'sms' || subject.trim() !== '');
  const canQueue = !!preview && preview.reachable_count > 0 && bodyReady;

  return (
    <div className="nc-outreach space-y-4">
      {!gatewayConfigured && (
        <div className={deskCalloutClass('info')}>
          No messaging gateway is configured yet — campaigns are recorded for review but not sent.
          Wiring an SMS/email provider is a separate setup step.
        </div>
      )}
      {error && <div className={deskCalloutClass('error')}>{error}</div>}

      <AdminSection
        title="New campaign"
        description="Pick an audience, write the message, preview who it reaches, then queue."
        icon={<Megaphone className="h-4 w-4" aria-hidden />}
      >
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">Channel</Label>
            <SegmentedControl
              ariaLabel="Channel"
              segments={[{ id: 'sms', label: 'SMS' }, { id: 'email', label: 'Email' }]}
              value={channel}
              onChange={(id) => setChannel(id === 'email' ? 'email' : 'sms')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nc-outreach-audience">Audience</Label>
            <NativeSelect
              id="nc-outreach-audience"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </NativeSelect>
          </div>

          {channel === 'email' && (
            <div className="space-y-1.5">
              <Label htmlFor="nc-outreach-subject">Subject</Label>
              <Input
                id="nc-outreach-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="nc-outreach-body">Message</Label>
            <Textarea
              id="nc-outreach-body"
              rows={4}
              value={body}
              placeholder="Keep SMS short. Avoid sharing clinical details over SMS/email."
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={previewing || !selectedPreset}
              onClick={() => { void runPreview(); }}
            >
              {previewing ? 'Checking…' : 'Preview recipients'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canQueue}
              onClick={() => setConfirmOpen(true)}
            >
              Queue campaign
            </Button>
          </div>

          {preview && (
            <div className="rounded-md [border:1px_solid_var(--oe-nc-border)] p-3 bg-[var(--oe-nc-bg-tint)]">
              <p className="mb-1 text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" aria-hidden />
                {preview.reachable_count} of {preview.recipient_count} reachable by {preview.channel.toUpperCase()}
              </p>
              {preview.filter_summary && (
                <p className="text-sm text-[var(--oe-nc-text-muted)] mb-1">Audience: {preview.filter_summary}</p>
              )}
              {preview.capped && (
                <p className="text-sm text-[var(--color-oe-warning,#d97706)] mb-1">
                  Showing the first {preview.cap}. Larger cohorts are split into batches (coming soon).
                </p>
              )}
              {preview.reachable_count === 0 ? (
                <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">
                  No one in this audience has {preview.channel === 'email' ? 'an email address' : 'a phone number'} on file.
                </p>
              ) : (
                <div className="overflow-x-auto mt-2">
                  <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
                    <TableHeader>
                      <TableRow><TableHead>Patient</TableHead><TableHead>Contact</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.sample.map((s, i) => (
                        <TableRow key={`${s.name}-${i}`}>
                          <TableCell>{s.name}</TableCell>
                          <TableCell className="text-[var(--oe-nc-text-muted)]">{s.contact}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </AdminSection>

      <AdminSection title="Recent campaigns" description="Campaigns queued from this clinic.">
        {history.length === 0 ? (
          <p className="text-sm text-[var(--oe-nc-text-muted)] mb-0">No campaigns yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className={ncShadcnTableClass({ className: 'mb-0' })}>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Audience</TableHead>
                  <TableHead>Reached</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm text-[var(--oe-nc-text-muted)]">{c.created_at}</TableCell>
                    <TableCell className="uppercase text-sm">{c.channel}</TableCell>
                    <TableCell className="text-sm">{c.filter_summary || '—'}</TableCell>
                    <TableCell className="text-sm">{c.reachable_count}/{c.recipient_count}</TableCell>
                    <TableCell className="text-sm">{c.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </AdminSection>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Queue this campaign?"
        titleId="nc-outreach-confirm-title"
        confirmLabel="Queue campaign"
        submitting={queuing}
        submittingLabel="Queuing…"
        onConfirm={() => { void confirmQueue(); }}
      >
        <p className="mb-0">
          {preview
            ? `This will queue a ${channel.toUpperCase()} message to ${preview.reachable_count} reachable recipient(s)`
            : 'This will queue the campaign'}
          {gatewayConfigured ? '.' : ' (recorded only — no gateway configured yet).'}
        </p>
      </ConfirmModal>
    </div>
  );
}
