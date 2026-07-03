import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { CompletionWeightsEditor } from './CompletionWeightsEditor';

const payload = {
  items: [
    {
      field_key: 'fname',
      level: 1,
      level_label: 'Basic info',
      label: 'First name',
      weight: 50,
      is_active: true,
    },
    {
      field_key: 'lname',
      level: 1,
      level_label: 'Basic info',
      label: 'Last name',
      weight: 50,
      is_active: true,
    },
  ],
  active_total: 100,
  target_total: 100,
};

describe('CompletionWeightsEditor', () => {
  it('disables save until total is 100 and shows live total', () => {
    const onSave = vi.fn();

    render(
      <CompletionWeightsEditor payload={payload} saving={false} error={null} onSave={onSave} />
    );

    expect(screen.getByText('Active total: 100 / 100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save weights/i })).toBeDisabled();

    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '40' } });

    expect(screen.getByText('Active total: 90 / 100')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save weights/i })).toBeDisabled();
  });
});
