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
function fetchUrl(u, opts = {}) {
  return new Promise((resolve, reject) => {
    const mod = u.startsWith('https') ? https : http;
    const headers = Object.assign({ 'User-Agent': 'EncinitasSurf/1.0' }, opts.headers || {});
    const req = mod.get(u, { headers }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      const chunks = [];
      res.on('data', c => chunks.push(typeof c === 'string' ? Buffer.from(c) : c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve(opts.binary ? buf : buf.toString('utf8'));
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
async function fetchJSON(u) { return JSON.parse(await fetchUrl(u)); }

// --- Surf Rating ---
// --- Tide data cache for rating ---
let tideCache = null;
async function getTideData() {
  if (tideCache && Date.now() - tideCache.ts < CACHE_TTL) return tideCache.data;
  try {
    const yesterday = new Date(Date.now() - 86400000);
    const end = new Date(Date.now() + 3 * 86400000);
    const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'');
    const res = await fetchJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${fmt(yesterday)}&end_date=${fmt(end)}&station=9410230&product=predictions&datum=MLLW&time_zone=gmt&units=english&interval=h&format=json`);
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

// --- Scripps cam viz analyzer ---
// Fetches a live frame from the HLS stream and analyzes water color to estimate viz
const { execFile } = require('child_process');
const os = require('os');

async function analyzeScrippsViz(streamUrl) {
  return new Promise(async (resolve) => {
    try {
      // Get chunklist from master playlist
      const master = await fetchUrl(streamUrl);
      const chunkMatch = master.match(/https?:\/\/[^\s]+chunklist[^\s]+/);
      if (!chunkMatch) return resolve(null);

      // Get a TS segment URL
      const chunklist = await fetchUrl(chunkMatch[0]);
      const tsMatch = chunklist.match(/https?:\/\/[^\s]+\.ts[^\s]*/);
      if (!tsMatch) return resolve(null);

      const tsUrl = tsMatch[0];
      const tmpTs = `${os.tmpdir()}/scripps_${Date.now()}.ts`;
      const tmpJpg = `${os.tmpdir()}/scripps_${Date.now()}.jpg`;
      const tmpPx = `${os.tmpdir()}/scripps_${Date.now()}.raw`;

      // Download TS segment (binary)
      const tsData = await fetchUrl(tsUrl, { binary: true }).catch(() => null);
      if (!tsData) return resolve(null);
      require('fs').writeFileSync(tmpTs, tsData);

      // Extract first frame
      await new Promise((res, rej) => {
        execFile('ffmpeg', ['-i', tmpTs, '-frames:v', '1', '-q:v', '2', tmpJpg, '-y'],
          { timeout: 15000 }, (err) => err ? rej(err) : res());
      });

      // Sample water region (35-50% x, 15-35% y) — clear of pilings
      // Frame is 1920x1080: crop 288x216 at x=672,y=162
      await new Promise((res, rej) => {
        execFile('ffmpeg', [
          '-i', tmpJpg,
          '-vf', 'crop=288:216:672:162,scale=1:1',
          '-pix_fmt', 'rgb24', '-f', 'rawvideo', tmpPx, '-y'
        ], { timeout: 10000 }, (err) => err ? rej(err) : res());
      });

      const px = require('fs').readFileSync(tmpPx);
      const r = px[0], g = px[1], b = px[2];
      const total = r + g + b + 0.001;
      const blueDom = b / total;
      const sat = (Math.max(r,g,b) - Math.min(r,g,b)) / (Math.max(r,g,b) + 0.001);
      const clarity = blueDom * sat;

      // Map clarity score to viz estimate
      let vizFt, label, diveRating, diveLabel;
      if (clarity > 0.45)      { vizFt = 30; label = 'Excellent'; diveRating = 5; diveLabel = 'Excellent'; }
      else if (clarity > 0.38) { vizFt = 20; label = 'Good';      diveRating = 4; diveLabel = 'Good'; }
      else if (clarity > 0.28) { vizFt = 12; label = 'Fair';      diveRating = 3; diveLabel = 'Fair'; }
      else if (clarity > 0.18) { vizFt = 7;  label = 'Poor';      diveRating = 2; diveLabel = 'Poor'; }
      else                     { vizFt = 3;  label = 'Very Poor';  diveRating = 1; diveLabel = 'Very Poor'; }

      // Cleanup
      for (const f of [tmpTs, tmpJpg, tmpPx]) { try { require('fs').unlinkSync(f); } catch(e){} }

      resolve({ vizFt, label, diveRating, diveLabel, clarity: parseFloat(clarity.toFixed(3)), rgb: {r,g,b}, source: 'camera' });
    } catch(e) {
      console.error('Scripps viz analysis failed:', e.message);
      resolve(null);
    }
  });
}

// --- Dive visibility estimator ---
// Visibility in SoCal kelp/reef diving is driven by surge/swell and current
// Swell > 4ft = bad viz, calm + low current = great viz
function estimateViz(waveHtFt, swellHtFt, currentVelMs) {
  // Base viz from swell — primary factor
  let baseViz;
  const swell = Math.max(waveHtFt, swellHtFt);
  if (swell < 0.5) baseViz = 40;
  else if (swell < 1.0) baseViz = 30;
  else if (swell < 1.5) baseViz = 20;
  else if (swell < 2.5) baseViz = 15;
  else if (swell < 3.5) baseViz = 10;
  else if (swell < 5.0) baseViz = 5;
  else baseViz = 3;

  // Current penalty (m/s — 0.5 m/s is already strong)
  const currentKts = currentVelMs * 1.944;
  let currentPenalty = 0;
  if (currentKts > 0.5) currentPenalty = 5;
  if (currentKts > 1.0) currentPenalty = 10;
  if (currentKts > 1.5) currentPenalty = 15;

  const vizFt = Math.max(3, baseViz - currentPenalty);

  let label, diveRating, diveLabel;
  if (vizFt >= 30) { label = 'Excellent'; diveRating = 5; diveLabel = 'Excellent'; }
  else if (vizFt >= 20) { label = 'Good'; diveRating = 4; diveLabel = 'Good'; }
  else if (vizFt >= 12) { label = 'Fair'; diveRating = 3; diveLabel = 'Fair'; }
  else if (vizFt >= 7) { label = 'Poor'; diveRating = 2; diveLabel = 'Poor'; }
  else { label = 'Very Poor'; diveRating = 1; diveLabel = 'Very Poor'; }

  return { vizFt, label, diveRating, diveLabel };
}

function wetsuitRec(tempF) {
  if (!tempF || isNaN(tempF)) return null;
  if (tempF >= 72) return '3mm or shorty';
  if (tempF >= 67) return '3mm fullsuit';
  if (tempF >= 62) return '5mm fullsuit';
  if (tempF >= 58) return '7mm + hood';
  return '7mm drysuit recommended';
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
      const yesterday = new Date(Date.now() - 86400000);
      const end = new Date(Date.now() + 3 * 86400000);
      const fmt = d => d.toISOString().slice(0,10).replace(/-/g,'');
      const [hourlyRes, hiloRes] = await Promise.all([
        fetchJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${fmt(yesterday)}&end_date=${fmt(end)}&station=9410230&product=predictions&datum=MLLW&time_zone=gmt&units=english&interval=h&format=json`),
        fetchJSON(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?begin_date=${fmt(yesterday)}&end_date=${fmt(end)}&station=9410230&product=predictions&datum=MLLW&time_zone=gmt&units=english&interval=hilo&format=json`)
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

  if (pathname === '/api/scripps-viz') {
    // Camera-based viz analysis — cache 10 min (updates every segment ~10s but analysis is expensive)
    const ck = 'scripps:viz';
    const cd = getCached(ck);
    if (cd) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cd)); return; }
    try {
      // Get fresh stream URL
      const STREAM_ID = 'scripps_pier-underwater-HDOT';
      const REFERRER = Buffer.from('https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/').toString('base64');
      const raw = await fetchUrl(`https://portal.hdontap.com/backend/embed/${STREAM_ID}?r=${REFERRER}`, {
        headers: { 'Referer': 'https://hdontap.com/', 'Origin': 'https://hdontap.com', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
      });
      const streamData = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      const viz = await analyzeScrippsViz(streamData.streamSrc);
      if (!viz) throw new Error('Analysis failed');
      const result = { ...viz, timestamp: new Date().toISOString() };
      // Cache for 10 min
      cache.set(ck, { data: result, ts: Date.now() - CACHE_TTL + 10 * 60 * 1000 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/scripps-cam') {
    // Fetch a fresh HLS token from HDOnTap backend (token valid ~12hrs)
    const ck = 'scripps-cam:token';
    const cached = getCached(ck);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(cached));
      return;
    }
    try {
      const STREAM_ID = 'scripps_pier-underwater-HDOT';
      const REFERRER = Buffer.from('https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/').toString('base64');
      const raw = await fetchUrl(`https://portal.hdontap.com/backend/embed/${STREAM_ID}?r=${REFERRER}`, {
        headers: {
          'Referer': 'https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/',
          'Origin': 'https://hdontap.com',
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const data = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      const streamUrl = data.streamSrc;
      if (!streamUrl) throw new Error('No streamSrc in response');
      // Parse expiry from URL
      const expMatch = streamUrl.match(/[?&]e=(\d+)/);
      const expiry = expMatch ? parseInt(expMatch[1]) : 0;
      // Cache until 1hr before expiry
      const ttl = expiry ? Math.max(0, (expiry - 3600) * 1000 - Date.now()) : 30 * 60 * 1000;
      const result = { streamUrl, expiry, thumbnail: 'https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_hosb6lo_scripps_pier-underwater.stream_Jqu1gTq.jpg' };
      // Store with custom TTL
      cache.set(ck, { data: result, ts: Date.now() - CACHE_TTL + ttl });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/dive') {
    const ck = 'dive:conditions'; const cd = getCached(ck);
    if (cd) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(cd)); return; }
    try {
      // Dive spots along N San Diego coast — reefs and kelp beds
      const DIVE_SPOTS = [
        { name: 'La Jolla Cove', lat: 32.850, lon: -117.271, type: 'cove', desc: 'Calm, protected cove. Garibaldi, leopard sharks, sea lions.' },
        { name: 'La Jolla Shores', lat: 32.858, lon: -117.256, type: 'beach', desc: 'Easy entry. Sandy bottom with rays and halibut. Good for beginners.' },
        { name: 'Swamis Reef', lat: 33.034, lon: -117.296, type: 'reef', desc: 'Rocky reef with kelp. Sheephead, cabezon, lobster at night.' },
        { name: 'Cardiff Reef', lat: 33.015, lon: -117.283, type: 'reef', desc: 'Submerged reef. Varied sea life, lobster, kelp.' },
        { name: 'Seaside Reef', lat: 33.002, lon: -117.280, type: 'reef', desc: 'Shallow to mid-depth reef diving. Good macro life.' },
        { name: 'Oceanside Harbor', lat: 33.204, lon: -117.396, type: 'harbor', desc: 'Protected harbor diving. Sea bass, corvina, kelp forest nearby.' }
      ];

      // Fetch buoy + marine data for primary dive coords (La Jolla)
      const [buoy, marineRes] = await Promise.all([
        fetchBuoyData(),
        fetchJSON('https://marine-api.open-meteo.com/v1/marine?latitude=32.85&longitude=-117.27&hourly=wave_height,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,ocean_current_velocity,ocean_current_direction&timezone=GMT&forecast_days=3').catch(() => null)
      ]);

      const now = Date.now() / 1000;

      // Get current hour index from marine data
      let currentMarine = null;
      if (marineRes && marineRes.hourly && marineRes.hourly.time) {
        const times = marineRes.hourly.time;
        let bestIdx = 0;
        for (let i = 0; i < times.length; i++) {
          const t = new Date(times[i] + 'Z').getTime() / 1000;
          if (Math.abs(t - now) < Math.abs(new Date(times[bestIdx] + 'Z').getTime() / 1000 - now)) bestIdx = i;
        }
        const h = marineRes.hourly;
        currentMarine = {
          waveHeight: h.wave_height?.[bestIdx],
          wavePeriod: h.wave_period?.[bestIdx],
          swellHeight: h.swell_wave_height?.[bestIdx],
          swellPeriod: h.swell_wave_period?.[bestIdx],
          swellDir: h.swell_wave_direction?.[bestIdx],
          currentVelocity: h.ocean_current_velocity?.[bestIdx],
          currentDir: h.ocean_current_direction?.[bestIdx],
          time: times[bestIdx]
        };
      }

      // Build 48h timeline for visibility chart
      let timeline = [];
      if (marineRes && marineRes.hourly && marineRes.hourly.time) {
        const h = marineRes.hourly;
        const endTs = now + 48 * 3600;
        h.time.forEach((t, i) => {
          const ts = new Date(t + 'Z').getTime() / 1000;
          if (ts < now - 1800 || ts > endTs) return;
          const waveHt = (h.wave_height?.[i] || 0) * 3.28084; // m to ft
          const swellHt = (h.swell_wave_height?.[i] || 0) * 3.28084;
          const currentVel = h.ocean_current_velocity?.[i] || 0; // m/s
          const viz = estimateViz(waveHt, swellHt, currentVel);
          timeline.push({
            time: t + 'Z',
            timestamp: ts,
            waveHeightFt: waveHt,
            swellHeightFt: swellHt,
            swellDir: h.swell_wave_direction?.[i],
            currentVelocityMs: currentVel,
            currentDir: h.ocean_current_direction?.[i],
            vizFt: viz.vizFt,
            vizLabel: viz.label,
            diveRating: viz.diveRating
          });
        });
      }

      // Compute viz + dive ratings for each spot based on their exposure
      const spots = DIVE_SPOTS.map(s => {
        const swellHtFt = currentMarine ? (currentMarine.swellHeight || currentMarine.waveHeight || 0) * 3.28084 : 0;
        const waveHtFt = currentMarine ? (currentMarine.waveHeight || 0) * 3.28084 : 0;
        const currentVel = currentMarine ? (currentMarine.currentVelocity || 0) : 0;

        // Cove gets swell shadow; reef/beach more exposed
        let exposureMult = 1.0;
        if (s.type === 'cove') exposureMult = 0.4;
        else if (s.type === 'harbor') exposureMult = 0.2;
        else if (s.type === 'beach') exposureMult = 0.9;

        const adjSwell = swellHtFt * exposureMult;
        const adjWave = waveHtFt * exposureMult;
        const viz = estimateViz(adjWave, adjSwell, currentVel);

        return {
          ...s,
          current: {
            waveHeightFt: parseFloat(adjWave.toFixed(1)),
            swellHeightFt: parseFloat(adjSwell.toFixed(1)),
            swellDir: currentMarine?.swellDir,
            currentVelocityMs: parseFloat((currentVel * exposureMult).toFixed(2)),
            currentDir: currentMarine?.currentDir,
            vizFt: viz.vizFt,
            vizLabel: viz.label,
            diveRating: viz.diveRating,
            diveLabel: viz.diveLabel
          }
        };
      });

      // Try to get camera-based viz (cached, non-blocking)
      let cameraViz = null;
      try {
        const cv = getCached('scripps:viz');
        if (cv) cameraViz = cv;
      } catch(e) {}

      const result = {
        timestamp: new Date().toISOString(),
        waterTempF: buoy ? parseFloat(buoy.waterTemp) : null,
        wetsuitRec: buoy ? wetsuitRec(parseFloat(buoy.waterTemp)) : null,
        cameraViz,
        buoy: buoy ? {
          waveHeightFt: buoy.waveHeight ? parseFloat(buoy.waveHeight) : null,
          dominantPeriod: buoy.dominantPeriod,
          waveDir: buoy.waveDirection,
          windSpeed: buoy.windSpeed,
          windDir: buoy.windDir
        } : null,
        spots,
        timeline
      };

      setCache(ck, result);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
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
