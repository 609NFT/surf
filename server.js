const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 4001;
const SURFLINE_TOKEN = process.env.SURFLINE_TOKEN || 'e1d5672dc48ca4e553e619e8da48794aa9c10256';
const CF_PROXY = 'https://surfline-proxy.solindex.workers.dev';

// --- Spot data with break characteristics ---
const SPOTS = [
  { name: "Oceanside Harbor", id: "5842041f4e65fad6a7708832", lat: 33.204, lon: -117.396,
    type: 'jetty', facing: 250, swellMin: 230, swellMax: 320, minWave: 2, maxWave: 10, optTideLow: 0, optTideHigh: 5, shoreNormal: 250 },
  { name: "Oceanside Pier", id: "584204204e65fad6a7709435", lat: 33.193, lon: -117.387,
    type: 'beach', facing: 260, swellMin: 210, swellMax: 310, minWave: 2, maxWave: 8, optTideLow: 1, optTideHigh: 4, shoreNormal: 260 },
  { name: "Tamarack", id: "5842041f4e65fad6a7708837", lat: 33.147, lon: -117.347,
    type: 'beach', facing: 255, swellMin: 200, swellMax: 290, minWave: 2, maxWave: 7, optTideLow: 1, optTideHigh: 4, shoreNormal: 255 },
  { name: "Terra Mar", id: "5842041f4e65fad6a77088a6", lat: 33.129, lon: -117.336,
    type: 'reef', facing: 250, swellMin: 190, swellMax: 280, minWave: 2, maxWave: 8, optTideLow: 0, optTideHigh: 3.5, shoreNormal: 250 },
  { name: "Ponto", id: "5842041f4e65fad6a77088a5", lat: 33.087, lon: -117.314,
    type: 'beach', facing: 250, swellMin: 180, swellMax: 280, minWave: 2, maxWave: 7, optTideLow: 1, optTideHigh: 4, shoreNormal: 250 },
  { name: "Grandview", id: "5842041f4e65fad6a770889f", lat: 33.075, lon: -117.311,
    type: 'reef_beach', facing: 250, swellMin: 190, swellMax: 280, minWave: 2, maxWave: 8, optTideLow: 0.5, optTideHigh: 3.5, shoreNormal: 250 },
  { name: "Beacons", id: "5842041f4e65fad6a77088a0", lat: 33.064, lon: -117.306,
    type: 'reef', facing: 245, swellMin: 180, swellMax: 270, minWave: 2, maxWave: 8, optTideLow: 0, optTideHigh: 3, shoreNormal: 245 },
  { name: "D Street", id: "5842041f4e65fad6a77088b7", lat: 33.045, lon: -117.298,
    type: 'beach', facing: 250, swellMin: 190, swellMax: 280, minWave: 2, maxWave: 7, optTideLow: 1, optTideHigh: 4.5, shoreNormal: 250 },
  { name: "Swamis", id: "5842041f4e65fad6a77088b4", lat: 33.034, lon: -117.296,
    type: 'reef_point', facing: 240, swellMin: 180, swellMax: 270, minWave: 2, maxWave: 10, optTideLow: -0.5, optTideHigh: 3, shoreNormal: 240 },
  { name: "Pipes", id: "5c008f5313603c0001df5318", lat: 33.025, lon: -117.289,
    type: 'reef', facing: 245, swellMin: 190, swellMax: 275, minWave: 2, maxWave: 8, optTideLow: 0, optTideHigh: 3, shoreNormal: 245 },
  { name: "Cardiff Reef", id: "5842041f4e65fad6a77088b1", lat: 33.015, lon: -117.283,
    type: 'reef', facing: 240, swellMin: 180, swellMax: 265, minWave: 2, maxWave: 8, optTideLow: -0.5, optTideHigh: 3, shoreNormal: 240 },
  { name: "Seaside Reef", id: "5842041f4e65fad6a77088b3", lat: 33.002, lon: -117.280,
    type: 'reef', facing: 245, swellMin: 190, swellMax: 275, minWave: 3, maxWave: 10, optTideLow: -0.5, optTideHigh: 2.5, shoreNormal: 245 },
  { name: "Del Mar Rivermouth", id: "5842041f4e65fad6a77088b0", lat: 32.975, lon: -117.271,
    type: 'beach', facing: 255, swellMin: 200, swellMax: 290, minWave: 2, maxWave: 6, optTideLow: 1, optTideHigh: 4, shoreNormal: 255 },
  { name: "15th Street Del Mar", id: "5842041f4e65fad6a77088af", lat: 32.959, lon: -117.269,
    type: 'beach', facing: 260, swellMin: 200, swellMax: 290, minWave: 2, maxWave: 7, optTideLow: 1, optTideHigh: 4, shoreNormal: 260 }
];

