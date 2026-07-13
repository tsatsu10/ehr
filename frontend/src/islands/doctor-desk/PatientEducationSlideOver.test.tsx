import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientEducationSlideOver } from './PatientEducationSlideOver';

const resources = [
  { title: 'MedlinePlus', url: 'https://medlineplus.gov/search?query=[%]' },
  { title: 'WHO', url: 'https://www.who.int/search?q=[%]' },
];

describe('PatientEducationSlideOver', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });
  afterEach(() => {
    openSpy.mockRestore();
  });

  it('opens the selected resource with the term injected at [%]', () => {
    render(<PatientEducationSlideOver open onClose={vi.fn()} resources={resources} />);

    fireEvent.change(screen.getByLabelText('Condition or topic'), { target: { value: 'hypertension' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open handout' }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://medlineplus.gov/search?query=hypertension',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('url-encodes the search term', () => {
    render(<PatientEducationSlideOver open onClose={vi.fn()} resources={resources} />);
    fireEvent.change(screen.getByLabelText('Condition or topic'), { target: { value: 'chest pain' } });
    fireEvent.change(screen.getByLabelText('Resource'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open handout' }));
    expect(openSpy).toHaveBeenCalledWith('https://www.who.int/search?q=chest%20pain', '_blank', 'noopener,noreferrer');
  });

  it('disables Open handout until a term is entered', () => {
    render(<PatientEducationSlideOver open onClose={vi.fn()} resources={resources} />);
    expect(screen.getByRole('button', { name: 'Open handout' })).toBeDisabled();
  });

  it('shows a config hint when there are no resources', () => {
    render(<PatientEducationSlideOver open onClose={vi.fn()} resources={[]} />);
    expect(screen.getByText(/No education resources are configured/i)).toBeInTheDocument();
  });

  it('refuses to open a non-http(s) (e.g. javascript:) resource URL', () => {
    render(
      <PatientEducationSlideOver
        open
        onClose={vi.fn()}
        resources={[{ title: 'Bad', url: 'javascript:alert(1)//[%]' }]}
      />
    );
    fireEvent.change(screen.getByLabelText('Condition or topic'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Open handout' }));
    expect(openSpy).not.toHaveBeenCalled();
  });
});
