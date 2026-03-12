(() => {
  const RATING_LABELS = ['FLAT', 'VERY POOR', 'POOR', 'POOR TO FAIR', 'FAIR', 'FAIR TO GOOD', 'GOOD'];
  const RATING_CLASSES = ['flat', 'very-poor', 'poor', 'poor-to-fair', 'fair', 'fair-to-good', 'good'];
  const RATING_COLORS = ['#1c1c1e', '#ff453a', '#ff9f0a', '#ffd60a', '#ffd60a', '#30d158', '#30d158'];
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
    const ratingVal = current ? current.rating : 0;
    const ratingLabel = RATING_LABELS[ratingVal] || 'FLAT';
    const ratingClass = RATING_CLASSES[ratingVal] || 'flat';
    const dotClass = DOT_CLASSES[ratingVal] || '';

    const slug = slugify(spot.name);
    const surflineUrl = `https://www.surfline.com/surf-report/${slug}/${spot.id}`;
    const camUrl = `https://www.surfline.com/surf-report/${slug}/${spot.id}#cam`;

    // Wave info
    let waveStr = '—';
    if (current && current.waveHeight != null) {
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
      const segments = timeline.map((h, i) => {
        const val = h.rating || 0;
        const color = RATING_COLORS[val] || RATING_COLORS[0];
        const time = formatHour(h.time);
        const label = RATING_LABELS[val];
        const ht = h.waveHeight != null ? h.waveHeight.toFixed(1) + 'ft' : '';
        // Show time label every 6 hours (Pacific time)
        const d = new Date(h.time);
        const hr = parseInt(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', hour12: false }));
        const showLabel = (hr % 6 === 0);
        const timeLabel = showLabel ? `<span class="tl-time">${time}</span>` : '';
        return `<div class="timeline-seg-wrap"><div class="timeline-segment" style="background:${color}" data-tip="${time}: ${label} ${ht}"></div>${timeLabel}</div>`;
      }).join('');
      timelineHtml = `
        <div class="timeline-label">Quality (48h)</div>
        <div class="forecast-timeline">${segments}</div>`;
    }

    card.innerHTML = `
      <div class="rank-number"></div>
      <div class="card-header">
        <div class="spot-name"><a href="${surflineUrl}" target="_blank">${spot.name}</a></div>
        <span class="rating-badge rating-${ratingClass}">${ratingLabel}</span>
      </div>
      <div class="rating-dots">${dotsHtml}</div>
      <div class="card-stats">
        <div class="stat"><i data-lucide="waves" class="stat-icon"></i><span class="stat-value">${waveStr}</span></div>
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
      const [forecastRes, buoyRes] = await Promise.all([
        fetch('/api/forecasts').then(r => r.json()),
        fetch('/api/buoy').then(r => r.json()).catch(() => null)
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
  document.addEventListener('click', function(e) {
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
  document.addEventListener('click', function(e) {
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
    const authedStream = streamUrl + (streamUrl.includes('?') ? '&' : '?') + 'accesstoken=' + (slToken || '');

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
      const res = await fetch('/api/tides');
      const data = await res.json();
      if (!data.hourly || !data.hilo) return;

      const now = Date.now() / 1000;
      const end = now + 48 * 3600;
      const hourly = data.hourly.filter(t => t.timestamp >= now - 1800 && t.timestamp <= end);
      const hilo = data.hilo.filter(t => t.timestamp >= now - 1800 && t.timestamp <= end);

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

      // Hover elements: invisible rect + cursor line + dot + tooltip
      const svg = `<svg viewBox="0 0 ${w} ${h}" class="tide-svg" preserveAspectRatio="none"
                        data-w="${w}" data-h="${h}" data-pad="${pad}" data-min="${minH}" data-range="${range}" data-count="${hourly.length}">
        <path d="${fillD}" class="tide-fill"/>
        <path d="${pathD}" class="tide-line"/>

        <line class="tide-hover-line" x1="0" y1="0" x2="0" y2="${h}" style="display:none"/>
        <circle class="tide-hover-dot" r="3" cx="0" cy="0" style="display:none"/>
        <rect class="tide-hover-zone" x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
      </svg>
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
    const dot = svg.querySelector('.tide-hover-dot');
    line.setAttribute('x1', x); line.setAttribute('x2', x);
    line.style.display = '';
    dot.setAttribute('cx', x); dot.setAttribute('cy', y);
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
      svg.querySelector('.tide-hover-dot').style.display = 'none';
      wrap.querySelector('.tide-tooltip').style.display = 'none';
    }
  }, true);

  document.addEventListener('mouseout', function(e) {
    const zone = e.target.closest('.tide-hover-zone');
    if (zone && !zone.contains(e.relatedTarget)) {
      const svg = zone.closest('.tide-svg');
      const wrap = svg.closest('.tide-chart-wrap');
      svg.querySelector('.tide-hover-line').style.display = 'none';
      svg.querySelector('.tide-hover-dot').style.display = 'none';
      wrap.querySelector('.tide-tooltip').style.display = 'none';
    }
  });

  // --- Init ---
  loadData().then(() => { loadSurflineData(); loadTides(); loadSurflineOverlay(); });
  setInterval(loadData, REFRESH_INTERVAL);
})();
