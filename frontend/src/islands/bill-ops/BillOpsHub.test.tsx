import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BillOpsHub } from './BillOpsHub';

vi.mock('@core/oeFetch', () => ({
  oeFetch: vi.fn().mockResolvedValue({ rows: [], currency_symbol: 'GH₵' }),
}));

const baseProps = {
  ajaxUrl: '/ajax.php',
  csrfToken: 'token',
  moduleUrl: '/module/public',
  cashierUrl: '/cashier',
  reportsUrl: '/reports',
  visitBoardUrl: '/visit-board',
  facilityId: 1,
  initialTab: 'corrections',
  canCorrect: true,
  canPayment: true,
  canClose: true,
  canOutstanding: false,
  canInsurance: false,
  canShowAdvanced: false,
  reopenOnCorrection: false,
  webroot: '/openemr',
};

describe('BillOpsHub', () => {
  it('renders corrections tab by default', () => {
    render(<BillOpsHub {...baseProps} />);
    expect(screen.getByPlaceholderText('Visit id')).toBeInTheDocument();
  });

  it('shows payments search when initial tab is payments', () => {
    render(<BillOpsHub {...baseProps} initialTab="payments" />);
    expect(screen.getByPlaceholderText('Receipt # / MRN / name')).toBeInTheDocument();
  });
});
