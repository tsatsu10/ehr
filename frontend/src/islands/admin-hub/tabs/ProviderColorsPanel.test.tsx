import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ProviderColorsPanel } from './ProviderColorsPanel';

const oeFetchMock = vi.fn();
vi.mock('@core/oeFetch', () => ({
  oeFetch: (...args: unknown[]) => oeFetchMock(...args),
}));

const payload = {
  facility_id: 3,
  providers: [
    { id: 10, label: 'Smith, Jane', color: '#0071e3', is_custom: false, default_color: '#0071e3' },
    { id: 11, label: 'Owusu, Kofi', color: '#ff6a00', is_custom: true, default_color: '#2bb350' },
  ],
};

beforeEach(() => {
  oeFetchMock.mockReset();
  oeFetchMock.mockResolvedValue(payload);
});

describe('ProviderColorsPanel', () => {
  it('renders one color swatch per provider with reset only for custom picks', async () => {
    render(
      <ProviderColorsPanel ajaxUrl="/mock/ajax" csrfToken="token" facilityId={3} schedulingEnabled />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Color for Smith, Jane')).toBeInTheDocument();
    });
    expect(screen.getByLabelText<HTMLInputElement>('Color for Owusu, Kofi').value).toBe('#ff6a00');
    // Custom provider offers Reset; default one shows the "Default" tag.
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('saves the color map', async () => {
    render(
      <ProviderColorsPanel ajaxUrl="/mock/ajax" csrfToken="token" facilityId={3} schedulingEnabled />,
    );
    await screen.findByLabelText('Color for Smith, Jane');

    fireEvent.click(screen.getByRole('button', { name: /save provider colors/i }));

    await waitFor(() => {
      expect(oeFetchMock).toHaveBeenCalledWith('scheduling.provider_colors.save', expect.objectContaining({
        method: 'POST',
        json: expect.objectContaining({ facility_id: 3, colors: { 10: '#0071e3', 11: '#ff6a00' } }),
      }));
    });
  });

  it('renders nothing when scheduling is disabled', () => {
    const { container } = render(
      <ProviderColorsPanel ajaxUrl="/mock/ajax" csrfToken="token" facilityId={3} schedulingEnabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
