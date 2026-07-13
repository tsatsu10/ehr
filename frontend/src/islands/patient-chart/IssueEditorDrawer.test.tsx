import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IssueEditorDrawer } from './IssueEditorDrawer';
import * as oeFetchModule from '@core/oeFetch';

vi.mock('@core/oeFetch');
const mockedFetch = vi.mocked(oeFetchModule.oeFetch);

const baseProps = {
  open: true,
  pid: 42,
  ajaxUrl: '/ajax.php',
  csrfToken: 'tok',
  onClose: vi.fn(),
  onSaved: vi.fn(),
};

describe('IssueEditorDrawer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a new problem and calls onSaved', async () => {
    mockedFetch.mockResolvedValue({ id: 9, type: 'medical_problem', status: 'ok' } as never);
    const onSaved = vi.fn();
    render(<IssueEditorDrawer {...baseProps} type="medical_problem" issueId={0} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Hypertension' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockedFetch).toHaveBeenCalledWith(
        'patients.chart.issue_save',
        expect.objectContaining({
          params: { pid: 42 },
          json: expect.objectContaining({ issue: expect.objectContaining({ id: 0, type: 'medical_problem', title: 'Hypertension' }) }),
        }),
      ),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it('blocks saving without a title', async () => {
    render(<IssueEditorDrawer {...baseProps} type="allergy" issueId={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/A title is required/i)).toBeInTheDocument();
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('loads an existing issue and offers the stock full-editor escape hatch', async () => {
    mockedFetch.mockResolvedValue({
      id: 7, type: 'medical_problem', title: 'Asthma', begdate: '2020-01-01', enddate: '',
      comments: 'note', reaction: '', has_diagnosis_code: true,
      stock_editor_url: '/add_edit_issue.php?issue=7',
    } as never);
    render(<IssueEditorDrawer {...baseProps} type="medical_problem" issueId={7} />);

    expect(await screen.findByDisplayValue('Asthma')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Full editor/i });
    expect(link).toHaveAttribute('href', '/add_edit_issue.php?issue=7');
  });
});
