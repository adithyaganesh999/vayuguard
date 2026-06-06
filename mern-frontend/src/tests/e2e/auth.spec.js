// E2E Auth tests for VayuGuard
// Using Playwright-style syntax

describe('Authentication Flow', () => {
  beforeEach(async () => {
    await page.goto('/');
  });

  test('should display landing page', async () => {
    const title = await page.textContent('h1');
    expect(title).toBeTruthy();
  });

  test('should navigate to login page', async () => {
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="login-form"]');
    const loginForm = await page.isVisible('[data-testid="login-form"]');
    expect(loginForm).toBe(true);
  });

  test('should show error on invalid login', async () => {
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');

    // Should show error message
    const errorVisible = await page.isVisible('[data-testid="error-message"]');
    expect(errorVisible).toBe(true);
  });

  test('should login successfully with valid credentials', async () => {
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Should redirect to dashboard
    await page.waitForURL('**/dashboard');
    const dashboardVisible = await page.isVisible('[data-testid="dashboard"]');
    expect(dashboardVisible).toBe(true);
  });

  test('should navigate to signup page', async () => {
    await page.click('[data-testid="signup-link"]');
    await page.waitForSelector('[data-testid="signup-form"]');
    const signupForm = await page.isVisible('[data-testid="signup-form"]');
    expect(signupForm).toBe(true);
  });

  test('should register a new user', async () => {
    await page.click('[data-testid="signup-link"]');
    await page.fill('[data-testid="name-input"]', 'Test User');
    await page.fill('[data-testid="email-input"]', 'newuser@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="signup-button"]');

    await page.waitForURL('**/dashboard');
    const dashboardVisible = await page.isVisible('[data-testid="dashboard"]');
    expect(dashboardVisible).toBe(true);
  });

  test('should logout successfully', async () => {
    // Login first
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    await page.waitForURL('**/');

    const landingVisible = await page.isVisible('[data-testid="landing-page"]');
    expect(landingVisible).toBe(true);
  });
});
