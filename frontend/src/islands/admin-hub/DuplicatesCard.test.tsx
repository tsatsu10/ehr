import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DuplicatesCard } from './DuplicatesCard';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

describe('DuplicatesCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing and never fetches when the feature is disabled', () => {
    const { container } = render(<DuplicatesCard ajaxUrl="/ajax.php" csrfToken="tok" enabled={false} />);
    expect(container).toBeEmptyDOMElement();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('lists duplicate pairs with a merge deep link and a super-admin note when enabled', async () => {
    mockedFetch.mockResolvedValue({
      enabled: true,
      capped: false,
      merge_base_url: '/base/admin-merge-legacy.php',
      pairs: [
        { pid_a: 5, name_a: 'Ama Mensah', pubpid_a: 'P5', pid_b: 9, name_b: 'Ama Mensah', pubpid_b: 'P9', dob: '1990-01-01', reason: 'Same name and date of birth' },
      ],
    } as never);

    render(<DuplicatesCard ajaxUrl="/ajax.php" csrfToken="tok" enabled />);

    expect(await screen.findByText(/1 possible duplicate pair found/i)).toBeInTheDocument();
    expect(screen.getByText('Same name and date of birth')).toBeInTheDocument();
    expect(screen.getByText(/requires super-admin access/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Review & merge/i });
    expect(link).toHaveAttribute('href', '/base/admin-merge-legacy.php?pid1=5&pid2=9');
  });
});