// --- Cache ---
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000;
function getCached(key) { const e = cache.get(key); if (e && Date.now() - e.ts < CACHE_TTL) return e.data; return null; }
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// --- HTTP fetch ---
function fetchUrl(u) {
  return new Promise((resolve, reject) => {
    const mod = u.startsWith('https') ? https : http;
    const req = mod.get(u, { headers: { 'User-Agent': 'EncinitasSurf/1.0' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let body = ''; res.on('data', c => body += c); res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
async function fetchJSON(u) { return JSON.parse(await fetchUrl(u)); }

// --- Surf Rating ---
// --- Tide data cache for rating ---
let tideCache = null;
async function getTideData() {
  if (tideCache && Date.now() - tideCache.ts < CACHE_TTL) return tideCache.data;
  try {
    const today = new Date();
    const end = new Date(today.getTime() + 3 * 86400000);
    const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'');
    const res = await fetchJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${fmt(today)}&end_date=${fmt(end)}&station=9410230&product=predictions&datum=MLLW&time_zone=gmt&units=english&interval=h&format=json`);
    const data = (res.predictions || []).map(p => ({ timestamp: new Date(p.t + 'Z').getTime() / 1000, height: parseFloat(p.v) }));
    tideCache = { data, ts: Date.now() };
    return data;
  } catch (e) { return null; }
}

function getTideAtTime(tideData, timestamp) {
  if (!tideData || !tideData.length) return null;
  for (let i = 0; i < tideData.length - 1; i++) {
    if (tideData[i].timestamp <= timestamp && tideData[i+1].timestamp > timestamp) {
      const frac = (timestamp - tideData[i].timestamp) / (tideData[i+1].timestamp - tideData[i].timestamp);
      return tideData[i].height + (tideData[i+1].height - tideData[i].height) * frac;
    }
  }
  return tideData[0].height;
}

function angleDiff(a, b) {
  let d = ((b - a) % 360 + 360) % 360;
  return d > 180 ? 360 - d : d;
}

function calculateRating(spot, waveHeightFt, periodSec, windSpeedKts, windDir, swellDir, tideHeight) {
  if (waveHeightFt == null || waveHeightFt < 0.5) return 0;

  // --- 1. WAVE HEIGHT SCORE (0-2.5) ---
  // Optimal range per spot, penalty for too big or too small
  let waveScore = 0;
  if (waveHeightFt < spot.minWave * 0.5) waveScore = 0.3;
  else if (waveHeightFt < spot.minWave) waveScore = 0.8;
  else if (waveHeightFt <= spot.maxWave * 0.7) waveScore = 2.5; // sweet spot
  else if (waveHeightFt <= spot.maxWave) waveScore = 2.0;
  else if (waveHeightFt <= spot.maxWave * 1.3) waveScore = 1.2; // getting too big
  else waveScore = 0.5; // maxed out / closeouts

  // --- 2. SWELL PERIOD SCORE (0-2) ---
  // Exponential importance -- long period groundswell is king
  let periodScore = 0;
  if (periodSec != null) {
    if (periodSec < 6) periodScore = 0;
    else if (periodSec < 8) periodScore = 0.3;
    else if (periodSec < 10) periodScore = 0.7;
    else if (periodSec < 12) periodScore = 1.0;
    else if (periodSec < 14) periodScore = 1.3;
    else if (periodSec < 17) periodScore = 1.7;
    else periodScore = 2.0;
  }

  // --- 3. SWELL DIRECTION SCORE (-1 to 1) ---
  // How well does this swell angle hit this spot?
  let swellScore = 0;
  if (swellDir != null) {
    const optCenter = (spot.swellMin + spot.swellMax) / 2;
    const optRange = (spot.swellMax - spot.swellMin) / 2;
    const diff = angleDiff(swellDir, optCenter);
    if (diff <= optRange * 0.5) swellScore = 1.0;       // dead on
    else if (diff <= optRange) swellScore = 0.5;          // within window
    else if (diff <= optRange * 1.5) swellScore = -0.2;   // marginal
    else swellScore = -0.8;                                // wrong direction
  }

  // --- 4. WIND SCORE (-2 to 1) ---
  // Relative to shore normal -- offshore is gold, onshore kills it
  let windScore = 0;
  if (windSpeedKts != null && windDir != null) {
    const relAngle = angleDiff(windDir, spot.shoreNormal);
    const isOffshore = relAngle > 120;   // wind blowing from land to sea
    const isSideshore = relAngle > 60 && relAngle <= 120;
    const isOnshore = relAngle <= 60;    // wind blowing from sea to land

    if (windSpeedKts <= 3) {
      windScore = 0.8; // glassy
    } else if (windSpeedKts <= 7) {
      if (isOffshore) windScore = 1.0;
      else if (isSideshore) windScore = 0.3;
      else windScore = -0.3;
    } else if (windSpeedKts <= 12) {
      if (isOffshore) windScore = 0.7;
      else if (isSideshore) windScore = -0.3;
      else windScore = -1.0;
    } else if (windSpeedKts <= 18) {
      if (isOffshore) windScore = 0.3; // strong offshore can be too much
      else if (isSideshore) windScore = -0.8;
      else windScore = -1.5;
    } else { // 18+ kts
      if (isOffshore) windScore = 0;
      else windScore = -2.0; // blown out
    }
  }

  // --- 5. TIDE SCORE (-0.5 to 0.5) ---
  let tideScore = 0;
  if (tideHeight != null) {
    const optMid = (spot.optTideLow + spot.optTideHigh) / 2;
    const optHalf = (spot.optTideHigh - spot.optTideLow) / 2;
    const diff = Math.abs(tideHeight - optMid);
    if (diff <= optHalf) tideScore = 0.5;              // in the zone
    else if (diff <= optHalf * 2) tideScore = 0;       // ok
    else tideScore = -0.5;                              // wrong tide

    // Reef breaks are more tide-sensitive
    if (spot.type === 'reef' || spot.type === 'reef_point') {
      tideScore *= 1.5;
    }
  }

  // --- TOTAL ---
  // Wave: 0-2.5, Period: 0-2, Swell Dir: -1 to 1, Wind: -2 to 1, Tide: -0.75 to 0.75
  // Raw range: roughly -3.75 to 7.25
  // Map to 0-6 scale
  const raw = waveScore + periodScore + swellScore + windScore + tideScore;
  const normalized = Math.max(0, Math.min(6, Math.round((raw / 7.25) * 6)));
  return normalized === 0 && waveHeightFt >= 0.5 ? 1 : normalized;
}

// --- Surfline via CF Worker proxy ---
function slUrl(endpoint, spotId, extraParams = '') {
  const base = `https://services.surfline.com/kbyg/spots/forecasts/${endpoint}?spotId=${spotId}&days=2&intervalHours=1&cacheEnabled=true&accesstoken=${SURFLINE_TOKEN}${extraParams}`;
  return `${CF_PROXY}/proxy?url=${encodeURIComponent(base)}`;
}

async function fetchSurflineForecasts() {
  const ck = 'surfline:all'; const cd = getCached(ck); if (cd) return cd;
  const results = {};
  // Batch 3 spots at a time to be nice to the worker
  for (let i = 0; i < SPOTS.length; i += 3) {
    const batch = SPOTS.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(async (s) => {
      try {
        const [rating, surf, wind] = await Promise.all([
          fetchJSON(slUrl('rating', s.id)),
          fetchJSON(slUrl('surf', s.id, '&units%5BwaveHeight%5D=FT')),
          fetchJSON(slUrl('wind', s.id, '&corrected=true&units%5BwindSpeed%5D=KTS'))
        ]);
        return { id: s.id, rating, surf, wind };
      } catch (e) {
        console.error(`Surfline fetch failed for ${s.name}: ${e.message}`);
        return { id: s.id, error: e.message };
      }
    }));
    batchResults.forEach(r => results[r.id] = r);
    if (i + 3 < SPOTS.length) await new Promise(r => setTimeout(r, 200));
  }
  setCache(ck, results);
  return results;
}

function buildSurflineSpots(slData) {
  return SPOTS.map(s => {
    const sl = slData[s.id];
    if (!sl || sl.error || !sl.rating?.data?.rating) return null;
    const ratings = sl.rating.data.rating;
    const surfs = sl.surf?.data?.surf || [];
    const winds = sl.wind?.data?.wind || [];
    const hourly = ratings.map((r, i) => {
      const sf = surfs[i] || {};
      const wn = winds[i] || {};
      const waveMin = sf.surf?.min || 0;
      const waveMax = sf.surf?.max || 0;
      const waveHeight = (waveMin + waveMax) / 2;
      return {
        time: new Date(r.timestamp * 1000).toISOString(),
        timestamp: r.timestamp,
        waveHeight,
        waveMin,
        waveMax,
        swellHeight: waveHeight,
        wavePeriod: sf.surf?.period || 0,
        waveDir: null,
        swellDir: null,
        windSpeed: wn.speed || 0,
        windDir: wn.direction || 0,
        windGusts: wn.gust || 0,
        rating: r.rating?.value || 0,
        ratingKey: r.rating?.key || 'FLAT',
        source: 'surfline'
      };
    });
    return { ...s, forecast: { hourly } };
  });
}

// --- Open-Meteo (fallback) ---
async function fetchAllForecasts() {
  const ck = 'forecasts:all'; const cd = getCached(ck); if (cd) return cd;
  const uq = []; const cm = new Map();
  for (const s of SPOTS) { const k = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`; if (!cm.has(k)) { cm.set(k, uq.length); uq.push({ lat: s.lat, lon: s.lon, key: k }); } }
  // Batch requests to avoid Open-Meteo rate limiting
  const results = [];
  for (let i = 0; i < uq.length; i += 3) {
    const batch = uq.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(async (c) => {
      try {
        const [m, w] = await Promise.all([
          fetchJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${c.lat}&longitude=${c.lon}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction&timezone=GMT&forecast_days=3`),
          fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=GMT&forecast_days=3&wind_speed_unit=kn`)
        ]);
        return { key: c.key, marine: m, weather: w };
      } catch (e) { return { key: c.key, marine: null, weather: null, error: e.message }; }
    }));
    results.push(...batchResults);
    if (i + 3 < uq.length) await new Promise(r => setTimeout(r, 300));
  }
  const dm = {}; for (const r of results) dm[r.key] = r;
  // Fetch tide data for rating
  const tideData = await getTideData();
  const sf = SPOTS.map(s => {
    const k = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`; const d = dm[k];
    if (!d || !d.marine || !d.weather) return { ...s, forecast: null };
    const mr = d.marine.hourly, wr = d.weather.hourly, ts = mr.time;
    const hourly = ts.map((t, i) => {
      const wh = mr.wave_height?.[i], wp = mr.wave_period?.[i], wd = mr.wave_direction?.[i];
      const sh = mr.swell_wave_height?.[i], sp = mr.swell_wave_period?.[i], sd = mr.swell_wave_direction?.[i];
      const ws = wr.wind_speed_10m?.[i], wdr = wr.wind_direction_10m?.[i], wg = wr.wind_gusts_10m?.[i];
      const ph = sh || wh || 0, pp = sp || wp || 0;
      const whf = ph * 3.28084, twf = (wh || 0) * 3.28084;
      const isoTime = t.endsWith('Z') ? t : t + 'Z';
      const ts_epoch = new Date(isoTime).getTime() / 1000;
      const tideH = getTideAtTime(tideData, ts_epoch);
      return { time: isoTime, timestamp: ts_epoch, waveHeight: twf, swellHeight: whf, wavePeriod: pp, waveDir: wd, swellDir: sd, windSpeed: ws, windDir: wdr, windGusts: wg, rating: calculateRating(s, whf, pp, ws, wdr, sd, tideH) };
    });
    return { ...s, forecast: { hourly } };
  });
  setCache(ck, sf); return sf;
}

// --- NDBC buoy ---
async function fetchBuoyData() {
  const ck = 'buoy:46224'; const cd = getCached(ck); if (cd) return cd;
  try {
    const txt = await fetchUrl('https://www.ndbc.noaa.gov/data/realtime2/46224.txt');
    const lines = txt.trim().split('\n'); if (lines.length < 3) return null;
    const h = lines[0].trim().split(/\s+/), v = lines[2].trim().split(/\s+/), r = {};
    h.forEach((k, i) => r[k] = v[i]);
    const data = {
      time: `${r['#YY']}-${r['MM']}-${r['DD']} ${r['hh']}:${r['mm']} UTC`,
      waveHeight: r['WVHT'] !== 'MM' ? (parseFloat(r['WVHT']) * 3.28084).toFixed(1) : null,
      dominantPeriod: r['DPD'] !== 'MM' ? parseFloat(r['DPD']) : null,
      avgPeriod: r['APD'] !== 'MM' ? parseFloat(r['APD']) : null,
      waveDirection: r['MWD'] !== 'MM' ? parseInt(r['MWD']) : null,
      windSpeed: r['WSPD'] !== 'MM' ? (parseFloat(r['WSPD']) * 1.944).toFixed(0) : null,
      windDir: r['WDIR'] !== 'MM' ? parseInt(r['WDIR']) : null,
      waterTemp: r['WTMP'] !== 'MM' ? ((parseFloat(r['WTMP']) * 9 / 5) + 32).toFixed(0) : null,
    };
    setCache(ck, data); return data;
  } catch (e) { return null; }
}

// --- MIME types ---
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

// --- Server ---
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  // API routes
  if (pathname === '/api/forecasts') {
    try {
      // Try Surfline first, fall back to Open-Meteo
      let spots;
      let source = 'open-meteo';
      try {
        const slData = await fetchSurflineForecasts();
        const slSpots = buildSurflineSpots(slData);
        const validCount = slSpots.filter(s => s !== null).length;
        if (validCount >= 10) {
          // Fill any missing spots with Open-Meteo
          const omSpots = await fetchAllForecasts();
          spots = SPOTS.map((s, i) => slSpots[i] || omSpots[i]);
          source = 'surfline';
          console.log(`Using Surfline data (${validCount}/14 spots)`);
        } else {
          spots = await fetchAllForecasts();
          console.log(`Surfline only got ${validCount} spots, using Open-Meteo`);
        }
      } catch (e) {
        console.log(`Surfline failed (${e.message}), using Open-Meteo`);
        spots = await fetchAllForecasts();
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ spots, source, timestamp: new Date().toISOString() }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal error' }));
    }
    return;
  }
  if (pathname === '/api/buoy') {
    try {
      const data = await fetchBuoyData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data || { error: 'No data' }));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed' }));
    }
    return;
  }
  if (pathname === '/api/tides') {
    const ck = 'tides';
    const cached = getCached(ck);
    if (cached) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cached)); return; }
    try {
      const today = new Date();
      const end = new Date(today.getTime() + 3 * 86400000);
      const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'');
      const [hourlyRes, hiloRes] = await Promise.all([
        fetchJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${fmt(today)}&end_date=${fmt(end)}&station=9410230&product=predictions&datum=MLLW&time_zone=gmt&units=english&interval=h&format=json`),
        fetchJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${fmt(today)}&end_date=${fmt(end)}&station=9410230&product=predictions&datum=MLLW&time_zone=gmt&units=english&interval=hilo&format=json`)
      ]);
      const data = {
        station: '9410230',
        name: 'La Jolla (Scripps)',
        hourly: (hourlyRes.predictions || []).map(p => ({ time: p.t + ' UTC', timestamp: new Date(p.t + 'Z').getTime() / 1000, height: parseFloat(p.v) })),
        hilo: (hiloRes.predictions || []).map(p => ({ time: p.t + ' UTC', timestamp: new Date(p.t + 'Z').getTime() / 1000, height: parseFloat(p.v), type: p.type }))
      };
      setCache(ck, data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to fetch tides' }));
    }
    return;
  }
  // Surfline data sync endpoint - receives data from bookmarklet
  if (pathname === '/api/surfline-sync' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.token !== SURFLINE_TOKEN) { res.writeHead(403); res.end('Forbidden'); return; }
        setCache('surfline:data', data.spots);
        console.log(`Surfline sync: received data for ${Object.keys(data.spots).length} spots`);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, spots: Object.keys(data.spots).length }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid data' }));
      }
    });
    return;
  }
  if (pathname === '/api/surfline-sync' && req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }
  if (pathname === '/api/surfline-data') {
    const data = getCached('surfline:data');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data ? { synced: true, spots: data } : { synced: false }));
    return;
  }
  if (pathname === '/api/forecast-text') {
    const ck = 'forecast-text'; const cd = getCached(ck);
    if (cd) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cd)); return; }
    try {
      const slUrl = `https://services.surfline.com/kbyg/forecast-content?days=2&subregionId=58581a836630e24c44878fd7&accesstoken=${SURFLINE_TOKEN}`;
      const data = await fetchJSON(`${CF_PROXY}/proxy?url=${encodeURIComponent(slUrl)}`);
      const today = data.today?.forecast || {};
      const result = {
        headline: today.headline || '',
        observation: (today.observation || '').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim(),
        forecaster: data.forecaster?.name || '',
        dayToWatch: today.dayToWatch || false,
        date: data.today?.date || '',
        subregion: data.subregion?.name || ''
      };
      setCache(ck, result);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }
  if (pathname === '/api/spots') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(SPOTS));
    return;
  }
  if (pathname === '/api/sl-config') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ t: SURFLINE_TOKEN }));
    return;
  }

  // Static files
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch (e) {
    // Try index.html for SPA
    try {
      const content = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    } catch (e2) {
      res.writeHead(404); res.end('Not found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Encinitas Surf Forecast running on port ${PORT}`);
});
