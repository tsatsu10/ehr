import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutreachHub } from './OutreachHub';
import * as oeFetchModule from '@core/oeFetch';
import * as deskToast from '@components/deskToast';

vi.mock('@core/oeFetch');
vi.mock('@components/deskToast');

const mockedFetch = vi.mocked(oeFetchModule.oeFetch);
const mockedToast = vi.mocked(deskToast.showDeskToast);

const presets = {
  presets: { builtins: [{ id: 'in_clinic_now', label: 'In clinic now', filters: { active_visit_today: 'yes' } }] },
  gateway_configured: false,
};

function mockDefault() {
  mockedFetch.mockImplementation(async (action: string) => {
    if (action === 'outreach.presets') return presets as never;
    if (action === 'outreach.history') return { campaigns: [] } as never;
    if (action === 'outreach.preview') {
      return {
        channel: 'sms',
        recipient_count: 12,
        reachable_count: 9,
        capped: false,
        cap: 500,
        filter_summary: 'In clinic now',
        sample: [{ name: 'Doe, Jane', contact: '+233200000000' }],
      } as never;
    }
    if (action === 'outreach.queue') {
      return { status: 'stubbed', note: 'not sent', recipient_count: 12, reachable_count: 9 } as never;
    }
    return {} as never;
  });
}

describe('OutreachHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDefault();
  });

  it('shows the no-gateway banner and loads the audience presets', async () => {
    render(<OutreachHub ajaxUrl="/ajax.php" csrfToken="tok" />);
    expect(await screen.findByText(/No messaging gateway is configured/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Audience')).toBeInTheDocument();
  });

  it('previews recipients then queues via a confirm dialog (dry-run first)', async () => {
    render(<OutreachHub ajaxUrl="/ajax.php" csrfToken="tok" />);
    await screen.findByText('New campaign');

    // Queue is disabled until a preview exists.
    expect(screen.getByRole('button', { name: 'Queue campaign' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Preview recipients' }));
    await waitFor(() => expect(screen.getByText(/9 of 12 reachable by SMS/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Clinic reminder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Queue campaign' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Queue campaign' }));

    await waitFor(() =>
      expect(mockedFetch.mock.calls.some((c) => c[0] === 'outreach.queue')).toBe(true)
    );
    const queueCall = mockedFetch.mock.calls.find((c) => c[0] === 'outreach.queue');
    expect(queueCall?.[1]).toMatchObject({
      method: 'POST',
      json: expect.objectContaining({ channel: 'sms', body: 'Clinic reminder' }),
    });
    await waitFor(() => expect(mockedToast).toHaveBeenCalled());
  });

  it('requires an email subject before queueing on the email channel', async () => {
    render(<OutreachHub ajaxUrl="/ajax.php" csrfToken="tok" />);
    await screen.findByText('New campaign');

    fireEvent.click(screen.getByText('Email'));
    fireEvent.click(screen.getByRole('button', { name: 'Preview recipients' }));
    await waitFor(() => screen.getByText(/reachable by/i));

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Body' } });
    // No subject yet → still disabled
    expect(screen.getByRole('button', { name: 'Queue campaign' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    expect(screen.getByRole('button', { name: 'Queue campaign' })).toBeEnabled();
  });
});
