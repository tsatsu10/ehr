import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImmunizationEditorDrawer } from './ImmunizationEditorDrawer';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

const baseProps = {
  open: true,
  pid: 42,
  shotId: 0,
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  onClose: vi.fn(),
  onSaved: vi.fn(),
};
const vaccines = { vaccines: [{ id: '500', label: 'BCG' }, { id: '514', label: 'Measles-Rubella 1' }] };

describe('ImmunizationEditorDrawer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the EPI vaccine list and blocks saving without a vaccine', async () => {
    mockedFetch.mockResolvedValue(vaccines as never);
    render(<ImmunizationEditorDrawer {...baseProps} />);

    expect(await screen.findByRole('option', { name: 'BCG' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Measles-Rubella 1' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a vaccine');
    expect(mockedFetch).not.toHaveBeenCalledWith('patients.chart.immunization_save', expect.anything());
  });

  it('saves a new shot with a vaccine and date', async () => {
    mockedFetch.mockImplementation(((action: string) =>
      action === 'patients.chart.immunization_options'
        ? Promise.resolve(vaccines)
        : Promise.resolve({ id: 7, status: 'ok' })) as never);
    const onSaved = vi.fn();
    render(<ImmunizationEditorDrawer {...baseProps} onSaved={onSaved} />);

    const select = (await screen.findByLabelText('Vaccine')) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Date given'), { target: { value: '2026-01-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'patients.chart.immunization_save',
        expect.objectContaining({
          params: { pid: 42 },
          json: expect.objectContaining({
            immunization: expect.objectContaining({ id: 0, vaccine_id: '500', administered_date: '2026-01-10' }),
          }),
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalled();
  });
});
