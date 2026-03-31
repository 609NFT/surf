(() => {
  const RATING_LABELS = ['FLAT', 'VERY POOR', 'POOR', 'POOR TO FAIR', 'FAIR', 'FAIR TO GOOD', 'GOOD'];
  const RATING_CLASSES = ['flat', 'very-poor', 'poor', 'poor-to-fair', 'fair', 'fair-to-good', 'good'];
  const RATING_COLORS = ['#1c1c1e', '#ff453a', '#ff9f0a', '#ffd60a', '#ffd60a', '#30d158', '#30d158'];

  // Map Surfline ratingKey to our color/class system
  const SL_RATING_MAP = {
    'FLAT':          { color: '#1c1c1e', cls: 'flat', idx: 0 },
    'VERY_POOR':     { color: '#ff453a', cls: 'very-poor', idx: 1 },
    'POOR':          { color: '#ff9f0a', cls: 'poor', idx: 2 },
    'POOR_TO_FAIR':  { color: '#ffd60a', cls: 'poor-to-fair', idx: 3 },
    'FAIR':          { color: '#a8d844', cls: 'fair', idx: 4 },
    'FAIR_TO_GOOD':  { color: '#30d158', cls: 'fair-to-good', idx: 5 },
    'GOOD':          { color: '#0a84ff', cls: 'good', idx: 6 },
    'GOOD_TO_EPIC':  { color: '#0a84ff', cls: 'good', idx: 6 },
    'EPIC':          { color: '#0a84ff', cls: 'good', idx: 6 }
  };

  // Interpolate hex colors
  function lerpColor(c1, c2, t) {
    const h1 = parseInt(c1.slice(1), 16), h2 = parseInt(c2.slice(1), 16);
    const r1 = (h1 >> 16) & 0xff, g1 = (h1 >> 8) & 0xff, b1 = h1 & 0xff;
    const r2 = (h2 >> 16) & 0xff, g2 = (h2 >> 8) & 0xff, b2 = h2 & 0xff;
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const bl = Math.round(b1 + (b2 - b1) * t);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  // Continuous color from rating value
  // 0=dark, 1=red, 2=orange, 3=yellow, 4=yellow, 5=green, 6=green
  const COLOR_STOPS = [
    [0, '#1c1c1e'], [1, '#ff453a'], [2, '#ff9f0a'], [3, '#ffd60a'],
    [4, '#a8d844'], [5, '#30d158'], [6, '#0a84ff']
  ];

  function ratingToColor(val) {
    if (val <= 0) return COLOR_STOPS[0][1];
    if (val >= 6) return COLOR_STOPS[6][1];
    for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
      if (val >= COLOR_STOPS[i][0] && val <= COLOR_STOPS[i + 1][0]) {
        const t = (val - COLOR_STOPS[i][0]) / (COLOR_STOPS[i + 1][0] - COLOR_STOPS[i][0]);
        return lerpColor(COLOR_STOPS[i][1], COLOR_STOPS[i + 1][1], t);
      }
    }
    return '#1c1c1e';
  }

  function getRatingInfo(h) {
    if (h && h.ratingKey && SL_RATING_MAP[h.ratingKey]) {
      const m = SL_RATING_MAP[h.ratingKey];
      const val = (h.rating != null) ? h.rating : m.idx;
      return { color: ratingToColor(val), cls: m.cls, idx: m.idx, label: h.ratingKey.replace(/_/g, ' ') };
    }
    const val = (h && h.rating) || 0;
    const clamped = Math.max(0, Math.min(6, Math.round(val)));
    return { color: ratingToColor(val), cls: RATING_CLASSES[clamped], idx: clamped, label: RATING_LABELS[clamped] };
  }
  const DOT_CLASSES = ['', 'very-poor', 'poor', 'poor', 'fair', 'good', 'good'];

  const REFRESH_INTERVAL = 15 * 60 * 1000;
  let slToken = null;

  async function getSLToken() {
    if (slToken) return slToken;
    try {
      const r = await fetch('/api/sl-config');
      const d = await r.json();
      slToken = d.t;
      return slToken;
    } catch (e) { return null; }
  }

  // Known Surfline camera mappings for our spots
  // Still images on camstills CDN can be loaded as <img> (no CORS)
  // Stream URLs need hls.js
  // Verified Surfline camera map (from spots/reports API via d.spot.cameras)
  const S = 'https://hls.cdn-surfline.com/oregon/';
  const SPOT_CAMS = {
    '5842041f4e65fad6a7708832': [ // Oceanside Harbor
      { alias: 'wc-osideharbornjetty', title: 'North Jetty', stream: S+'wc-osideharbornjetty/playlist.m3u8' },
      { alias: 'wc-osideharbor', title: 'Harbor', stream: S+'wc-osideharbor/playlist.m3u8' },
      { alias: 'wc-osideharborsjetty', title: 'South Jetty', stream: S+'wc-osideharborsjetty/playlist.m3u8' }
    ],
    '584204204e65fad6a7709435': [ // Oceanside Pier
      { alias: 'wc-oceansidepierns', title: 'Pier Northside', stream: S+'wc-oceansidepierns/playlist.m3u8' },
      { alias: 'wc-osidepiernsov', title: 'Pier North Overview', stream: S+'wc-osidepiernsov/playlist.m3u8' },
      { alias: 'wc-osidepierssov', title: 'Pier South Overview', stream: S+'wc-osidepierssov/playlist.m3u8' },
      { alias: 'wc-osidessov', title: 'Southside Overview', stream: S+'wc-osidessov/playlist.m3u8' },
      { alias: 'wc-oceansidepierss', title: 'Pier Southside', stream: S+'wc-oceansidepierss/playlist.m3u8' }
    ],
    '5842041f4e65fad6a7708837': [ // Tamarack
      { alias: 'wc-tamarack', title: 'Tamarack', stream: S+'wc-tamarack/playlist.m3u8' }
    ],
    '5842041f4e65fad6a77088a6': [ // Terra Mar
      { alias: 'wc-terramarpt', title: 'Terra Mar Point', stream: S+'wc-terramarpt/playlist.m3u8' }
    ],
    '5842041f4e65fad6a77088a5': [ // Ponto
      { alias: 'wc-pontonorth', title: 'Ponto North', stream: S+'wc-pontonorth/playlist.m3u8' },
      { alias: 'wc-pontojetties', title: 'Ponto Jetties', stream: S+'wc-pontojetties/playlist.m3u8' },
      { alias: 'wc-pontosouth', title: 'Ponto South', stream: S+'wc-pontosouth/playlist.m3u8' },
      { alias: 'wc-pontosouthov', title: 'Ponto South Overview', stream: S+'wc-pontosouthov/playlist.m3u8' }
    ],
    '5842041f4e65fad6a770889f': [ // Grandview
      { alias: 'wc-grandview', title: 'Grandview', stream: S+'wc-grandview/playlist.m3u8' },
      { alias: 'wc-grandviewsouth', title: 'Grandview South', stream: S+'wc-grandviewsouth/playlist.m3u8' }
    ],
    '5842041f4e65fad6a77088a0': [ // Beacons
      { alias: 'wc-beacons', title: 'Beacons', stream: S+'wc-beacons/playlist.m3u8' },
      { alias: 'wc-beaconsnorth', title: 'Beacons North', stream: S+'wc-beaconsnorth/playlist.m3u8' }
    ],
    '5842041f4e65fad6a77088b7': [ // D Street
      { alias: 'wc-dstreet', title: 'D Street', stream: S+'wc-dstreet/playlist.m3u8' }
    ],
    '5842041f4e65fad6a77088b4': [ // Swamis
      { alias: 'wc-swamis', title: "Swami's", stream: S+'wc-swamis/playlist.m3u8' },
      { alias: 'wc-swamisclose', title: "Swami's Close-Up", stream: S+'wc-swamisclose/playlist.m3u8' }
    ],
    '5c008f5313603c0001df5318': [ // Pipes
      { alias: 'wc-pipes', title: 'Pipes', stream: S+'wc-pipes/playlist.m3u8' }
    ],
    '5842041f4e65fad6a77088b1': [ // Cardiff Reef
      { alias: 'wc-cardiffov', title: 'Cardiff Overview', stream: S+'wc-cardiffov/playlist.m3u8' },
      { alias: 'wc-cardiffreefsouth', title: 'Cardiff South', stream: S+'wc-cardiffreefsouth/playlist.m3u8' },
      { alias: 'wc-cardiffreefnorth', title: 'Cardiff North', stream: S+'wc-cardiffreefnorth/playlist.m3u8' }
    ],
    '5842041f4e65fad6a77088b3': [ // Seaside Reef
      { alias: 'wc-seasidereef', title: 'Seaside Reef', stream: S+'wc-seasidereef/playlist.m3u8' }
    ],
    // Del Mar Rivermouth: no cameras
    '5842041f4e65fad6a77088af': [ // 15th Street Del Mar
      { alias: 'wc-delmar15th', title: '15th St Del Mar', stream: S+'wc-delmar15th/playlist.m3u8' },
      { alias: 'wc-delmar', title: 'Del Mar', stream: S+'wc-delmar/playlist.m3u8' },
      { alias: 'wc-delmarbeachbreak', title: 'Del Mar Beachbreak', stream: S+'wc-delmarbeachbreak/playlist.m3u8' },
      { alias: 'wc-delmar25th', title: '25th St Del Mar', stream: S+'wc-delmar25th/playlist.m3u8' }
    ]
  };

  function getCamStillUrl(alias) {
    return `https://camstills.cdn-surfline.com/us-west-2/${alias}/latest_full.jpg`;
  }

  function getCamPixelatedUrl(alias) {
    return `https://camstills.cdn-surfline.com/${alias}/latest_small_pixelated.png`;
  }

  async function loadForecastText() {
    try {
      const r = await fetch('/api/forecast-text', { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 8000); return c.signal; })() });
      const d = await r.json();
      if (!d.headline) return;
      const el = document.getElementById('forecast-text');
      el.innerHTML = `
        <div class="forecast-headline"><svg class="forecast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2"/><line x1="10" y1="6" x2="18" y2="6"/><line x1="10" y1="10" x2="18" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/></svg>${d.headline}</div>
        <div class="forecast-observation">${d.observation}</div>
`;
    } catch (e) { /* no forecast text */ }
  }

  // Check for synced Surfline data and overlay it
  async function loadSurflineOverlay() {
    try {
      const r = await fetch('/api/surfline-data');
      const d = await r.json();
      if (!d.synced || !d.spots) return;

      // Update rating badges with Surfline's actual ratings
      const SL_LABELS = { FLAT: 'FLAT', VERY_POOR: 'VERY POOR', POOR: 'POOR', POOR_TO_FAIR: 'POOR TO FAIR', FAIR: 'FAIR', FAIR_TO_GOOD: 'FAIR TO GOOD', GOOD: 'GOOD', GOOD_TO_EPIC: 'EPIC', EPIC: 'EPIC' };
      const SL_TO_NUM = { FLAT: 0, VERY_POOR: 1, POOR: 2, POOR_TO_FAIR: 3, FAIR: 4, FAIR_TO_GOOD: 5, GOOD: 6, GOOD_TO_EPIC: 6, EPIC: 6 };

      console.log('Surfline overlay: data for', Object.keys(d.spots).length, 'spots');
    } catch (e) { /* no surfline data, that's fine */ }
  }

  function degToCompass(deg) {
    if (deg == null || isNaN(deg)) return '—';
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  function formatPacificTime(date) {
    return date.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  }

  function formatHour(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour: 'numeric', hour12: true
    });
  }

  // Find the hourly entry closest to now
  function getCurrentHour(hourly) {
    if (!hourly || !hourly.length) return null;
    const now = Date.now() / 1000;
    let closest = hourly[0];
    for (const h of hourly) {
      if (Math.abs(h.timestamp - now) < Math.abs(closest.timestamp - now)) {
        closest = h;
      }
    }
    return closest;
  }

  // Get next N hours from now
  function getNextHours(hourly, hours) {
    if (!hourly || !hourly.length) return [];
    const now = Date.now() / 1000;
    const end = now + hours * 3600;
    return hourly.filter(h => h.timestamp >= now - 1800 && h.timestamp <= end);
  }

  // --- Render buoy ---
  function renderBuoy(data) {
    const bar = document.getElementById('buoy-bar');
    const stats = document.getElementById('buoy-stats');
    if (!data || data.error) { bar.classList.add('hidden'); return; }
    bar.classList.remove('hidden');

    const items = [];
    if (data.waveHeight) items.push({ label: 'Wave Ht', value: `${data.waveHeight} ft`, icon: 'waves' });
    if (data.dominantPeriod) items.push({ label: 'Period', value: `${data.dominantPeriod}s`, icon: 'timer' });
    if (data.waveDirection != null) items.push({ label: 'Direction', value: `${data.waveDirection}° ${degToCompass(data.waveDirection)}`, icon: 'compass' });
    if (data.waterTemp) items.push({ label: 'Water', value: `${data.waterTemp}°F`, icon: 'thermometer' });
    if (data.windSpeed) items.push({ label: 'Wind', value: `${data.windSpeed} kts ${degToCompass(data.windDir)}`, icon: 'wind' });

    stats.innerHTML = items.map(i =>
      `<div class="buoy-stat"><i data-lucide="${i.icon}" class="buoy-icon"></i><span class="label">${i.label}</span><span class="value">${i.value}</span></div>`
    ).join('');
    if (window.lucide) lucide.createIcons();
  }

  // --- Render spot card ---
  function renderSpotCard(spot) {
    const card = document.createElement('div');
    card.className = 'spot-card';

    if (!spot.forecast || !spot.forecast.hourly || !spot.forecast.hourly.length) {
      card.classList.add('unavailable');
      card.innerHTML = `
        <div class="card-header">
          <div class="spot-name">${spot.name}</div>
          <span class="rating-badge rating-flat">Unavailable</span>
        </div>
        <p style="color:var(--gray);font-size:0.8rem;">Data currently unavailable</p>`;
      return { card, rating: -1 };
    }

    const current = getCurrentHour(spot.forecast.hourly);
    const ri = getRatingInfo(current);
    const ratingVal = ri.idx;
    const ratingLabel = ri.label;
    const ratingClass = ri.cls;
    const dotClass = DOT_CLASSES[Math.min(ratingVal, 6)] || '';

    const slug = slugify(spot.name);
    const surflineUrl = `https://www.surfline.com/surf-report/${slug}/${spot.id}`;
    const camUrl = `https://www.surfline.com/surf-report/${slug}/${spot.id}#cam`;

    // Wave info — use Surfline min/max if available
    let waveStr = '—';
    if (current && current.waveMin != null && current.waveMax != null && current.source === 'surfline') {
      const min = Math.round(current.waveMin);
      const max = Math.round(current.waveMax);
      if (max < 1) waveStr = '< 1 ft';
      else waveStr = min === max ? `${max} ft` : `${min}–${max} ft`;
    } else if (current && current.waveHeight != null) {
      const min = Math.max(0, current.waveHeight - 0.5).toFixed(0);
      const max = (current.waveHeight + 0.5).toFixed(0);
      if (current.waveHeight < 0.5) {
        waveStr = '< 1 ft';
      } else {
        waveStr = `${min}–${max} ft`;
      }
    }

    // Swell info
    let swellStr = '';
    if (current && current.wavePeriod) {
      swellStr = `@ ${current.wavePeriod.toFixed(0)}s`;
      if (current.swellDir != null) {
        swellStr += ` ${degToCompass(current.swellDir)}`;
      }
    }

    // Wind info
    let windStr = '—';
    if (current && current.windSpeed != null) {
      const speed = current.windSpeed.toFixed(0);
      const dir = degToCompass(current.windDir);
      windStr = `${speed} kts ${dir}`;
    }

    // Rating dots
    let dotsHtml = '';
    for (let i = 0; i < 6; i++) {
      const filled = i < ratingVal;
      dotsHtml += `<div class="rating-dot${filled ? ` filled ${dotClass}` : ''}"></div>`;
    }

    // Timeline (next 48h)
    const timeline = getNextHours(spot.forecast.hourly, 48);
    let timelineHtml = '';
    if (timeline.length > 0) {
      // Build gradient stops from rating colors
      const colors = timeline.map(h => getRatingInfo(h).color);
      const stops = colors.map((c, i) => `${c} ${((i / (colors.length - 1)) * 100).toFixed(1)}%`).join(', ');
      const gradient = `linear-gradient(to right, ${stops})`;

      // Build time labels
      const timeLabels = timeline.map((h, i) => {
        const d = new Date(h.time);
        const hr = parseInt(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
        if (hr % 6 !== 0) return '';
        const pct = (i / (timeline.length - 1)) * 100;
        const time = formatHour(h.time);
        return `<span class="tl-time-abs" style="left:${pct.toFixed(1)}%">${time}</span>`;
      }).join('');

      // Build invisible hover segments for tooltips
      const hoverSegs = timeline.map((h, i) => {
        const rInfo = getRatingInfo(h);
        const time = formatHour(h.time);
        let ht = '';
        if (h.waveMin != null && h.waveMax != null && h.source === 'surfline') {
          ht = `${Math.round(h.waveMin)}-${Math.round(h.waveMax)}ft`;
        } else if (h.waveHeight != null) {
          ht = h.waveHeight.toFixed(1) + 'ft';
        }
        return `<div class="tl-hover-seg" data-tip="${time}: ${rInfo.label} ${ht}"></div>`;
      }).join('');

      timelineHtml = `
        <div class="timeline-label">Quality (48h)</div>
        <div class="forecast-timeline-blend">
          <div class="tl-gradient" style="background:${gradient}"></div>
          <div class="tl-hover-layer">${hoverSegs}</div>
          <div class="tl-time-layer">${timeLabels}</div>
        </div>`;
    }

    card.innerHTML = `
      <div class="rank-number"></div>
      <div class="card-header">
        <div class="spot-name"><a href="${surflineUrl}" target="_blank">${spot.name}</a></div>
        <span class="rating-badge rating-${ratingClass}">${ratingLabel}</span>
      </div>
      <div class="rating-dots">${dotsHtml}</div>
      <div class="card-stats">
        <div class="stat"><svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg><span class="stat-value">${waveStr}</span></div>
        ${swellStr ? `<div class="stat"><i data-lucide="activity" class="stat-icon"></i><span class="stat-value">${swellStr}</span></div>` : ''}
        <div class="stat"><i data-lucide="wind" class="stat-icon"></i><span class="stat-value">${windStr}</span></div>
      </div>
      <div class="sl-conditions" data-spot-id="${spot.id}"></div>
      ${timelineHtml}
      <div class="cam-area" data-spot-id="${spot.id}"></div>`;

    return { card, rating: ratingVal };
  }

  // --- Load data ---
  async function loadData() {
    const loading = document.getElementById('loading');
    const grid = document.getElementById('spots-grid');

    loading.classList.remove('hidden');
    grid.innerHTML = '';

    try {
      const fetchWithTimeout = (url, ms = 12000) => {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), ms);
        return fetch(url, { signal: ctrl.signal }).then(r => { clearTimeout(id); return r.json(); });
      };

      const [forecastRes, buoyRes] = await Promise.all([
        fetchWithTimeout('/api/forecasts', 12000),
        fetchWithTimeout('/api/buoy', 8000).catch(() => null)
      ]);

      renderBuoy(buoyRes);

      const spots = forecastRes.spots || [];

      // Render all cards, collect with rating for sorting
      const cards = spots.map(spot => renderSpotCard(spot));

      // Sort by rating (best first)
      cards.sort((a, b) => b.rating - a.rating);
      cards.forEach(({ card }, i) => {
        const rankEl = card.querySelector('.rank-number');
        if (rankEl) rankEl.textContent = i + 1;
        grid.appendChild(card);
      });

      if (window.lucide) lucide.createIcons();

    } catch (e) {
      console.error('Failed to load data:', e);
      grid.innerHTML = '<p style="text-align:center;color:var(--gray);padding:2rem;">Failed to load forecast data. Will retry...</p>';
    } finally {
      loading.classList.add('hidden');
    }
  }


  // --- Load Surfline data (cams from hardcoded map, conditions via API) ---
  async function loadSurflineData() {
    // 1. Build cam carousels immediately from hardcoded map (no API needed)
    const camAreas = document.querySelectorAll('.cam-area[data-spot-id]');
    camAreas.forEach(camEl => {
      const spotId = camEl.dataset.spotId;
      const cams = SPOT_CAMS[spotId];
      if (!cams || cams.length === 0) return;

      const slides = cams.map((cam, idx) => {
        const still = getCamStillUrl(cam.alias);
        return `<div class="cam-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-stream="${cam.stream}">
          <img src="${still}" alt="${cam.title}" class="cam-still" loading="lazy" referrerpolicy="no-referrer"
               data-fallback="${getCamPixelatedUrl(cam.alias)}"
               onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src=this.dataset.fallback}else{this.closest('.cam-slide').remove();var c=this.closest('.cam-carousel');if(c&&!c.querySelector('.cam-slide'))c.parentElement.style.display='none'}">
          <div class="cam-title">${cam.title}</div>
          ${cam.stream ? '<div class="cam-play"><i data-lucide="play" class="play-icon"></i></div>' : ''}
        </div>`;
      }).join('');

      const arrows = cams.length > 1 ? `
        <button class="cam-arrow cam-arrow-left" data-dir="-1"><i data-lucide="chevron-left"></i></button>
        <button class="cam-arrow cam-arrow-right" data-dir="1"><i data-lucide="chevron-right"></i></button>
        <div class="cam-dots">${cams.map((_, idx) => `<span class="cam-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>`).join('')}</div>
      ` : '';

      camEl.innerHTML = `<div class="cam-carousel">${slides}${arrows}</div>`;
    });
    if (window.lucide) lucide.createIcons();

    // Surfline conditions API is CORS-blocked from our domain
  }

  // --- Cam carousel navigation ---
  document.addEventListener('click', async function(e) {
    const arrow = e.target.closest('.cam-arrow');
    if (arrow) {
      e.stopPropagation();
      const carousel = arrow.closest('.cam-carousel');
      const slides = carousel.querySelectorAll('.cam-slide');
      const dots = carousel.querySelectorAll('.cam-dot');
      const current = carousel.querySelector('.cam-slide.active');
      const currentIdx = parseInt(current.dataset.index);
      const dir = parseInt(arrow.dataset.dir);
      const nextIdx = (currentIdx + dir + slides.length) % slides.length;

      const video = current.querySelector('video');
      if (video) { if (video._hls) video._hls.destroy(); video.remove(); current.querySelector('.cam-still').style.display = ''; }

      current.classList.remove('active');
      slides[nextIdx].classList.add('active');
      dots.forEach(d => d.classList.toggle('active', parseInt(d.dataset.index) === nextIdx));
      return;
    }

    const dot = e.target.closest('.cam-dot');
    if (dot) {
      e.stopPropagation();
      const carousel = dot.closest('.cam-carousel');
      const slides = carousel.querySelectorAll('.cam-slide');
      const dots = carousel.querySelectorAll('.cam-dot');
      const targetIdx = parseInt(dot.dataset.index);
      const current = carousel.querySelector('.cam-slide.active');
      const video = current.querySelector('video');
      if (video) { if (video._hls) video._hls.destroy(); video.remove(); current.querySelector('.cam-still').style.display = ''; }
      current.classList.remove('active');
      slides[targetIdx].classList.add('active');
      dots.forEach(d => d.classList.toggle('active', parseInt(d.dataset.index) === targetIdx));
      return;
    }
  });

  // --- Live stream player ---
  document.addEventListener('click', async function(e) {
    const playBtn = e.target.closest('.cam-play');
    if (!playBtn) return;
    e.stopPropagation();

    const slide = playBtn.closest('.cam-slide');
    if (!slide) return;
    const streamUrl = slide.dataset.stream;
    if (!streamUrl) return;

    // If already playing, toggle back to still
    const existingVideo = slide.querySelector('video');
    if (existingVideo) {
      if (existingVideo._hls) existingVideo._hls.destroy();
      existingVideo.remove();
      slide.querySelector('.cam-still').style.display = '';
      playBtn.innerHTML = '<i data-lucide="play" class="play-icon"></i>';
      if (window.lucide) lucide.createIcons();
      return;
    }

    const img = slide.querySelector('.cam-still');
    const imgHeight = img.offsetHeight;
    const video = document.createElement('video');
    video.className = 'cam-video';
    video.style.minHeight = imgHeight + 'px';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = true;

    // Append auth token to stream URL
    const token = await getSLToken();
    const authedStream = streamUrl + (streamUrl.includes('?') ? '&' : '?') + 'accesstoken=' + (token || '');

    // Safari/iOS: native HLS support (no CORS issues)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = authedStream;
    } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        xhrSetup: function(xhr) {
          // Let the CDN handle auth via URL token
        }
      });
      hls.on(Hls.Events.ERROR, function(event, data) {
        if (data.fatal) {
          console.warn('HLS fatal error:', data.type, data.details);
          hls.destroy();
          video.remove();
          img.style.display = '';
          playBtn.innerHTML = '<i data-lucide="play" class="play-icon"></i>';
          if (window.lucide) lucide.createIcons();
        }
      });
      hls.loadSource(authedStream);
      hls.attachMedia(video);
      video._hls = hls;
    } else {
      window.open(authedStream, '_blank');
      return;
    }

    img.style.display = 'none';
    slide.insertBefore(video, img);
    playBtn.innerHTML = '<i data-lucide="square" class="play-icon"></i>';
    if (window.lucide) lucide.createIcons();
  });

  // --- Tide chart ---
  let tideHourlyData = null; // Store for hover lookup

  async function loadTides() {
    try {
      const res = await fetch('/api/tides', { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() });
      const data = await res.json();
      if (!data.hourly || !data.hilo) return;

      const now = Date.now() / 1000;
      const end = now + 48 * 3600;
      const hourly = data.hourly.filter(t => t.timestamp >= now - 3600 && t.timestamp <= end);
      const hilo = data.hilo.filter(t => t.timestamp >= now - 3600 && t.timestamp <= end);

      if (hourly.length === 0) return;
      tideHourlyData = hourly;

      const heights = hourly.map(t => t.height);
      const minH = Math.min(...heights);
      const maxH = Math.max(...heights);
      const range = maxH - minH || 1;

      // Build SVG path
      const w = 300, h = 32, pad = 2;
      const pointsArr = hourly.map((t, i) => {
        const x = (i / (hourly.length - 1)) * w;
        const y = pad + (1 - (t.height - minH) / range) * (h - pad * 2);
        return { x, y };
      });
      const pathD = 'M' + pointsArr.map(p => `${p.x},${p.y}`).join(' L');
      const fillD = pathD + ` L${w},${h} L0,${h} Z`;



      const labels = '';

      // Now marker position
      const nowPct = Math.max(0, Math.min(100, ((now - hourly[0].timestamp) / (hourly[hourly.length - 1].timestamp - hourly[0].timestamp)) * 100));
      const nowX = (nowPct / 100) * w;

      // Hover elements: invisible rect + cursor line + dot + tooltip
      // Zero (sea level) line — only if 0ft falls within the visible range
      const zeroY = pad + (1 - (0 - minH) / range) * (h - pad * 2);
      const zeroLineHtml = (minH <= 0 && 0 <= minH + range)
        ? `<line x1="0" y1="${zeroY.toFixed(1)}" x2="${w}" y2="${zeroY.toFixed(1)}" class="tide-zero-line"/>`
        : '';

      const svg = `<svg viewBox="0 0 ${w} ${h}" class="tide-svg" preserveAspectRatio="none"
                        data-w="${w}" data-h="${h}" data-pad="${pad}" data-min="${minH}" data-range="${range}" data-count="${hourly.length}">
        <path d="${fillD}" class="tide-fill"/>
        <path d="${pathD}" class="tide-line"/>
        ${zeroLineHtml}
        <line x1="${nowX}" y1="0" x2="${nowX}" y2="${h}" class="tide-now-line"/>

        <line class="tide-hover-line" x1="0" y1="0" x2="0" y2="${h}" style="display:none"/>
        <rect class="tide-hover-zone" x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
      </svg>
      <div class="tide-hover-dot-html" style="display:none"></div>
      <div class="tide-tooltip" style="display:none"></div>`;

      // Current tide height
      let currentHeight = heights[0];
      let currentType = '';
      for (let i = 0; i < hourly.length; i++) {
        if (hourly[i].timestamp >= now) { currentHeight = hourly[i].height; break; }
      }
      const nextHL = hilo.find(t => t.timestamp > now);
      if (nextHL) {
        currentType = nextHL.type === 'H' ? 'Rising' : 'Falling';
      }

      const tideHtml = `
        <div class="tide-label-row">
          <span class="timeline-label">Tide (48h)</span>
          <span class="tide-current">${currentHeight.toFixed(1)}ft ${currentType}</span>
        </div>
        <div class="tide-chart-wrap">
          ${svg}
        </div>`;

      document.getElementById('tide-global').innerHTML = tideHtml;
    } catch (e) { console.warn('Tide load failed', e); }
  }

  // --- Tide hover handler ---
  document.addEventListener('mousemove', function(e) {
    const zone = e.target.closest('.tide-hover-zone');
    if (!zone || !tideHourlyData) return;
    const svg = zone.closest('.tide-svg');
    const wrap = svg.closest('.tide-chart-wrap');
    const tooltip = wrap.querySelector('.tide-tooltip');
    const rect = svg.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const w = parseFloat(svg.dataset.w);
    const h = parseFloat(svg.dataset.h);
    const pad = parseFloat(svg.dataset.pad);
    const minH = parseFloat(svg.dataset.min);
    const range = parseFloat(svg.dataset.range);
    const count = tideHourlyData.length;

    const idx = pct * (count - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, count - 1);
    const frac = idx - i0;

    const t = tideHourlyData[i0];
    const t1 = tideHourlyData[i1];
    const height = t.height + (t1.height - t.height) * frac;
    const timestamp = t.timestamp + (t1.timestamp - t.timestamp) * frac;

    const x = pct * w;
    const y = pad + (1 - (height - minH) / range) * (h - pad * 2);

    const line = svg.querySelector('.tide-hover-line');
    const dot = wrap.querySelector('.tide-hover-dot-html');
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    line.style.display = '';
    const yPct = (y / h) * 100;
    dot.style.left = (pct * 100) + '%';
    dot.style.top = yPct + '%';
    dot.style.display = '';

    const timeStr = new Date(timestamp * 1000).toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit', hour12: true
    });

    tooltip.textContent = `${timeStr}  ${height.toFixed(1)} ft`;
    tooltip.style.display = '';
    const tipPct = (e.clientX - rect.left) / rect.width * 100;
    tooltip.style.left = Math.max(10, Math.min(90, tipPct)) + '%';
  });

  document.addEventListener('mouseleave', function(e) {
    if (e.target.closest && e.target.closest('.tide-hover-zone')) {
      const svg = e.target.closest('.tide-svg');
      const wrap = svg.closest('.tide-chart-wrap');
      svg.querySelector('.tide-hover-line').style.display = 'none';
      wrap.querySelector('.tide-hover-dot-html').style.display = 'none';
      wrap.querySelector('.tide-tooltip').style.display = 'none';
    }
  }, true);

  document.addEventListener('mouseout', function(e) {
    const zone = e.target.closest('.tide-hover-zone');
    if (zone && !zone.contains(e.relatedTarget)) {
      const svg = zone.closest('.tide-svg');
      const wrap = svg.closest('.tide-chart-wrap');
      svg.querySelector('.tide-hover-line').style.display = 'none';
      wrap.querySelector('.tide-hover-dot-html').style.display = 'none';
      wrap.querySelector('.tide-tooltip').style.display = 'none';
    }
  });

  // --- Tab switching ---
  let diveLoaded = false;

  function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'tab-' + tab);
      p.classList.toggle('hidden', p.id !== 'tab-' + tab);
    });
    if (tab === 'dive' && !diveLoaded) {
      diveLoaded = true;
      loadDiveData();
    }
    // Update URL hash without scrolling
    history.replaceState(null, '', tab === 'surf' ? location.pathname : '#' + tab);
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Open tab from URL hash on load
  const hashTab = location.hash.replace('#', '');
  if (hashTab === 'dive') switchTab('dive');

  // --- Format viz as feet + inches ---
  function fmtViz(ft) {
    const wholeFt = Math.floor(ft);
    const inches = Math.round((ft - wholeFt) * 12);
    if (inches === 0) return `${wholeFt} ft`;
    if (inches === 12) return `${wholeFt + 1} ft`;
    return `${wholeFt} ft ${inches} in`;
  }

  // --- Dive helpers ---
  function diveRatingColor(rating) {
    const colors = ['#1c1c1e', '#ff453a', '#ff9f0a', '#ffd60a', '#a8d844', '#30d158'];
    return colors[Math.max(0, Math.min(5, rating))] || '#1c1c1e';
  }

  function diveRatingClass(rating) {
    const cls = ['flat', 'very-poor', 'poor', 'poor-to-fair', 'fair', 'good'];
    return cls[Math.max(0, Math.min(5, rating))] || 'flat';
  }

  function currentStrength(ms) {
    if (ms == null) return '—';
    const kts = ms * 1.944;
    if (kts < 0.1) return 'Slack';
    if (kts < 0.3) return 'Light';
    if (kts < 0.7) return 'Moderate';
    if (kts < 1.2) return 'Strong';
    return 'Very Strong';
  }

  function renderDiveSpotCard(spot) {
    const c = spot.current;
    const ratingClass = diveRatingClass(c.diveRating);
    const ratingColor = diveRatingColor(c.diveRating);

    const swellStr = c.swellHeightFt != null
      ? `${c.swellHeightFt.toFixed(1)} ft ${c.swellDir != null ? degToCompass(c.swellDir) : ''}`
      : '—';

    const currentStr = currentStrength(c.currentVelocityMs);
    const currentDirStr = c.currentDir != null ? ` ${degToCompass(c.currentDir)}` : '';

    const vizBarWidth = Math.min(100, Math.round((c.vizFt / 40) * 100));

    return `
      <div class="dive-spot-card">
        <div class="dive-card-header">
          <div class="dive-spot-name">${spot.name}</div>
          <span class="rating-badge rating-${ratingClass}">${c.diveLabel}</span>
        </div>
        <div class="dive-spot-desc">${spot.desc}</div>
        <div class="dive-stats">
          <div class="dive-stat">
            <span class="dive-stat-label">Visibility</span>
            <span class="dive-stat-value">${c.vizFt} ft</span>
            <div class="viz-bar-track"><div class="viz-bar-fill" style="width:${vizBarWidth}%;background:${ratingColor}"></div></div>
          </div>
          <div class="dive-stat">
            <span class="dive-stat-label">Swell</span>
            <span class="dive-stat-value">${swellStr}</span>
          </div>
          <div class="dive-stat">
            <span class="dive-stat-label">Current</span>
            <span class="dive-stat-value">${currentStr}${currentDirStr}</span>
          </div>
        </div>
      </div>`;
  }

  function renderDiveTimeline(timeline, cameraViz) {
    if (!timeline || timeline.length === 0) return '';

    const now = Date.now() / 1000;
    const t24 = timeline.filter(t => t.timestamp >= now - 1800 && t.timestamp <= now + 24 * 3600);
    if (t24.length === 0) return '';

    // Find current hour swell as baseline
    const currentEntry = t24.reduce((best, t) => Math.abs(t.timestamp - now) < Math.abs(best.timestamp - now) ? t : best, t24[0]);
    const baseSwell = Math.max(currentEntry.swellHeightFt || 0.1, 0.1);

    // Anchor to camera viz if available, else use physics estimate for current hour
    const baseVizFt = cameraViz ? cameraViz.vizFt : (currentEntry.vizFt || 15);

    // Scale each hour's viz relative to current swell
    // viz scales inversely with swell: viz_t = baseViz * (baseSwell / swell_t)^0.7
    // exponent < 1 softens the curve (swell doubling doesn't halve viz instantly)
    const scaled = t24.map(t => {
      const swell = Math.max(t.swellHeightFt || 0.1, 0.1);
      const scaledViz = Math.round(baseVizFt * Math.pow(baseSwell / swell, 0.7));
      const clampedViz = Math.max(3, Math.min(40, scaledViz));
      // Map viz to dive rating
      let diveRating;
      if (clampedViz >= 30) diveRating = 5;
      else if (clampedViz >= 20) diveRating = 4;
      else if (clampedViz >= 12) diveRating = 3;
      else if (clampedViz >= 7)  diveRating = 2;
      else                       diveRating = 1;
      return { ...t, projectedVizFt: clampedViz, projectedRating: diveRating };
    });

    const colors = scaled.map(t => diveRatingColor(t.projectedRating));
    const stops = colors.map((c, i) => `${c} ${((i / (colors.length - 1)) * 100).toFixed(1)}%`).join(', ');
    const gradient = `linear-gradient(to right, ${stops})`;

    const timeLabels = scaled.map((t, i) => {
      const d = new Date(t.time);
      const hr = parseInt(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
      if (hr % 6 !== 0) return '';
      const pct = (i / (scaled.length - 1)) * 100;
      return `<span class="tl-time-abs" style="left:${pct.toFixed(1)}%">${formatHour(t.time)}</span>`;
    }).join('');

    const hoverSegs = scaled.map(t => {
      const time = formatHour(t.time);
      return `<div class="tl-hover-seg" data-tip="${time}: ~${t.projectedVizFt} ft viz"></div>`;
    }).join('');

    

    return `
      <div class="dive-timeline-wrap">
        <div class="timeline-label">Visibility forecast (24h)</div>
        <div class="forecast-timeline-blend">
          <div class="tl-gradient" style="background:${gradient}"></div>
          <div class="tl-hover-layer">${hoverSegs}</div>
          <div class="tl-time-layer">${timeLabels}</div>
        </div>
      </div>`;
  }

  // --- Scripps cam ---
  async function loadScrippsCam() {
    const container = document.getElementById('scripps-cam-container');
    if (!container) return;
    try {
      const data = await fetch('/api/scripps-cam', { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 10000); return c.signal; })() }).then(r => r.json());
      if (data.error || !data.streamUrl) {
        container.innerHTML = `<div class="scripps-cam-error">Live cam unavailable — <a href="https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/" target="_blank">watch on HDOnTap</a></div>`;
        return;
      }

      // Autoplay muted (browsers allow muted autoplay; user can unmute via controls)
      // Piling overlay positions (% of video width/height)
      const PILINGS = [
        { id: 'p1', label: '4 ft',  x: 95, y: 52, dist: '1.2m' },
        { id: 'p2', label: '11 ft', x: 78, y: 38, dist: '3.4m' },
        { id: 'p3', label: '14 ft', x: 21, y: 28, dist: '4.3m' },
        { id: 'p4', label: '30 ft', x: 44, y: 35, dist: '9m'   }
      ];

      const pilingHtml = PILINGS.map(p => `
        <div class="piling-label" id="${p.id}" style="left:${p.x}%;top:${p.y}%">
          <div class="piling-dot"></div>
          <div class="piling-tag">${p.label}</div>
        </div>`).join('');

      container.innerHTML = `
        <div class="scripps-cam-wrap" id="scripps-cam-wrap">
          <video id="scripps-video" class="scripps-video" playsinline controls muted></video>
          <div class="piling-overlay" id="piling-overlay">${pilingHtml}</div>
        </div>`;

      const video = document.getElementById('scripps-video');

      const onError = () => {
        container.innerHTML = `<div class="scripps-cam-error">Stream error — <a href="https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/" target="_blank">watch on HDOnTap</a></div>`;
      };

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = data.streamUrl;
        video.play().catch(onError);
      } else if (typeof Hls !== 'undefined' && Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 15 });
        hls.loadSource(data.streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
        hls.on(Hls.Events.ERROR, (event, d) => { if (d.fatal) onError(); });
      } else {
        onError();
      }

    } catch (e) {
      container.innerHTML = `<div class="scripps-cam-error">Live cam unavailable — <a href="https://hdontap.com/stream/018408/scripps-pier-underwater-live-webcam/" target="_blank">watch on HDOnTap</a></div>`;
    }
  }

  async function loadDiveData() {
    const loadingEl = document.getElementById('dive-loading');
    const contentEl = document.getElementById('dive-content');
    loadingEl.classList.remove('hidden');
    contentEl.innerHTML = '';

    try {
      const data = await fetch('/api/dive', { signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15000); return c.signal; })() }).then(r => r.json());

      const tempStr = data.waterTempF ? `${data.waterTempF}°F` : '—';
      const wetsuitStr = data.wetsuitRec || '—';

      // Viz: prefer camera analysis, fall back to physics estimate
      const camViz = data.cameraViz;
      const lajolla = (data.spots || []).find(s => s.name === 'La Jolla Cove');
      const vizFt = camViz ? camViz.vizFt : (lajolla ? lajolla.current.vizFt : null);
      const vizLabel = camViz ? camViz.label : (lajolla ? lajolla.current.vizLabel : null);
      const vizRating = camViz ? camViz.diveRating : (lajolla ? lajolla.current.diveRating : 0);
      const vizColor = diveRatingColor(vizRating);


      const conditionsBar = `
        <div class="dive-conditions-bar">
          ${vizFt != null ? `
          <div class="dive-cond-item">
            <span class="dive-cond-label">Visibility</span>
            <span class="dive-cond-value" style="color:${vizColor}">${fmtViz(vizFt)} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary)">${vizLabel}</span></span>
          </div>` : ''}
          ${data.buoy && data.buoy.waveHeightFt ? `
          <div class="dive-cond-item">
            <span class="dive-cond-label">Offshore Swell</span>
            <span class="dive-cond-value">${data.buoy.waveHeightFt} ft @ ${data.buoy.dominantPeriod || '—'}s</span>
          </div>` : ''}
          ${data.current ? (() => {
            const kts = (data.current.velocityMs * 1.944).toFixed(1);
            const dir = data.current.dirDeg != null ? degToCompass(data.current.dirDeg) : '';
            const strength = data.current.velocityMs < 0.1 ? 'Slack' : data.current.velocityMs < 0.3 ? 'Light' : data.current.velocityMs < 0.7 ? 'Moderate' : data.current.velocityMs < 1.2 ? 'Strong' : 'Very Strong';
            return `<div class="dive-cond-item">
              <span class="dive-cond-label">Current</span>
              <span class="dive-cond-value">${strength}${dir ? ' ' + dir : ''} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary)">${kts} kts</span></span>
            </div>`;
          })() : ''}
        </div>`;

      const timelineHtml = renderDiveTimeline(data.timeline, camViz);
      const vizHtml = '';

      contentEl.innerHTML = `<div id="scripps-cam-container" class="scripps-cam-container"><div class="scripps-cam-loading"><div class="spinner"></div><p>Loading live cam...</p></div></div>${vizHtml}` + conditionsBar + timelineHtml;
      if (window.lucide) lucide.createIcons();
      loadScrippsCam();
      // Kick off camera viz analysis in background; update viz display + re-render timeline when done
      if (!data.cameraViz) {
        fetch('/api/scripps-viz').then(r => r.json()).then(viz => {
          if (!viz || !viz.vizFt) return;
          // Update conditions bar in-place
          const vizColor2 = diveRatingColor(viz.diveRating);
          document.querySelectorAll('.dive-cond-item .dive-cond-label').forEach(el => {
            if (el.textContent.includes('Visibility')) {
              const valEl = el.closest('.dive-cond-item').querySelector('.dive-cond-value');
              if (valEl) {
                valEl.style.color = vizColor2;
                valEl.innerHTML = `${fmtViz(viz.vizFt)} <span style="font-size:0.75rem;font-weight:400;color:var(--text-secondary)">${viz.label}</span>`;
              }
              el.innerHTML = "Visibility";
            }
          });
          // Re-render timeline anchored to camera reading
          const tlWrap = document.querySelector('.dive-timeline-wrap');
          if (tlWrap) tlWrap.outerHTML = renderDiveTimeline(data.timeline, viz);
        }).catch(() => {});
      }

    } catch (e) {
      contentEl.innerHTML = '<p style="text-align:center;color:var(--gray);padding:2rem;">Failed to load dive data.</p>';
    } finally {
      loadingEl.classList.add('hidden');
    }
  }

  // --- Init ---
  loadData().then(() => { loadSurflineData(); loadTides(); loadSurflineOverlay(); loadForecastText(); });
  setInterval(loadData, REFRESH_INTERVAL);
})();
