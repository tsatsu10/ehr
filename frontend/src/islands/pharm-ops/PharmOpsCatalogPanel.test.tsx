import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PharmOpsCatalogPanel } from './PharmOpsCatalogPanel';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

const catalog = {
  drugs: [
    {
      drug_id: 1, name: 'Paracetamol', form: 'tab', form_label: 'Tablet',
      size: '500', unit: 'mg', unit_label: 'mg', route: 'po', route_label: 'Oral',
      reorder_point: 100, ndc_number: '', active: true, dispensable: true,
    },
  ],
  form_options: [{ value: 'tab', label: 'Tablet' }],
  route_options: [{ value: 'po', label: 'Oral' }],
  unit_options: [{ value: 'mg', label: 'mg' }],
};

describe('PharmOpsCatalogPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockImplementation(async (action: string) => {
      if (action === 'pharm_ops.catalog_list') return catalog as never;
      if (action === 'pharm_ops.catalog_save') {
        return { ...catalog, drugs: [...catalog.drugs, { ...catalog.drugs[0], drug_id: 2, name: 'Amoxicillin' }] } as never;
      }
      return {} as never;
    });
  });

  it('renders nothing when disabled', () => {
    const { container } = render(<PharmOpsCatalogPanel ajaxUrl="/ajax.php" csrfToken="tok" enabled={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('loads and lists drugs on mount', async () => {
    render(<PharmOpsCatalogPanel ajaxUrl="/ajax.php" csrfToken="tok" enabled />);
    expect(await screen.findByText('Paracetamol')).toBeInTheDocument();
    expect(screen.getByText('Tablet')).toBeInTheDocument();
  });

  it('adds a new drug through the drawer', async () => {
    render(<PharmOpsCatalogPanel ajaxUrl="/ajax.php" csrfToken="tok" enabled />);
    await screen.findByText('Paracetamol');

    fireEvent.click(screen.getByRole('button', { name: 'Add drug' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Amoxicillin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save drug' }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'pharm_ops.catalog_save',
        expect.objectContaining({ json: expect.objectContaining({ drug: expect.objectContaining({ name: 'Amoxicillin' }) }) }),
      ),
    );
    expect(await screen.findByText('Amoxicillin')).toBeInTheDocument();
  });

  it('blocks saving a drug with no name', async () => {
    render(<PharmOpsCatalogPanel ajaxUrl="/ajax.php" csrfToken="tok" enabled />);
    await screen.findByText('Paracetamol');
    fireEvent.click(screen.getByRole('button', { name: 'Add drug' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save drug' }));
    expect(await screen.findByText(/Drug name is required/i)).toBeInTheDocument();
  });
});
