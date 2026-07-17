import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoctorDutyToggle } from './DoctorDutyToggle';

describe('DoctorDutyToggle', () => {
  it('shows "Taking patients" and calls onToggle(false) when currently taking', () => {
    const onToggle = vi.fn();
    render(<DoctorDutyToggle taking saving={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /Taking patients/ });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('shows "Paused" and calls onToggle(true) when currently not taking', () => {
    const onToggle = vi.fn();
    render(<DoctorDutyToggle taking={false} saving={false} onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /Paused/ });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('disables the button while saving', () => {
    render(<DoctorDutyToggle taking saving onToggle={vi.fn()} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
