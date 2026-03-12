(() => {
  const RATING_LABELS = ['FLAT', 'VERY POOR', 'POOR', 'POOR TO FAIR', 'FAIR', 'FAIR TO GOOD', 'GOOD'];
  const RATING_CLASSES = ['flat', 'very-poor', 'poor', 'poor-to-fair', 'fair', 'fair-to-good', 'good'];
  const RATING_COLORS = ['#334455', '#e63946', '#f77f00', '#fcbf49', '#fcbf49', '#2ec4b6', '#06d6a0'];
  const DOT_CLASSES = ['', 'very-poor', 'poor', 'poor', 'fair', 'good', 'good'];

  const REFRESH_INTERVAL = 15 * 60 * 1000;

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
    if (data.waveHeight) items.push({ label: 'Wave Ht', value: `${data.waveHeight} ft`, icon: '🌊' });
    if (data.dominantPeriod) items.push({ label: 'Period', value: `${data.dominantPeriod}s`, icon: '⏱' });
    if (data.waveDirection != null) items.push({ label: 'Direction', value: `${data.waveDirection}° ${degToCompass(data.waveDirection)}`, icon: '🧭' });
    if (data.waterTemp) items.push({ label: 'Water', value: `${data.waterTemp}°F`, icon: '🌡' });
    if (data.windSpeed) items.push({ label: 'Wind', value: `${data.windSpeed} kts ${degToCompass(data.windDir)}`, icon: '💨' });

    stats.innerHTML = items.map(i =>
      `<div class="buoy-stat"><span>${i.icon}</span><span class="label">${i.label}</span><span class="value">${i.value}</span></div>`
    ).join('');
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
        <div class="stat"><span class="stat-icon">🌊</span><span class="stat-value">${waveStr}</span></div>
        ${swellStr ? `<div class="stat"><span class="stat-icon">〰️</span><span class="stat-value">${swellStr}</span></div>` : ''}
        <div class="stat"><span class="stat-icon">💨</span><span class="stat-value">${windStr}</span></div>
        <a href="${camUrl}" target="_blank" class="cam-link">📷 Cam</a>
      </div>
      ${timelineHtml}`;

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

  // --- Init ---
  updateClock();
  setInterval(updateClock, 60000);
  loadData();
  setInterval(loadData, REFRESH_INTERVAL);
})();
