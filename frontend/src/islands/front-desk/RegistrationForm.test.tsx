import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { RegistrationForm } from './RegistrationForm';

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

describe('RegistrationForm', () => {
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
            if (action === 'admin.geo.regions') {
                return { regions: [] };
            }
            if (action === 'patients.dup_check') {
                return { level: 'none', candidates: [] };
            }
            return {};
        });
    });

    it('renders register patient title', () => {
        render(<RegistrationForm {...props} />);
        expect(screen.getByRole('heading', { name: /Register patient/i })).toBeInTheDocument();
    });

    it('hides title when hideTitle is set', () => {
        render(<RegistrationForm {...props} hideTitle />);
        expect(screen.queryByRole('heading', { name: /Register patient/i })).not.toBeInTheDocument();
        expect(document.getElementById('nc-reg-completion')).toBeInTheDocument();
    });

    it('shows section 1 content by default', () => {
        render(<RegistrationForm {...props} />);
        expect(screen.getByLabelText(/First name/i)).toBeInTheDocument();
    });

    it('switches accordion sections in react state', () => {
        render(<RegistrationForm {...props} />);
        expect(document.getElementById('nc-reg-section-1')).toHaveAttribute('data-state', 'open');
        expect(document.getElementById('nc-reg-section-2')).toHaveAttribute('data-state', 'closed');

        fireEvent.click(screen.getByText(/Contact & identity/i));
        expect(document.getElementById('nc-reg-section-2')).toHaveAttribute('data-state', 'open');
        expect(document.getElementById('nc-reg-section-1')).toHaveAttribute('data-state', 'closed');
    });

    it('switches accordion sections when editing existing patient', async () => {
        mockFetch.mockImplementation(async (action: string) => {
            if (action === 'admin.geo.regions') return { regions: [] };
            if (action === 'patients.registration.get') {
                return {
                    section_1: { fname: 'Ada', lname: 'Mensah' },
                    completion: { score: 60, missing: [] },
                };
            }
            return {};
        });

        render(<RegistrationForm {...props} pid={42} />);
        await waitFor(() => {
            expect(document.getElementById('nc-reg-section-1')).toHaveAttribute('data-state', 'open');
        });
        expect(document.getElementById('nc-reg-section-2')).toHaveAttribute('data-state', 'closed');

        fireEvent.click(screen.getByText(/Contact & identity/i));
        expect(document.getElementById('nc-reg-section-2')).toHaveAttribute('data-state', 'open');
        expect(document.getElementById('nc-reg-section-1')).toHaveAttribute('data-state', 'closed');
    });

    it('does not show dup panel until meaningful input', async () => {
        render(<RegistrationForm {...props} />);
        expect(screen.queryByText(/Possible duplicate/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Likely match found/i)).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'Kwame' } });

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith(
                'patients.dup_check',
                expect.objectContaining({ method: 'POST' }),
            );
        });
    });

    it('shows dup warn panel and requires confirm before save', async () => {
        mockFetch.mockImplementation(async (action: string) => {
            if (action === 'admin.geo.regions') return { regions: [] };
            if (action === 'patients.dup_check') {
                return {
                    level: 'warn',
                    candidates: [{ pid: 9, display_name: 'Kwame A', pubpid: 'MRN9', score: 85 }],
                };
            }
            return {};
        });

        render(<RegistrationForm {...props} wizardMode />);
        fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'Kwame' } });

        await waitFor(() => {
            expect(screen.getByText(/Possible duplicate/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
        expect(await screen.findByText(/Confirm this is a different patient/i)).toBeInTheDocument();
    });

    it('calls onSaved with startAfter when Save & Start visit succeeds', async () => {
        mockFetch.mockImplementation(async (action: string) => {
            if (action === 'admin.geo.regions') return { regions: [] };
            if (action === 'patients.dup_check') return { level: 'none', candidates: [] };
            if (action === 'patients.create') {
                return { pid: 55, completion_score: 40, completion_missing: ['street'] };
            }
            if (action === 'patients.registration.get') {
                return {
                    section_1: { fname: 'Kwame', lname: 'Boateng' },
                    completion: { score: 40, missing: ['street'] },
                };
            }
            return {};
        });

        render(<RegistrationForm {...props} registrationMode="desk_full_form" wizardMode />);
        fireEvent.change(screen.getByLabelText(/First name/i), { target: { value: 'Kwame' } });
        fireEvent.change(screen.getByLabelText(/Last name/i), { target: { value: 'Boateng' } });

        fireEvent.click(screen.getByRole('button', { name: /Save & Start visit/i }));

        await waitFor(() => {
            expect(props.onSaved).toHaveBeenCalledWith(55, true);
        });
    });

    it('calls onCancel when cancel clicked', () => {
        render(<RegistrationForm {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
        expect(props.onCancel).toHaveBeenCalledTimes(1);
    });
});
