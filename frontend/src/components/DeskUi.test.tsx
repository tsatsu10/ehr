import { render, screen } from '@testing-library/react';
import { FlaskConical } from 'lucide-react';
import { createDeskUi } from './DeskUi';

const labUi = createDeskUi({
  prefix: 'lab',
  queueAriaLabel: 'Lab queue',
  stickyFooterAriaLabel: 'Lab actions',
  emptyIcon: FlaskConical,
  emptyMessage: 'Choose a patient from the lab queue to start work.',
  loadingMessage: 'Loading visit…',
});

describe('createDeskUi', () => {
  it('renders desk layout with nc-lab BEM class names', () => {
    const { container } = render(
      <labUi.DeskLayout activePane={<div>Active</div>} queue={<div>Queue</div>} />,
    );

    expect(container.querySelector('.nc-lab-desk-layout')).toBeTruthy();
    expect(container.querySelector('.nc-lab-desk-layout__active')).toBeTruthy();
    expect(container.querySelector('.nc-lab-desk-layout__queue')).toBeTruthy();
    expect(screen.getByLabelText('Lab queue')).toBeTruthy();
  });

  it('renders active empty state with default pane id', () => {
    render(<labUi.ActiveEmpty />);

    const pane = document.getElementById('nc-lab-active-pane');
    expect(pane).toBeTruthy();
    expect(pane?.className).toContain('nc-lab-active-shell');
    expect(screen.getByText('No patient selected')).toBeTruthy();
  });

  it('renders queue panel count with configured aria label', () => {
    render(
      <labUi.QueuePanel title="Waiting" count={3}>
        <div>Cards</div>
      </labUi.QueuePanel>,
    );

    expect(screen.getByLabelText('3 in queue')).toHaveTextContent('3');
    expect(document.querySelector('.nc-lab-queue-panel__title')).toHaveTextContent('Waiting');
  });
});
