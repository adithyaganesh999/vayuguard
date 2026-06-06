// AQI Calculator - PM2.5 to AQI conversion for VayuGuard
// Based on US EPA AQI calculation methodology

// PM2.5 breakpoints (µg/m³) and corresponding AQI values
const PM25_BREAKPOINTS = [
  { bpLo: 0.0, bpHi: 12.0, iLo: 0, iHi: 50 },
  { bpLo: 12.1, bpHi: 35.4, iLo: 51, iHi: 100 },
  { bpLo: 35.5, bpHi: 55.4, iLo: 101, iHi: 150 },
  { bpLo: 55.5, bpHi: 150.4, iLo: 151, iHi: 200 },
  { bpLo: 150.5, bpHi: 250.4, iLo: 201, iHi: 300 },
  { bpLo: 250.5, bpHi: 350.4, iLo: 301, iHi: 400 },
  { bpLo: 350.5, bpHi: 500.4, iLo: 401, iHi: 500 },
];

// PM10 breakpoints (µg/m³)
const PM10_BREAKPOINTS = [
  { bpLo: 0, bpHi: 54, iLo: 0, iHi: 50 },
  { bpLo: 55, bpHi: 154, iLo: 51, iHi: 100 },
  { bpLo: 155, bpHi: 254, iLo: 101, iHi: 150 },
  { bpLo: 255, bpHi: 354, iLo: 151, iHi: 200 },
  { bpLo: 355, bpHi: 424, iLo: 201, iHi: 300 },
  { bpLo: 425, bpHi: 504, iLo: 301, iHi: 400 },
  { bpLo: 505, bpHi: 604, iLo: 401, iHi: 500 },
];

// NO2 breakpoints (ppb)
const NO2_BREAKPOINTS = [
  { bpLo: 0, bpHi: 53, iLo: 0, iHi: 50 },
  { bpLo: 54, bpHi: 100, iLo: 51, iHi: 100 },
  { bpLo: 101, bpHi: 360, iLo: 101, iHi: 150 },
  { bpLo: 361, bpHi: 649, iLo: 151, iHi: 200 },
  { bpLo: 650, bpHi: 1249, iLo: 201, iHi: 300 },
  { bpLo: 1250, bpHi: 1649, iLo: 301, iHi: 400 },
  { bpLo: 1650, bpHi: 2049, iLo: 401, iHi: 500 },
];

// O3 breakpoints (ppb)
const O3_BREAKPOINTS = [
  { bpLo: 0, bpHi: 54, iLo: 0, iHi: 50 },
  { bpLo: 55, bpHi: 70, iLo: 51, iHi: 100 },
  { bpLo: 71, bpHi: 85, iLo: 101, iHi: 150 },
  { bpLo: 86, bpHi: 105, iLo: 151, iHi: 200 },
  { bpLo: 106, bpHi: 200, iLo: 201, iHi: 300 },
];

/**
 * Calculate AQI from concentration using the EPA formula
 * AQI = ((Ihi - Ilo) / (BPhi - BPlo)) * (C - BPlo) + Ilo
 */
function calculateAQIFromBreakpoints(concentration, breakpoints) {
  if (concentration === null || concentration === undefined || concentration < 0) return null;

  for (const bp of breakpoints) {
    if (concentration >= bp.bpLo && concentration <= bp.bpHi) {
      return Math.round(
        ((bp.iHi - bp.iLo) / (bp.bpHi - bp.bpLo)) * (concentration - bp.bpLo) + bp.iLo
      );
    }
  }

  // If above max range
  const lastBp = breakpoints[breakpoints.length - 1];
  if (concentration > lastBp.bpHi) {
    return Math.round(
      ((lastBp.iHi - lastBp.iLo) / (lastBp.bpHi - lastBp.bpLo)) * (concentration - lastBp.bpLo) + lastBp.iLo
    );
  }

  return null;
}

/**
 * Convert PM2.5 concentration to AQI
 * @param {number} pm25 - PM2.5 concentration in µg/m³
 * @returns {number} AQI value
 */
export function pm25ToAQI(pm25) {
  return calculateAQIFromBreakpoints(pm25, PM25_BREAKPOINTS);
}

/**
 * Convert PM10 concentration to AQI
 * @param {number} pm10 - PM10 concentration in µg/m³
 * @returns {number} AQI value
 */
export function pm10ToAQI(pm10) {
  return calculateAQIFromBreakpoints(pm10, PM10_BREAKPOINTS);
}

/**
 * Convert NO2 concentration to AQI
 * @param {number} no2 - NO2 concentration in ppb
 * @returns {number} AQI value
 */
export function no2ToAQI(no2) {
  return calculateAQIFromBreakpoints(no2, NO2_BREAKPOINTS);
}

/**
 * Convert O3 concentration to AQI
 * @param {number} o3 - O3 concentration in ppb
 * @returns {number} AQI value
 */
export function o3ToAQI(o3) {
  return calculateAQIFromBreakpoints(o3, O3_BREAKPOINTS);
}

/**
 * Calculate overall AQI from multiple pollutant concentrations
 * The overall AQI is the maximum of the individual sub-indices
 */
export function calculateOverallAQI(pollutants = {}) {
  const { pm25, pm10, no2, o3 } = pollutants;
  const aqis = [];

  if (pm25 !== undefined && pm25 !== null) aqis.push(pm25ToAQI(pm25));
  if (pm10 !== undefined && pm10 !== null) aqis.push(pm10ToAQI(pm10));
  if (no2 !== undefined && no2 !== null) aqis.push(no2ToAQI(no2));
  if (o3 !== undefined && o3 !== null) aqis.push(o3ToAQI(o3));

  if (aqis.length === 0) return null;

  return Math.max(...aqis.filter((v) => v !== null));
}

/**
 * Get the dominant pollutant (the one with highest sub-index)
 */
export function getDominantPollutant(pollutants = {}) {
  const subIndices = {
    pm25: pollutants.pm25 ? pm25ToAQI(pollutants.pm25) : null,
    pm10: pollutants.pm10 ? pm10ToAQI(pollutants.pm10) : null,
    no2: pollutants.no2 ? no2ToAQI(pollutants.no2) : null,
    o3: pollutants.o3 ? o3ToAQI(pollutants.o3) : null,
  };

  let dominant = null;
  let maxAQI = -1;

  for (const [key, aqi] of Object.entries(subIndices)) {
    if (aqi !== null && aqi > maxAQI) {
      maxAQI = aqi;
      dominant = key;
    }
  }

  return dominant;
}

export default {
  pm25ToAQI,
  pm10ToAQI,
  no2ToAQI,
  o3ToAQI,
  calculateOverallAQI,
  getDominantPollutant,
};
