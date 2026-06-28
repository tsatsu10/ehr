import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisitBoardHello } from './VisitBoardHello';

describe('VisitBoardHello', () => {
  it('renders the default label when no prop is given', () => {
    render(<VisitBoardHello />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveTextContent('React island OK — Phase 0');
    expect(badge).toHaveClass('oe-island-hello');
  });

  it('renders a custom label when provided', () => {
    render(<VisitBoardHello label="Visit Board" />);
    expect(screen.getByRole('status')).toHaveTextContent('React island OK — Visit Board');
  });

  it('renders the green dot element', () => {
    render(<VisitBoardHello />);
    const dot = document.querySelector('.oe-island-hello__dot');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('aria-hidden', 'true');
  });
});
