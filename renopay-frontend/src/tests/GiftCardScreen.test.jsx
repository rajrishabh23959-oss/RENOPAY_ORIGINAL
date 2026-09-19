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

vi.mock('../components/PINPad', () => ({
  PINPad: ({ onComplete }) => (
    <div data-testid="pin-pad">
      <button onClick={() => onComplete('123456')}>Submit PIN</button>
    </div>
  ),
}));

describe('GiftCardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders gift card creation tab with amount and generate button by default', () => {
    render(<GiftCardScreen onBack={() => {}} />);
    expect(screen.getAllByText('RenoPay Gift Card')[0]).toBeInTheDocument();
    expect(screen.getByText(/Generate Gift Card/i)).toBeInTheDocument();
  });

  it('switches to claim tab and allows entering a gift card code', async () => {
    render(<GiftCardScreen onBack={() => {}} />);
    
    fireEvent.click(screen.getByText('Claim'));
    expect(screen.getByText('Redeem RenoPay Gift Card')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('RENO-GIFT-XXXX-XXXX')).toBeInTheDocument();
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

    const input = screen.getByPlaceholderText('RENO-GIFT-XXXX-XXXX');
    fireEvent.change(input, { target: { value: 'RENO-GIFT-ABCD-1234' } });
    fireEvent.click(screen.getByText('Claim to Account Balance'));

    await waitFor(() => {
      expect(GiftCardAPI.claim).toHaveBeenCalledWith('RENO-GIFT-ABCD-1234');
      expect(screen.getByText('Gift Card Claimed!')).toBeInTheDocument();
      expect(screen.getByText(/₹500 Credited Successfully/i)).toBeInTheDocument();
    });
  });
});
