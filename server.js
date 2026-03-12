const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');

const PORT = process.env.PORT || 4001;
const SURFLINE_TOKEN = process.env.SURFLINE_TOKEN || 'e1d5672dc48ca4e553e619e8da48794aa9c10256';

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
function calculateRating(waveHeightFt, periodSec, windSpeedKts, windDir) {
  if (waveHeightFt == null || waveHeightFt < 0.5) return 0;
  let hs = 0;
  if (waveHeightFt >= 1 && waveHeightFt < 2) hs = 0.5;
  else if (waveHeightFt >= 2 && waveHeightFt < 3) hs = 1;
  else if (waveHeightFt >= 3 && waveHeightFt < 4) hs = 1.5;
  else if (waveHeightFt >= 4 && waveHeightFt < 6) hs = 2;
  else if (waveHeightFt >= 6 && waveHeightFt < 8) hs = 2.5;
  else if (waveHeightFt >= 8) hs = 3;
  let ps = 0;
  if (periodSec != null) {
    if (periodSec >= 8 && periodSec < 10) ps = 0.5;
    else if (periodSec >= 10 && periodSec < 13) ps = 1;
    else if (periodSec >= 13 && periodSec < 16) ps = 1.5;
    else if (periodSec >= 16) ps = 2;
  }
  let wp = 0;
  if (windSpeedKts != null && windSpeedKts > 5) {
    const onshore = windDir != null && windDir >= 180 && windDir <= 320;
    const sideshore = windDir != null && ((windDir >= 140 && windDir < 180) || (windDir > 320 && windDir <= 360));
    if (onshore) { wp = windSpeedKts > 15 ? -2 : windSpeedKts > 10 ? -1.5 : -0.5; }
    else if (sideshore) { wp = windSpeedKts > 15 ? -1 : windSpeedKts > 10 ? -0.5 : 0; }
    if (windDir != null && windDir >= 20 && windDir < 140 && windSpeedKts < 15 && waveHeightFt >= 2) wp = 0.5;
  }
  const t = Math.max(0, Math.min(6, Math.round(hs + ps + wp)));
  return t === 0 && waveHeightFt >= 0.5 ? 1 : t;
}

// --- Open-Meteo ---
async function fetchAllForecasts() {
  const ck = 'forecasts:all'; const cd = getCached(ck); if (cd) return cd;
  const uq = []; const cm = new Map();
  for (const s of SPOTS) { const k = `${s.lat.toFixed(2)},${s.lon.toFixed(2)}`; if (!cm.has(k)) { cm.set(k, uq.length); uq.push({ lat: s.lat, lon: s.lon, key: k }); } }
  const results = await Promise.all(uq.map(async (c) => {
    try {
      const [m, w] = await Promise.all([
        fetchJSON(`https://marine-api.open-meteo.com/v1/marine?latitude=${c.lat}&longitude=${c.lon}&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction&timezone=America/Los_Angeles&forecast_days=3`),
        fetchJSON(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=America/Los_Angeles&forecast_days=3&wind_speed_unit=kn`)
      ]);
      return { key: c.key, marine: m, weather: w };
    } catch (e) { return { key: c.key, marine: null, weather: null, error: e.message }; }
  }));
  const dm = {}; for (const r of results) dm[r.key] = r;
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
      return { time: t, timestamp: new Date(t).getTime() / 1000, waveHeight: twf, swellHeight: whf, wavePeriod: pp, waveDir: wd, swellDir: sd, windSpeed: ws, windDir: wdr, windGusts: wg, rating: calculateRating(whf, pp, ws, wdr) };
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
      const spots = await fetchAllForecasts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ spots, timestamp: new Date().toISOString() }));
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
