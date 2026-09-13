import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginScreen } from '../screens/LoginScreen';
import { AuthContext } from '../context/AuthContext';
import { AuthAPI } from '../lib/api';

vi.mock('../lib/api', () => ({
  AuthAPI: {
    register: vi.fn(),
    setPin: vi.fn(),
  },
}));

describe('LoginScreen', () => {
  const mockLogin = vi.fn();
  const mockRefreshProfile = vi.fn();
  const mockOnDone = vi.fn();

  const renderWithAuth = (component) => {
    return render(
      <AuthContext.Provider value={{ login: mockLogin, refreshProfile: mockRefreshProfile }}>
        {component}
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders registration mode when initialMode is register', () => {
    renderWithAuth(<LoginScreen onDone={mockOnDone} initialMode="register" />);
    expect(screen.getByText('Welcome to RenoPay')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Full Name')).toBeInTheDocument();
  });

  it('switches to login mode when clicking login link', () => {
    renderWithAuth(<LoginScreen onDone={mockOnDone} initialMode="register" />);
    fireEvent.click(screen.getByText('Already have an account? Log in →'));
    
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Phone Number')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('6-digit PIN (optional)')).toBeInTheDocument();
  });

  it('calls login context method and onDone on successful login', async () => {
    mockLogin.mockResolvedValueOnce();

    renderWithAuth(<LoginScreen onDone={mockOnDone} />);
    
    fireEvent.change(screen.getByPlaceholderText('Phone Number'), { target: { value: '9999999999' } });
    fireEvent.change(screen.getByPlaceholderText('6-digit PIN (optional)'), { target: { value: '123456' } });
    
    fireEvent.click(screen.getByText('Log In →'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('9999999999', '123456');
      expect(mockOnDone).toHaveBeenCalled();
    });
  });

  it('displays error on login failure', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { detail: 'Invalid credentials' } } });

    renderWithAuth(<LoginScreen onDone={mockOnDone} />);
    
    fireEvent.change(screen.getByPlaceholderText('Phone Number'), { target: { value: '9999999999' } });
    fireEvent.change(screen.getByPlaceholderText('6-digit PIN (optional)'), { target: { value: '123456' } });
    
    fireEvent.click(screen.getByText('Log In →'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(mockOnDone).not.toHaveBeenCalled();
    });
  });

  it('submits registration directly without OTP step', async () => {
    const mockRegister = vi.fn().mockResolvedValueOnce();
    render(
      <AuthContext.Provider value={{ login: mockLogin, register: mockRegister, refreshProfile: mockRefreshProfile }}>
        <LoginScreen onDone={mockOnDone} initialMode="register" />
      </AuthContext.Provider>
    );

    fireEvent.change(screen.getByPlaceholderText('Full Name'), { target: { value: 'Test User' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Phone Number'), { target: { value: '9876543210' } });

    fireEvent.click(screen.getByText('Continue →'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        full_name: 'Test User',
        phone_number: '9876543210',
        email: 'test@example.com',
        pan_number: null,
        aadhaar_number: null,
      });
      expect(mockOnDone).toHaveBeenCalled();
    });
  });
});
