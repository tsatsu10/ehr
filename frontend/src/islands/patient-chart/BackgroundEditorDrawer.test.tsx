import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundEditorDrawer } from './BackgroundEditorDrawer';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

const baseProps = {
  open: true,
  pid: 42,
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  onClose: vi.fn(),
  onSaved: vi.fn(),
};

const historyPayload = {
  text: {
    family_mother: 'Hypertension',
    family_father: '',
    family_siblings: '',
    tobacco: '',
    alcohol: '',
    recreational_drugs: '',
    exercise: '',
    herbal_medicine: '',
    occupation: 'Farmer',
    past_medical_history: '',
    last_hb: '',
  },
  family_conditions: {
    sickle_cell: true,
    hypertension: false,
    diabetes: false,
    heart: false,
    stroke: false,
    tuberculosis: false,
    cancer: false,
    epilepsy: false,
    mental_illness: false,
  },
  dates: { last_bp_date: '', last_glucose_date: '' },
};

describe('BackgroundEditorDrawer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads existing background and offers the native full-form switch (no stock link)', async () => {
    mockedFetch.mockResolvedValue(historyPayload as never);
    render(<BackgroundEditorDrawer {...baseProps} />);

    expect(await screen.findByDisplayValue('Hypertension')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Farmer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Full form/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Full history form/i })).not.toBeInTheDocument();
    // Regression: the panel must carry an explicit width class, or it collapses to a
    // sliver off-screen (panelRightClass sets no width). A max-width alone is not enough.
    expect(screen.getByRole('dialog').className).toMatch(/\bw-\[/);
  });

  it('renders lifestyle fields as dropdowns and preserves a pre-existing typed value', async () => {
    const payload = { ...historyPayload, text: { ...historyPayload.text, tobacco: 'smokes sometimes' } };
    mockedFetch.mockResolvedValue(payload as never);
    render(<BackgroundEditorDrawer {...baseProps} />);

    const tobacco = (await screen.findByLabelText('Tobacco')) as HTMLSelectElement;
    expect(tobacco.tagName).toBe('SELECT');
    const optionValues = Array.from(tobacco.options).map((o) => o.value);
    expect(optionValues).toContain('Never');
    expect(optionValues).toContain('Current');
    // A value typed via the stock form is kept as a custom option, not dropped.
    expect(optionValues).toContain('smokes sometimes');
    expect(tobacco.value).toBe('smokes sometimes');
  });

  it('edits a field and saves the curated payload', async () => {
    mockedFetch.mockResolvedValueOnce(historyPayload as never); // history_get on mount
    mockedFetch.mockResolvedValueOnce({ id: 3, status: 'ok' } as never); // history_save
    const onSaved = vi.fn();
    render(<BackgroundEditorDrawer {...baseProps} onSaved={onSaved} />);

    const occupation = await screen.findByLabelText('Occupation');
    fireEvent.change(occupation, { target: { value: 'Trader' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'patients.chart.history_save',
        expect.objectContaining({
          params: { pid: 42 },
          json: expect.objectContaining({
            background: expect.objectContaining({
              text: expect.objectContaining({ occupation: 'Trader' }),
              family_conditions: expect.objectContaining({ sickle_cell: true }),
            }),
          }),
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('switches to full mode and shows the extra sections (D-HIST-10)', async () => {
    mockedFetch.mockResolvedValue(historyPayload as never);
    render(<BackgroundEditorDrawer {...baseProps} />);

    // Quick mode first — a "Full form" switch.
    fireEvent.click(await screen.findByRole('button', { name: /Full form/i }));

    expect(screen.getByText('Edit full history')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Risk factors' })).toBeInTheDocument();
    // Sensitive family history is kept behind a reveal.
    expect(screen.getByRole('button', { name: /Add mental health history/i })).toBeInTheDocument();
  });

  it('surfaces a load error', async () => {
    mockedFetch.mockRejectedValue(new Error('boom'));
    render(<BackgroundEditorDrawer {...baseProps} />);
    expect(await screen.findByText('boom')).toBeInTheDocument();
  });
});
