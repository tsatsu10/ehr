import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', async () => {
  const actual = await vi.importActual<typeof import('@core/oeFetch')>('@core/oeFetch');
  return { ...actual, oeFetch: (...args: unknown[]) => oeFetchMock(...args) };
});

const toastMock = vi.fn();
vi.mock('@components/deskToast', () => ({ showDeskToast: (...args: unknown[]) => toastMock(...args) }));

import { clearScreeningCachesForTest, ScreeningDrawer } from './ScreeningDrawer';

const phq9Def = {
  id: 'phq9',
  title: 'PHQ-9',
  subtitle: 'Depression screen',
  stem: 'Over the last 2 weeks…',
  options: [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ],
  max_score: 6,
  items: ['Item one', 'Thoughts of self-harm'],
  bands: [
    { min: 0, max: 2, severity: 'minimal', label: 'Minimal or none' },
    { min: 3, max: 6, severity: 'moderate', label: 'Moderate' },
  ],
  flag_rules: [{ item: 2, min_value: 1, flag: 'self_harm', message: 'Assess safety before the patient leaves.' }],
};

const baseProps = {
  open: true,
  onClose: vi.fn(),
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  visitId: 72,
  instrument: 'phq9',
  patientLabel: 'Test Patient · PT-12',
  onSaved: vi.fn(),
};

describe('ScreeningDrawer', () => {
  beforeEach(() => {
    oeFetchMock.mockReset();
    toastMock.mockReset();
    baseProps.onSaved = vi.fn();
    clearScreeningCachesForTest();
  });

  it('loads the instrument and blocks save until every item is answered', async () => {
    oeFetchMock.mockResolvedValueOnce({ instrument: phq9Def, answers: {}, saved: false });
    render(<ScreeningDrawer {...baseProps} />);
    expect(await screen.findByText('Item one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save screening/i })).toBeDisabled();
    expect(oeFetchMock).toHaveBeenCalledWith('clinical_doc.screening_get', expect.objectContaining({
      params: { visit_id: 72, instrument: 'phq9' },
    }));
  });

  it('computes the live score and shows the self-harm alert', async () => {
    oeFetchMock.mockResolvedValueOnce({ instrument: phq9Def, answers: {}, saved: false });
    render(<ScreeningDrawer {...baseProps} />);
    await screen.findByText('Item one');
    // item 1 = 2 (More than half the days), item 2 = 1 (Several days) -> total 3, Moderate, self-harm
    fireEvent.click(screen.getAllByLabelText('More than half the days')[0]);
    fireEvent.click(screen.getAllByLabelText('Several days')[1]);
    expect(screen.getByText('3 / 6')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('2/2 answered')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Assess safety before the patient leaves.');
  });

  it('saves and calls onSaved with a toast', async () => {
    oeFetchMock.mockResolvedValueOnce({ instrument: phq9Def, answers: { 1: 1, 2: 0 }, saved: true });
    oeFetchMock.mockResolvedValueOnce({ saved: true, id: 5, total: 1, severity: 'minimal' });
    render(<ScreeningDrawer {...baseProps} />);
    await screen.findByText('Item one');
    fireEvent.click(screen.getByRole('button', { name: /Save screening/i }));
    await waitFor(() => expect(baseProps.onSaved).toHaveBeenCalled());
    expect(oeFetchMock).toHaveBeenLastCalledWith('clinical_doc.screening_save', expect.objectContaining({
      method: 'POST',
      json: { visit_id: 72, instrument: 'phq9', answers: { 1: 1, 2: 0 } },
    }));
    expect(toastMock).toHaveBeenCalledWith('Screening saved', 'success');
  });
});
