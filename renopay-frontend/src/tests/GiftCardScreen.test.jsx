import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GiftCardScreen } from '../screens/GiftCardScreen';
import { GiftCardAPI } from '../lib/api';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      full_name: 'Test User',
      account: { balance: 5000 },
    },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('../lib/api', () => ({
  GiftCardAPI: {
    create: vi.fn(),
    claim: vi.fn(),
    myCards: vi.fn().mockResolvedValue({ created: [], claimed: [] }),
    downloadPdf: vi.fn(),
  },
}));

vi.mock('../components/PaymentMethodModal', () => ({
  PaymentMethodModal: ({ isOpen, onConfirm }) => (
    isOpen ? (
      <div data-testid="payment-method-modal">
        <button onClick={() => onConfirm('123456', 'advance')}>Confirm Advance Pay</button>
        <button onClick={() => onConfirm('123456', 'normal')}>Confirm Normal Pay</button>
      </div>
    ) : null
  ),
}));

describe('GiftCardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders gift card creation tab with amount, recipient input and proceed button by default', () => {
    render(<GiftCardScreen onBack={() => {}} />);
    expect(screen.getAllByText('RenoPay Gift Card')[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter Recipient Name/i)).toBeInTheDocument();
    expect(screen.getByText(/Proceed to Pay/i)).toBeInTheDocument();
  });

  it('switches to claim tab and allows entering a gift card code', async () => {
    render(<GiftCardScreen onBack={() => {}} />);
    
    fireEvent.click(screen.getByText('Claim'));
    expect(screen.getAllByText('Claim Gift Card')[0]).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/RENO-GIFT/i)).toBeInTheDocument();
  });

  it('claims a gift card successfully', async () => {
    GiftCardAPI.claim.mockResolvedValueOnce({
      success: true,
      amount: 500,
      card_code: 'RENO-GIFT-ABCD-1234',
      message: '₹500.00 successfully credited to your RenoPay wallet balance!',
      new_balance: 5500,
      claimed_at: new Date().toISOString(),
    });

    render(<GiftCardScreen onBack={() => {}} />);
    fireEvent.click(screen.getByText('Claim'));

    const input = screen.getByPlaceholderText(/RENO-GIFT/i);
    fireEvent.change(input, { target: { value: 'RENO-GIFT-ABCD-1234' } });
    fireEvent.click(screen.getByRole('button', { name: /^Claim Gift Card$/i }));

    await waitFor(() => {
      expect(GiftCardAPI.claim).toHaveBeenCalledWith('RENO-GIFT-ABCD-1234');
      expect(screen.getByText('Gift Card Claimed!')).toBeInTheDocument();
      expect(screen.getByText(/₹500 added to your account!/i)).toBeInTheDocument();
    });
  });

  it('opens PaymentMethodModal with NoteSlider on proceed to pay', async () => {
    render(<GiftCardScreen onBack={() => {}} />);
    fireEvent.click(screen.getByText(/Proceed to Pay/i));

    expect(screen.getByTestId('payment-method-modal')).toBeInTheDocument();
  });
});
