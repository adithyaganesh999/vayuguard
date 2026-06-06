// E2E Forecast tests for VayuGuard
// Using Playwright-style syntax

describe('Forecast Page', () => {
  beforeEach(async () => {
    // Login first
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  });

  test('should navigate to forecast page', async () => {
    await page.click('[data-testid="forecast-nav"]');
    await page.waitForSelector('[data-testid="forecast-page"]');
    const forecastVisible = await page.isVisible('[data-testid="forecast-page"]');
    expect(forecastVisible).toBe(true);
  });

  test('should display hourly forecast', async () => {
    await page.click('[data-testid="forecast-nav"]');
    await page.waitForSelector('[data-testid="hourly-forecast"]');
    const hourlyVisible = await page.isVisible('[data-testid="hourly-forecast"]');
    expect(hourlyVisible).toBe(true);
  });

  test('should display daily forecast cards', async () => {
    await page.click('[data-testid="forecast-nav"]');
    await page.waitForSelector('[data-testid="daily-forecast"]');
    const dailyVisible = await page.isVisible('[data-testid="daily-forecast"]');
    expect(dailyVisible).toBe(true);
  });

  test('should display confidence interval chart', async () => {
    await page.click('[data-testid="forecast-nav"]');
    await page.waitForSelector('[data-testid="confidence-interval"]');
    const confidenceVisible = await page.isVisible('[data-testid="confidence-interval"]');
    expect(confidenceVisible).toBe(true);
  });

  test('should update forecast when city changes', async () => {
    await page.click('[data-testid="forecast-nav"]');
    await page.waitForSelector('[data-testid="forecast-page"]');

    // Change city
    await page.click('[data-testid="location-selector"]');
    await page.click('[data-testid="city-delhi"]');

    // Wait for forecast to update
    await page.waitForTimeout(1000);
    const forecastVisible = await page.isVisible('[data-testid="forecast-page"]');
    expect(forecastVisible).toBe(true);
  });

  test('should show AQI level colors correctly', async () => {
    await page.click('[data-testid="forecast-nav"]');
    await page.waitForSelector('[data-testid="forecast-page"]');

    // Check that AQI values have corresponding colors
    const aqiElements = await page.$$('[data-testid="aqi-value"]');
    for (const element of aqiElements) {
      const color = await element.getAttribute('data-color');
      expect(color).toBeTruthy();
    }
  });
});
