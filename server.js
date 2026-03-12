const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 4001;

// --- Spot data ---
const SPOTS = [
  { name: "Oceanside Harbor", id: "5842041f4e65fad6a7708832", lat: 33.204, lon: -117.396 },
  { name: "Oceanside Pier", id: "584204204e65fad6a7709435", lat: 33.193, lon: -117.387 },
  { name: "Tamarack", id: "5842041f4e65fad6a7708837", lat: 33.147, lon: -117.347 },
  { name: "Terra Mar", id: "5842041f4e65fad6a77088a6", lat: 33.129, lon: -117.336 },
  { name: "Ponto", id: "5842041f4e65fad6a77088a5", lat: 33.087, lon: -117.314 },
  { name: "Grandview", id: "5842041f4e65fad6a770889f", lat: 33.075, lon: -117.311 },
  { name: "Beacons", id: "5842041f4e65fad6a77088a0", lat: 33.064, lon: -117.306 },
  { name: "D Street", id: "5842041f4e65fad6a77088b7", lat: 33.045, lon: -117.298 },
  { name: "Swamis", id: "5842041f4e65fad6a77088b4", lat: 33.034, lon: -117.296 },
  { name: "Pipes", id: "5c008f5313603c0001df5318", lat: 33.025, lon: -117.289 },
  { name: "Cardiff Reef", id: "5842041f4e65fad6a77088b1", lat: 33.015, lon: -117.283 },
  { name: "Seaside Reef", id: "5842041f4e65fad6a77088b3", lat: 33.002, lon: -117.280 },
  { name: "Del Mar Rivermouth", id: "5842041f4e65fad6a77088b0", lat: 32.975, lon: -117.271 },
  { name: "15th Street Del Mar", id: "5842041f4e65fad6a77088af", lat: 32.959, lon: -117.269 }
];

// --- Cache ---
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// --- HTTP fetch ---
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'EncinitasSurf/1.0' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchJSON(url) {
  const body = await fetchUrl(url);
  return JSON.parse(body);
}

// --- Surf Rating Algorithm ---
function calculateRating(waveHeightFt, periodSec, windSpeedKts, windDir) {
  if (waveHeightFt == null || waveHeightFt < 0.5) return 0;

  let heightScore = 0;
  if (waveHeightFt >= 1 && waveHeightFt < 2) heightScore = 0.5;
  else if (waveHeightFt >= 2 && waveHeightFt < 3) heightScore = 1;
  else if (waveHeightFt >= 3 && waveHeightFt < 4) heightScore = 1.5;
  else if (waveHeightFt >= 4 && waveHeightFt < 6) heightScore = 2;
  else if (waveHeightFt >= 6 && waveHeightFt < 8) heightScore = 2.5;
  else if (waveHeightFt >= 8) heightScore = 3;

  let periodScore = 0;
  if (periodSec != null) {
    if (periodSec >= 8 && periodSec < 10) periodScore = 0.5;
    else if (periodSec >= 10 && periodSec < 13) periodScore = 1;
    else if (periodSec >= 13 && periodSec < 16) periodScore = 1.5;
    else if (periodSec >= 16) periodScore = 2;
  }

  let windPenalty = 0;
  if (windSpeedKts != null && windSpeedKts > 5) {
    const isOnshore = windDir != null && (windDir >= 180 && windDir <= 320);
    const isSideshore = windDir != null && ((windDir >= 140 && windDir < 180) || (windDir > 320 && windDir <= 360));

    if (isOnshore) {
      if (windSpeedKts > 15) windPenalty = -2;
      else if (windSpeedKts > 10) windPenalty = -1.5;
      else windPenalty = -0.5;
    } else if (isSideshore) {
      if (windSpeedKts > 15) windPenalty = -1;
      else if (windSpeedKts > 10) windPenalty = -0.5;
    }
    const isOffshore = windDir != null && (windDir >= 20 && windDir < 140);
    if (isOffshore && windSpeedKts < 15 && waveHeightFt >= 2) {
      windPenalty = 0.5;
    }
  }

  const total = Math.max(0, Math.min(6, Math.round(heightScore + periodScore + windPenalty)));
  return total === 0 && waveHeightFt >= 0.5 ? 1 : total;
}

