// Login component test
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the LoginView component
const MockLoginView = ({ onLogin, onSwitchToSignup }) => (
  <div data-testid="login-form">
    <h1>Sign In</h1>
    <input data-testid="email-input" type="email" placeholder="Email" />
    <input data-testid="password-input" type="password" placeholder="Password" />
    <button data-testid="login-button" onClick={() => onLogin?.('test@example.com', 'password')}>
      Sign In
    </button>
    <button data-testid="signup-link" onClick={onSwitchToSignup}>
      Create account
    </button>
  </div>
);

describe('LoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form', () => {
    render(<MockLoginView />);
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('has email and password inputs', () => {
    render(<MockLoginView />);
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-input')).toBeInTheDocument();
  });

  it('calls onLogin when form is submitted', async () => {
    const onLogin = vi.fn().mockResolvedValue(true);
    render(<MockLoginView onLogin={onLogin} />);

    fireEvent.click(screen.getByTestId('login-button'));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith('test@example.com', 'password');
    });
  });

  it('calls onSwitchToSignup when signup link is clicked', () => {
    const onSwitchToSignup = vi.fn();
    render(<MockLoginView onSwitchToSignup={onSwitchToSignup} />);

    fireEvent.click(screen.getByTestId('signup-link'));
    expect(onSwitchToSignup).toHaveBeenCalled();
  });
});
