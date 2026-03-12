(() => {
  const RATING_LABELS = ['FLAT', 'VERY POOR', 'POOR', 'POOR TO FAIR', 'FAIR', 'FAIR TO GOOD', 'GOOD'];
  const RATING_CLASSES = ['flat', 'very-poor', 'poor', 'poor-to-fair', 'fair', 'fair-to-good', 'good'];
  const RATING_COLORS = ['#334455', '#e63946', '#f77f00', '#fcbf49', '#fcbf49', '#2ec4b6', '#06d6a0'];
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

  // Fetch Surfline spot report (conditions + cameras)
  async function fetchSurflineReport(spotId) {
    const token = await getSLToken();
    if (!token) { console.warn('No SL token'); return null; }
    try {
      const r = await fetch(`https://services.surfline.com/kbyg/spots/reports?spotId=${spotId}&accesstoken=${token}`);
      if (!r.ok) { console.warn('SL report', spotId, r.status); return null; }
      const d = await r.json();
      console.log('SL report for', spotId, '- cameras:', (d.cameras||[]).length, '- keys:', Object.keys(d));

      // Extract conditions
      const conds = d.forecast?.conditions?.conditions;
      let headline = '';
      if (conds && conds.length > 0) {
        headline = conds[0].headline || '';
      }

      // Extract cameras
      const cameras = (d.cameras || []).filter(c => !c.status?.isDown && !c.nighttime);

      return { headline, cameras };
    } catch (e) { console.warn('SL report failed for', spotId, e); return null; }
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
        // Show time label every 6 hours
        const d = new Date(h.time);
        const hr = d.getHours();
        const showLabel = (hr % 6 === 0);
        const timeLabel = showLabel ? `<span class="tl-time">${time}</span>` : '';
        return `<div class="timeline-seg-wrap"><div class="timeline-segment" style="background:${color}" data-tip="${time}: ${label} ${ht}"></div>${timeLabel}</div>`;
      }).join('');
      timelineHtml = `
        <div class="timeline-label">Next 48h forecast</div>
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

      document.getElementById('last-updated').textContent =
        `Updated ${formatPacificTime(new Date())}`;

      if (window.lucide) lucide.createIcons();

    } catch (e) {
      console.error('Failed to load data:', e);
      grid.innerHTML = '<p style="text-align:center;color:var(--gray);padding:2rem;">Failed to load forecast data. Will retry...</p>';
    } finally {
      loading.classList.add('hidden');
    }
  }

  // --- Clock ---
  function updateClock() {
    document.getElementById('current-time').textContent = formatPacificTime(new Date());
  }

  // --- Load Surfline data (cams + conditions) into cards ---
  async function loadSurflineData() {
    const camAreas = document.querySelectorAll('.cam-area[data-spot-id]');
    const condAreas = document.querySelectorAll('.sl-conditions[data-spot-id]');

    const condMap = {};
    condAreas.forEach(el => { condMap[el.dataset.spotId] = el; });

    // Fetch all reports in parallel (batches of 4 to be nice)
    const spots = Array.from(camAreas).map(el => el.dataset.spotId);
    const batchSize = 4;
    for (let i = 0; i < spots.length; i += batchSize) {
      const batch = spots.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(id => fetchSurflineReport(id).then(r => [id, r])));

      for (const [spotId, report] of results) {
        if (!report) continue;

        // Populate headline
        const condEl = condMap[spotId];
        if (condEl && report.headline) {
          condEl.innerHTML = `<div class="sl-headline">${report.headline}</div>`;
        }

        // Populate cam carousel
        const camEl = document.querySelector(`.cam-area[data-spot-id="${spotId}"]`);
        const cams = report.cameras;
        if (!camEl || cams.length === 0) continue;

        const slides = cams.map((cam, idx) => {
          const still = cam.stillUrlFull || cam.stillUrl;
          const stream = cam.streamUrl || '';
          const title = cam.title || '';
          return `<div class="cam-slide ${idx === 0 ? 'active' : ''}" data-index="${idx}" data-stream="${stream}">
            <img src="${still}" alt="${title}" class="cam-still" loading="lazy" onerror="this.closest('.cam-slide').style.display='none'">
            <div class="cam-title">${title.replace(/^SD - /, '')}</div>
            ${stream ? '<div class="cam-play"><i data-lucide="play" class="play-icon"></i></div>' : ''}
          </div>`;
        }).join('');

        const arrows = cams.length > 1 ? `
          <button class="cam-arrow cam-arrow-left" data-dir="-1"><i data-lucide="chevron-left"></i></button>
          <button class="cam-arrow cam-arrow-right" data-dir="1"><i data-lucide="chevron-right"></i></button>
          <div class="cam-dots">${cams.map((_, idx) => `<span class="cam-dot ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>`).join('')}</div>
        ` : '';

        camEl.innerHTML = `<div class="cam-carousel" data-count="${cams.length}">${slides}${arrows}</div>`;
      }
    }
    if (window.lucide) lucide.createIcons();
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

      // Stop any playing video
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
    const wrapper = e.target.closest('.cam-wrapper[data-stream]');
    if (!wrapper) return;
    const streamUrl = wrapper.dataset.stream;
    if (!streamUrl) return;

    // If already playing, toggle back to still
    const existingVideo = wrapper.querySelector('video');
    if (existingVideo) {
      if (existingVideo._hls) existingVideo._hls.destroy();
      existingVideo.remove();
      wrapper.querySelector('.cam-still').style.display = '';
      wrapper.querySelector('.cam-play').innerHTML = '<i data-lucide="play" class="play-icon"></i>';
      if (window.lucide) lucide.createIcons();
      return;
    }

    const img = wrapper.querySelector('.cam-still');
    const video = document.createElement('video');
    video.className = 'cam-video';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = true;

    if (Hls.isSupported()) {
      const hls = new Hls({ maxBufferLength: 10, maxMaxBufferLength: 20 });
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      video._hls = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
    }

    img.style.display = 'none';
    wrapper.insertBefore(video, img);
    const playBtn = wrapper.querySelector('.cam-play');
    if (playBtn) {
      playBtn.innerHTML = '<i data-lucide="square" class="play-icon"></i>';
      if (window.lucide) lucide.createIcons();
    }
  });

  // --- Init ---
  updateClock();
  setInterval(updateClock, 60000);
  loadData().then(() => { loadSurflineData(); });
  setInterval(loadData, REFRESH_INTERVAL);
})();