// --- Open-Meteo data fetching ---
async function fetchAllForecasts() {
  const cacheKey = 'forecasts:all';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const uniqueCoords = [];
  const coordMap = new Map();

  for (const spot of SPOTS) {
    const key = `${spot.lat.toFixed(2)},${spot.lon.toFixed(2)}`;
    if (!coordMap.has(key)) {
      coordMap.set(key, uniqueCoords.length);
      uniqueCoords.push({ lat: spot.lat, lon: spot.lon, key });
    }
  }

  const results = await Promise.all(uniqueCoords.map(async (coord) => {
    try {
      const [marine, weather] = await Promise.all([
        fetchJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${coord.lat}&longitude=${coord.lon}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction&timezone=America/Los_Angeles&forecast_days=3`),
        fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${coord.lat}&longitude=${coord.lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=America/Los_Angeles&forecast_days=3&wind_speed_unit=kn`)
      ]);
      return { key: coord.key, marine, weather, error: null };
    } catch (e) {
      console.error(`Fetch error for ${coord.key}:`, e.message);
      return { key: coord.key, marine: null, weather: null, error: e.message };
    }
  }));

  const dataMap = {};
  for (const r of results) { dataMap[r.key] = r; }

  const spotForecasts = SPOTS.map(spot => {
    const key = `${spot.lat.toFixed(2)},${spot.lon.toFixed(2)}`;
    const data = dataMap[key];
    if (!data || !data.marine || !data.weather) {
      return { ...spot, forecast: null, error: data?.error || 'No data' };
    }
    const marine = data.marine.hourly;
    const weather = data.weather.hourly;
    const times = marine.time;
    const hourly = times.map((time, i) => {
      const waveHeightM = marine.wave_height?.[i];
      const wavePeriod = marine.wave_period?.[i];
      const waveDir = marine.wave_direction?.[i];
      const swellHeightM = marine.swell_wave_height?.[i];
      const swellPeriod = marine.swell_wave_period?.[i];
      const swellDir = marine.swell_wave_direction?.[i];
      const windSpeed = weather.wind_speed_10m?.[i];
      const windDir = weather.wind_direction_10m?.[i];
      const windGusts = weather.wind_gusts_10m?.[i];
      const primaryHeightM = swellHeightM || waveHeightM || 0;
      const primaryPeriod = swellPeriod || wavePeriod || 0;
      const waveHeightFt = primaryHeightM * 3.28084;
      const totalWaveHeightFt = (waveHeightM || 0) * 3.28084;
      const rating = calculateRating(waveHeightFt, primaryPeriod, windSpeed, windDir);
      return { time, timestamp: new Date(time).getTime() / 1000, waveHeight: totalWaveHeightFt, swellHeight: waveHeightFt, wavePeriod: primaryPeriod, waveDir, swellDir, windSpeed, windDir, windGusts, rating };
    });
    return { ...spot, forecast: { hourly } };
  });

  setCache(cacheKey, spotForecasts);
  return spotForecasts;
}

// --- NDBC buoy ---
async function fetchBuoyData() {
  const cacheKey = 'buoy:46224';
  const cached = getCached(cacheKey);
  if (cached) return cached;
  try {
    const text = await fetchUrl('https://www.ndbc.noaa.gov/data/realtime2/46224.txt');
    const lines = text.trim().split('\n');
    if (lines.length < 3) return null;
    const headers = lines[0].trim().split(/\s+/);
    const values = lines[2].trim().split(/\s+/);
    const row = {};
    headers.forEach((h, i) => row[h] = values[i]);
    const data = {
      time: `${row['#YY']}-${row['MM']}-${row['DD']} ${row['hh']}:${row['mm']} UTC`,
      waveHeight: row['WVHT'] !== 'MM' ? (parseFloat(row['WVHT']) * 3.28084).toFixed(1) : null,
      dominantPeriod: row['DPD'] !== 'MM' ? parseFloat(row['DPD']) : null,
      avgPeriod: row['APD'] !== 'MM' ? parseFloat(row['APD']) : null,
      waveDirection: row['MWD'] !== 'MM' ? parseInt(row['MWD']) : null,
      windSpeed: row['WSPD'] !== 'MM' ? (parseFloat(row['WSPD']) * 1.944).toFixed(0) : null,
      windDir: row['WDIR'] !== 'MM' ? parseInt(row['WDIR']) : null,
      waterTemp: row['WTMP'] !== 'MM' ? ((parseFloat(row['WTMP']) * 9 / 5) + 32).toFixed(0) : null,
    };
    setCache(cacheKey, data);
    return data;
  } catch (e) {
    console.error('Buoy fetch error:', e.message);
    return null;
  }
}

// --- Routes ---
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/spots', (req, res) => { res.json(SPOTS); });

app.get('/api/forecasts', async (req, res) => {
  try {
    const spots = await fetchAllForecasts();
    res.json({ spots, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('Forecasts error:', e.message);
    res.status(500).json({ error: 'Internal error' });
  }
});

app.get('/api/buoy', async (req, res) => {
  try {
    const data = await fetchBuoyData();
    res.json(data || { error: 'No data available' });
  } catch (e) {
    res.status(502).json({ error: 'Failed to fetch buoy data' });
  }
});

app.listen(PORT, () => {
  console.log(`Encinitas Surf Forecast running on http://localhost:${PORT}`);
});
