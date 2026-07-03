import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunbooksBoard } from './RunbooksBoard';
import type { RunbooksPayload } from './adminTypes';

const runbooks: RunbooksPayload = {
  source: 'test',
  cards: [
    {
      id: 'RB-01',
      when: 'Day 2',
      task: 'Verify backup ran',
      lens: 'System',
      summary: 'Check backup health.',
      deep_link: '/admin?tab=system',
      search_text: 'rb-01 day 2 verify backup ran system check backup health.',
    },
    {
      id: 'RB-05',
      when: 'Any',
      task: 'Add new receptionist',
      lens: 'People',
      summary: 'Reception template.',
      deep_link: '/users',
      search_text: 'rb-05 any add new receptionist people reception template.',
    },
  ],
};

describe('RunbooksBoard', () => {
  it('filters runbooks by search query', () => {
    render(<RunbooksBoard runbooks={runbooks} />);

    expect(screen.getByText('Verify backup ran')).toBeInTheDocument();
    expect(screen.getByText('Add new receptionist')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Search runbooks/i), {
      target: { value: 'receptionist' },
    });

    expect(screen.queryByText('Verify backup ran')).not.toBeInTheDocument();
    expect(screen.getByText('Add new receptionist')).toBeInTheDocument();
  });
});
