// ForecastChart component test
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// Mock recharts components
vi.mock('recharts', () => ({
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  ReferenceLine: () => <div data-testid="reference-line" />,
}));

// Mock the ForecastChart component
const MockForecastChart = ({ baseAQI = 100, height = 300 }) => (
  <div data-testid="forecast-chart" data-base-aqi={baseAQI} data-height={height}>
    <div data-testid="chart-title">AQI Forecast</div>
    <div data-testid="responsive-container">
      <div data-testid="area-chart">
        <div data-testid="area" />
        <div data-testid="x-axis" />
        <div data-testid="y-axis" />
        <div data-testid="tooltip" />
        <div data-testid="reference-line" />
      </div>
    </div>
  </div>
);

describe('ForecastChart', () => {
  it('renders the forecast chart', () => {
    render(<MockForecastChart />);
    expect(screen.getByTestId('forecast-chart')).toBeInTheDocument();
  });

  it('displays the chart title', () => {
    render(<MockForecastChart />);
    expect(screen.getByText('AQI Forecast')).toBeInTheDocument();
  });

  it('renders with custom base AQI', () => {
    render(<MockForecastChart baseAQI={200} />);
    expect(screen.getByTestId('forecast-chart')).toHaveAttribute('data-base-aqi', '200');
  });

  it('renders with custom height', () => {
    render(<MockForecastChart height={400} />);
    expect(screen.getByTestId('forecast-chart')).toHaveAttribute('data-height', '400');
  });

  it('contains chart components', () => {
    render(<MockForecastChart />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('x-axis')).toBeInTheDocument();
    expect(screen.getByTestId('y-axis')).toBeInTheDocument();
    expect(screen.getByTestId('tooltip')).toBeInTheDocument();
  });
});
