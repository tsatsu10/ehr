import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { QuickAddRegistration } from './QuickAddRegistration';

vi.mock('@core/oeFetch', () => ({
    oeFetch: vi.fn(),
    OeFetchError: class OeFetchError extends Error {
        status: number;
        code: string;
        constructor(message: string, status: number, code: string) {
            super(message);
            this.status = status;
            this.code = code;
        }
    },
}));

import { oeFetch } from '@core/oeFetch';

const mockFetch = oeFetch as ReturnType<typeof vi.fn>;

describe('QuickAddRegistration', () => {
    const props = {
        ajaxUrl: '/mock/ajax',
        csrfToken: 'test-token',
        onSaved: vi.fn(),
        onUseExisting: vi.fn(),
        onCancel: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockImplementation(async (action: string) => {
            if (action === 'patients.dup_check') {
                return { level: 'none', candidates: [] };
            }
            if (action === 'patients.create') {
                return { pid: 77 };
            }
            return {};
        });
    });

    it('renders quick add title', () => {
        render(<QuickAddRegistration {...props} />);
        expect(screen.getByRole('heading', { name: /Quick Add patient/i })).toBeInTheDocument();
    });

    it('hides title when hideTitle is set', () => {
        render(<QuickAddRegistration {...props} hideTitle />);
        expect(screen.queryByRole('heading', { name: /Quick Add patient/i })).not.toBeInTheDocument();
    });

    it('does not dup-check until meaningful input', async () => {
        render(<QuickAddRegistration {...props} />);
        expect(mockFetch).not.toHaveBeenCalledWith('patients.dup_check', expect.anything());

        fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'Ama' } });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                'patients.dup_check',
                expect.objectContaining({ method: 'POST' }),
            );
        });
    });

    it('calls onSaved with startAfter on save and start visit', async () => {
        render(<QuickAddRegistration {...props} />);
        fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'Ama' } });
        fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Mensah' } });
        fireEvent.change(screen.getByLabelText(/Sex/i), { target: { value: 'Female' } });
        fireEvent.change(screen.getByLabelText(/Or age \(years\)/i), { target: { value: '30' } });

        fireEvent.click(screen.getByRole('button', { name: /Save and Start visit/i }));

        await waitFor(() => {
            expect(props.onSaved).toHaveBeenCalledWith(77, true);
        });
    });
});
