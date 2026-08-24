(function () {
  var heroBg = document.getElementById('heroBg');
  var caption = document.getElementById('heroCaption');
  var heroDate = document.getElementById('heroDate');
  var heroTime = document.getElementById('heroTime');

  // Generated gradient mesh instead of a fetched photo — no third-party
  // dependency, so the hero always renders. Colors are drawn from the
  // site's own accents (brand terracotta, product teal/blue, agenda
  // red/navy) plus a couple of complementary hues for weekly variety.
  var palettes = [
    { name: 'Terracotta Dusk', c1: '#c05621', c2: '#0a1a33', c3: '#e2905a' },
    { name: 'Tidal Teal', c1: '#2dd4bf', c2: '#2563eb', c3: '#0a1a33' },
    { name: 'Amber Ember', c1: '#f4a259', c2: '#16181d', c3: '#c05621' },
    { name: 'Violet Hour', c1: '#7c5cff', c2: '#1c1f26', c3: '#e88fd0' },
    { name: 'Forest Gold', c1: '#2f855a', c2: '#16181d', c3: '#f4a259' },
    { name: 'Slate Coral', c1: '#3a4d8f', c2: '#0a1a33', c3: '#f0a08c' },
    { name: 'Deep Plum', c1: '#6b2d5c', c2: '#0a1a33', c3: '#2dd4bf' }
  ];

  function dayOfYear(date) {
    var start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / 86400000);
  }

  var appliedDayKey = null;

  function applyPaletteForToday(now) {
    var dayKey = now.getFullYear() * 1000 + dayOfYear(now);
    if (dayKey === appliedDayKey) return; // already showing the right day's palette
    appliedDayKey = dayKey;

    var palette = palettes[dayKey % palettes.length];
    heroBg.style.setProperty('--hero-c1', palette.c1);
    heroBg.style.setProperty('--hero-c2', palette.c2);
    heroBg.style.setProperty('--hero-c3', palette.c3);
    caption.textContent = "Today's palette — \"" + palette.name + "\". Shifts daily.";
  }

  // This page tends to stay open as a homepage/dashboard rather than being
  // reloaded each day, so the palette and header are recomputed on an
  // interval (not just once at load) — otherwise a tab left open overnight
  // would keep showing yesterday's palette and date indefinitely.
  function tick() {
    var now = new Date();
    applyPaletteForToday(now);
    heroDate.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    heroTime.textContent = now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }) + ' GMT';
  }

  tick();
  setInterval(tick, 15000);
})();

(function () {
  var clocks = [
    { el: document.getElementById('govTimeUs'), zone: 'America/New_York' },
    { el: document.getElementById('govTimeCn'), zone: 'Asia/Shanghai' },
    { el: document.getElementById('govTimeRu'), zone: 'Europe/Moscow' }
  ];

  function tick() {
    var now = new Date();
    clocks.forEach(function (clock) {
      if (!clock.el) return;
      clock.el.textContent = now.toLocaleTimeString('en-US', {
        timeZone: clock.zone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    });
  }

  tick();
  setInterval(tick, 15000);
})();

(function () {
  var newsList = document.getElementById('newsList');
  var prevBtn = document.getElementById('newsPrev');
  var nextBtn = document.getElementById('newsNext');
  var counter = document.getElementById('newsCounter');
  // Cloudflare Worker: fetches NYT/NBC/ABC daily, summarizes each
  // article's key points with Claude, caches the result. See worker/.
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var items = [];
  var index = 0;

  // Shortens text word-by-word until it fits the real available box,
  // instead of letting line-clamp hard-cut mid-sentence.
  function fitText(el, fullText, container) {
    el.textContent = fullText;
    if (container.scrollHeight <= container.clientHeight) return;

    var words = fullText.split(' ');
    while (words.length > 4 && container.scrollHeight > container.clientHeight) {
      words.pop();
      el.textContent = words.join(' ') + '…';
    }
  }

  function renderCurrent() {
    var item = items[index];
    newsList.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'news-item';

    var headline = document.createElement('p');
    headline.className = 'news-headline';
    headline.textContent = item.title;

    var summary = document.createElement('p');
    summary.className = 'news-summary';

    wrap.appendChild(headline);
    wrap.appendChild(summary);
    newsList.appendChild(wrap);

    fitText(summary, item.summary, newsList);

    counter.textContent = (index + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    renderCurrent();
  });

  fetch(WORKER_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      renderCurrent();
    })
    .catch(function () {
      newsList.innerHTML = '<p class="news-error">Headlines unavailable right now — check back later.</p>';
    });
})();

(function () {
  var githubList = document.getElementById('githubList');
  var prevBtn = document.getElementById('githubPrev');
  var nextBtn = document.getElementById('githubNext');
  var counter = document.getElementById('githubCounter');
  // Same Cloudflare Worker as the news card, /github route. Repos are
  // private, so the GitHub token stays server-side — see worker/.
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var ICONS = {
    issue: '<svg class="icon-issue" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"></circle><circle cx="8" cy="8" r="1.8"></circle></svg>',
    clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.5"></circle><path d="M8 4.5v3.8l2.5 2.2" stroke-linecap="round"></path></svg>',
    commit: '<svg class="icon-commit" viewBox="0 0 16 16"><line x1="1" y1="8" x2="5.4" y2="8"></line><line x1="10.6" y1="8" x2="15" y2="8"></line><circle cx="8" cy="8" r="2.6"></circle></svg>'
  };

  var items = [];
  var index = 0;

  function relativeTime(iso) {
    var diffMs = Date.now() - new Date(iso).getTime();
    var mins = Math.floor(diffMs / 60000);
    if (mins < 60) return (mins <= 1 ? 'a minute' : mins + ' minutes') + ' ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return (hours === 1 ? 'an hour' : hours + ' hours') + ' ago';
    var days = Math.floor(hours / 24);
    if (days < 30) return days === 1 ? 'yesterday' : days + ' days ago';
    var months = Math.floor(days / 30);
    if (months < 12) return (months === 1 ? 'a month' : months + ' months') + ' ago';
    var years = Math.floor(months / 12);
    return (years === 1 ? 'a year' : years + ' years') + ' ago';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderCurrent() {
    var item = items[index];
    githubList.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'github-item';

    var nameRow = document.createElement('div');
    nameRow.className = 'repo-name-row';
    nameRow.innerHTML =
      '<svg class="repo-icon" viewBox="0 0 16 16"><rect x="2" y="1.5" width="12" height="13" rx="1.5"></rect><line x1="5.5" y1="1.5" x2="5.5" y2="14.5"></line></svg>' +
      '<a class="repo-name" href="' + item.url + '" target="_blank" rel="noopener">' + escapeHtml(item.fullName) + '</a>' +
      '<span class="repo-visibility">' + escapeHtml(item.visibility) + '</span>';

    var desc = document.createElement('p');
    desc.className = 'repo-desc';
    desc.textContent = item.description || 'No description provided.';

    var meta = document.createElement('div');
    meta.className = 'repo-meta';
    var metaHtml = '';
    if (item.language) {
      metaHtml += '<span><span class="lang-dot" style="background:' + item.languageColor + '"></span>' + escapeHtml(item.language) + '</span>';
    }
    metaHtml += '<span>' + ICONS.clock + 'Updated ' + relativeTime(item.updatedAt) + '</span>';
    metaHtml += '<span>' + ICONS.issue + item.openIssues + ' open issue' + (item.openIssues === 1 ? '' : 's') + '</span>';
    meta.innerHTML = metaHtml;

    wrap.appendChild(nameRow);
    wrap.appendChild(desc);
    wrap.appendChild(meta);

    if (item.latestCommit) {
      var commit = document.createElement('div');
      commit.className = 'repo-commit';
      commit.innerHTML = ICONS.commit + '<span class="commit-msg">' + escapeHtml(item.latestCommit.message) + '</span>';
      wrap.appendChild(commit);
    }

    githubList.appendChild(wrap);

    counter.textContent = (index + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    renderCurrent();
  });

  fetch(WORKER_URL + '/github')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      renderCurrent();
    })
    .catch(function () {
      githubList.innerHTML = '<p class="github-error">GitHub activity unavailable right now — check back later.</p>';
    });
})();

(function () {
  var card = document.querySelector('.card-agenda');
  var body = document.getElementById('agendaBody');
  var eyebrow = document.getElementById('agendaEyebrow');
  var title = document.getElementById('agendaTitle');
  var prevBtn = document.getElementById('agendaPrev');
  var nextBtn = document.getElementById('agendaNext');
  var counter = document.getElementById('agendaCounter');
  // Same Cloudflare Worker, /todoist and /calendar routes. Todoist token and
  // the Fastmail .ics URL (itself a bearer secret) stay server-side.
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var views = [];
  var index = 0;

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function parseDateOnly(str) {
    var parts = str.split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function dayLabel(date) {
    var diff = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function dueInfo(due) {
    if (!due) return null;
    var dueDate = due.datetime ? new Date(due.datetime) : parseDateOnly(due.date);
    var diffDays = Math.round((startOfDay(dueDate) - startOfDay(new Date())) / 86400000);
    var overdue = due.datetime ? dueDate < new Date() : diffDays < 0;
    var label;
    if (overdue) label = 'Overdue';
    else if (diffDays === 0) label = due.datetime ? dueDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Today';
    else if (diffDays === 1) label = 'Tomorrow';
    else label = dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return { label: label, overdue: overdue, today: diffDays === 0 && !overdue };
  }

  function renderTodoist(items) {
    if (!items.length) {
      body.innerHTML = '<p class="agenda-loading">Nothing on your Todoist list — you\'re all caught up.</p>';
      return;
    }

    var overdueCount = 0, todayCount = 0;
    items.forEach(function (item) {
      var info = dueInfo(item.due);
      if (info && info.overdue) overdueCount += 1;
      if (info && info.today) todayCount += 1;
    });

    var html = '<div class="todoist-stats">';
    if (overdueCount) html += '<span class="todoist-stat">' + overdueCount + ' overdue</span>';
    if (todayCount) html += '<span class="todoist-stat' + (overdueCount ? ' is-muted' : '') + '">' + todayCount + ' due today</span>';
    if (!overdueCount && !todayCount) html += '<span class="todoist-stat is-muted">All caught up</span>';
    html += '</div><div class="todoist-list">';

    items.forEach(function (item) {
      var info = dueInfo(item.due);
      html += '<div class="todoist-task">' +
        '<span class="todoist-checkbox" style="color:' + item.priorityColor + '"></span>' +
        '<span class="todoist-content">' + escapeHtml(item.content) + '</span>' +
        (item.project ? '<span class="todoist-project">' + escapeHtml(item.project.name) + '</span>' : '') +
        (info ? '<span class="todoist-due' + (info.overdue ? ' is-overdue' : info.today ? ' is-today' : '') + '">' + info.label + '</span>' : '') +
        '</div>';
    });

    html += '</div><div class="todoist-footer"><a href="https://todoist.com/app" target="_blank" rel="noopener">Open Todoist →</a></div>';
    body.innerHTML = html;
  }

  function timeLabel(startIso, endIso, allDay) {
    if (allDay) return 'All day';
    var opts = { hour: 'numeric', minute: '2-digit' };
    return new Date(startIso).toLocaleTimeString([], opts) + ' – ' + new Date(endIso).toLocaleTimeString([], opts);
  }

  function relativeCountdown(date) {
    var mins = Math.round((date - new Date()) / 60000);
    if (mins < 60) return 'in ' + Math.max(mins, 1) + ' min';
    var hours = Math.round(mins / 60);
    if (hours < 24) return 'in ' + hours + ' hr' + (hours === 1 ? '' : 's');
    var days = Math.round(hours / 24);
    return 'in ' + days + ' day' + (days === 1 ? '' : 's');
  }

  function renderCalendar(items) {
    if (!items.length) {
      body.innerHTML = '<p class="agenda-loading">Nothing on your calendar for now.</p>';
      return;
    }

    var next = items[0];
    var nextStart = new Date(next.start);
    var html = '<div class="cal-next">' +
      '<span class="cal-next-badge">Next</span>' +
      '<div class="cal-next-info">' +
        '<div class="cal-next-title">' + escapeHtml(next.title) + '</div>' +
        '<div class="cal-next-when">' + dayLabel(nextStart) + ' · ' + timeLabel(next.start, next.end, next.allDay) +
          (next.allDay ? '' : ' (' + relativeCountdown(nextStart) + ')') + '</div>' +
      '</div></div><div class="cal-list">';

    var lastLabel = null;
    items.forEach(function (item) {
      var start = new Date(item.start);
      var label = dayLabel(start);
      if (label !== lastLabel) {
        html += '<div class="cal-day-label">' + label + '</div>';
        lastLabel = label;
      }
      html += '<div class="cal-event">' +
        '<span class="cal-event-time">' + (item.allDay ? 'All day' : start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '</span>' +
        '<span class="cal-event-title">' + escapeHtml(item.title) +
          (item.location ? '<span class="cal-event-location">' + escapeHtml(item.location) + '</span>' : '') + '</span>' +
        '</div>';
    });

    html += '</div>';
    body.innerHTML = html;
  }

  function showView(i) {
    var view = views[i];
    eyebrow.textContent = view.eyebrow;
    title.textContent = view.title;
    card.style.setProperty('--agenda-accent', view.accent);
    card.style.setProperty('--agenda-accent-2', view.accent2);
    view.render();
    counter.textContent = (i + 1) + ' / ' + views.length;
    prevBtn.disabled = views.length <= 1;
    nextBtn.disabled = views.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!views.length) return;
    index = (index - 1 + views.length) % views.length;
    showView(index);
  });
  nextBtn.addEventListener('click', function () {
    if (!views.length) return;
    index = (index + 1) % views.length;
    showView(index);
  });

  Promise.all([
    fetch(WORKER_URL + '/todoist')
      .then(function (res) { if (!res.ok) throw new Error('todoist error'); return res.json(); })
      .catch(function () { return null; }),
    fetch(WORKER_URL + '/calendar')
      .then(function (res) { if (!res.ok) throw new Error('calendar error'); return res.json(); })
      .catch(function () { return null; })
  ]).then(function (results) {
    var todoist = results[0];
    var calendar = results[1];

    if (todoist && todoist.status === 'ok') {
      views.push({
        eyebrow: 'Todoist', title: 'Open Tasks', accent: '#d1453b', accent2: '#f0a08c',
        render: function () { renderTodoist(todoist.items); }
      });
    }
    if (calendar && calendar.status === 'ok') {
      views.push({
        eyebrow: 'Fastmail', title: 'Upcoming', accent: '#3a4d8f', accent2: '#93a6e0',
        render: function () { renderCalendar(calendar.items); }
      });
    }

    if (!views.length) {
      body.innerHTML = '<p class="agenda-error">Tasks and calendar are unavailable right now — check back later.</p>';
      return;
    }
    showView(0);
  });
})();

(function () {
  var body = document.getElementById('weatherBody');
  var titleEl = document.getElementById('weatherTitle');
  var prevBtn = document.getElementById('weatherPrev');
  var nextBtn = document.getElementById('weatherNext');
  var counter = document.getElementById('weatherCounter');
  // Same Cloudflare Worker, /weather route (Open-Meteo — no API key needed).
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var ICONS = {
    sun: '<svg class="weather-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"></circle><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" stroke-linecap="round"></path></svg>',
    'sun-cloud': '<svg class="weather-icon" viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.2"></circle><path d="M9 3.5v1.4M9 12.6v1M3.5 9h1.4M12.6 9h1M5.1 5.1l1 1M11.9 11.9l1 1M5.1 12.9l1-1M11.9 6.1l1-1" stroke-linecap="round"></path><path d="M9.5 20.5h8a3.5 3.5 0 0 0 .6-6.95 4.5 4.5 0 0 0-8.6-1.9 3.5 3.5 0 0 0-2 6.6" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    cloud: '<svg class="weather-icon" viewBox="0 0 24 24"><path d="M6.5 19h11a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 7.6 9.1 4 4 0 0 0 6.5 19z" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
    fog: '<svg class="weather-icon" viewBox="0 0 24 24"><path d="M6.5 15.5h11a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 7.6 5.6 4 4 0 0 0 6.5 15.5z" stroke-linecap="round" stroke-linejoin="round"></path><path d="M4 19h16M6 22h12" stroke-linecap="round"></path></svg>',
    rain: '<svg class="weather-icon" viewBox="0 0 24 24"><path d="M6.5 13.5h11a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 7.6 3.6 4 4 0 0 0 6.5 13.5z" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8 17.5l-1.2 3M12 17.5l-1.2 3M16 17.5l-1.2 3" stroke-linecap="round"></path></svg>',
    snow: '<svg class="weather-icon" viewBox="0 0 24 24"><path d="M6.5 13.5h11a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 7.6 3.6 4 4 0 0 0 6.5 13.5z" stroke-linecap="round" stroke-linejoin="round"></path><path d="M8 18v3M8 18l-1.5 1M8 18l1.5 1M12 19v3M12 19l-1.5 1M12 19l1.5 1M16 18v3M16 18l-1.5 1M16 18l1.5 1" stroke-linecap="round"></path></svg>',
    storm: '<svg class="weather-icon" viewBox="0 0 24 24"><path d="M6.5 12.5h11a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 7.6 2.6 4 4 0 0 0 6.5 12.5z" stroke-linecap="round" stroke-linejoin="round"></path><path d="M13 14l-3 5h3l-2 4" stroke-linecap="round" stroke-linejoin="round"></path></svg>'
  };

  var items = [];
  var index = 0;

  function renderForecast(forecast) {
    if (!forecast || !forecast.length) return '';
    return '<div class="weather-forecast">' +
      forecast.map(function (day) {
        return '<div class="weather-forecast-day">' +
          '<div class="weather-forecast-label">' + day.day + '</div>' +
          (ICONS[day.icon] || ICONS.cloud) +
          '<div class="weather-forecast-rain">' + day.rainChance + '%</div>' +
          '<div class="weather-forecast-temps"><strong>' + day.highF + '°</strong> ' + day.lowF + '°</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function showView(i) {
    var item = items[i];
    titleEl.textContent = item.name;

    body.innerHTML =
      '<div class="weather-top">' +
        '<div class="weather-now">' +
          (ICONS[item.icon] || ICONS.cloud) +
          '<div><div class="weather-temp">' + item.tempF + '°</div>' +
          '<div class="weather-condition">' + item.condition + '</div>' +
          '<div class="weather-feels">Feels like ' + item.feelsLikeF + '°</div></div>' +
        '</div>' +
        renderForecast(item.forecast) +
      '</div>' +
      '<div class="weather-stats">' +
        '<span class="weather-stat">High <strong>' + item.highF + '°</strong></span>' +
        '<span class="weather-stat">Low <strong>' + item.lowF + '°</strong></span>' +
        '<span class="weather-stat">Humidity <strong>' + item.humidity + '%</strong></span>' +
        '<span class="weather-stat">Wind <strong>' + item.windMph + ' mph</strong></span>' +
      '</div>';

    counter.textContent = (i + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    showView(index);
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    showView(index);
  });

  fetch(WORKER_URL + '/weather')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      showView(0);
    })
    .catch(function () {
      body.innerHTML = '<p class="weather-error">Weather unavailable right now — check back later.</p>';
    });
})();

(function () {
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  // Shortens text word-by-word until it fits the real available box,
  // instead of letting overflow clip mid-sentence. Same approach as the
  // news/jewish cards.
  function fitText(el, fullText, container) {
    el.textContent = fullText;
    if (container.scrollHeight <= container.clientHeight) return;

    var words = fullText.split(' ');
    while (words.length > 4 && container.scrollHeight > container.clientHeight) {
      words.pop();
      el.textContent = words.join(' ') + '…';
    }
  }

  // Shared by all "government news" side cards (US, PRC, Russia): each
  // worker route returns { status, branches: [{ name, items:
  // [{title,summary,link}] }] }. Branches are flattened into one ordered
  // list here (each item tagged with its branch as `source`) so the card
  // can show a single story at a time behind a toggler, same UX as the
  // news/jewish cards above.
  function renderGovCard(bodyId, route, prevId, nextId, counterId) {
    var body = document.getElementById(bodyId);
    var prevBtn = document.getElementById(prevId);
    var nextBtn = document.getElementById(nextId);
    var counter = document.getElementById(counterId);

    var items = [];
    var index = 0;

    function renderCurrent() {
      var item = items[index];
      body.innerHTML = '';

      var wrap = document.createElement('div');
      wrap.className = 'gov-item';

      var source = document.createElement('p');
      source.className = 'gov-item-source';
      source.textContent = item.source;

      var headline = document.createElement('a');
      headline.className = 'gov-item-title';
      headline.href = item.link;
      headline.target = '_blank';
      headline.rel = 'noopener';
      headline.textContent = item.title;

      var summary = document.createElement('p');
      summary.className = 'gov-item-summary';

      wrap.appendChild(source);
      wrap.appendChild(headline);
      wrap.appendChild(summary);
      body.appendChild(wrap);

      fitText(summary, item.summary, body);

      counter.textContent = (index + 1) + ' / ' + items.length;
      prevBtn.disabled = items.length <= 1;
      nextBtn.disabled = items.length <= 1;
    }

    prevBtn.addEventListener('click', function () {
      if (!items.length) return;
      index = (index - 1 + items.length) % items.length;
      renderCurrent();
    });
    nextBtn.addEventListener('click', function () {
      if (!items.length) return;
      index = (index + 1) % items.length;
      renderCurrent();
    });

    fetch(WORKER_URL + route)
      .then(function (res) {
        if (!res.ok) throw new Error('worker error');
        return res.json();
      })
      .then(function (data) {
        if (data.status !== 'ok' || !data.branches || !data.branches.length) {
          throw new Error('not ready yet');
        }
        items = [];
        data.branches.forEach(function (branch) {
          branch.items.forEach(function (item) {
            items.push({ source: branch.name, title: item.title, summary: item.summary, link: item.link });
          });
        });
        index = 0;
        renderCurrent();
      })
      .catch(function () {
        body.innerHTML = '<p class="gov-error">Government updates unavailable right now — check back later.</p>';
      });
  }

  // White House / Congress / Supreme Court, refreshed on the same daily
  // 7am ET cycle as the rest of the dashboard.
  renderGovCard('govUsBody', '/gov/us', 'govUsPrev', 'govUsNext', 'govUsCounter');

  // Xinhua / The State Council, same daily refresh cycle.
  renderGovCard('govCnBody', '/gov/cn', 'govCnPrev', 'govCnNext', 'govCnCounter');

  // The Kremlin / Government of Russia, same daily refresh cycle.
  renderGovCard('govRuBody', '/gov/ru', 'govRuPrev', 'govRuNext', 'govRuCounter');
})();

(function () {
  // Right-column "Judaism" card. Same Cloudflare Worker, /religion/jewish
  // route (JTA, Times of Israel, Jerusalem Post, Arutz Sheva, Chabad.org
  // pooled together). Same single-item toggler UX as the U.S. Headlines
  // card above, so this mirrors that IIFE closely.
  var list = document.getElementById('jewishList');
  var prevBtn = document.getElementById('jewishPrev');
  var nextBtn = document.getElementById('jewishNext');
  var counter = document.getElementById('jewishCounter');
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var items = [];
  var index = 0;

  function fitText(el, fullText, container) {
    el.textContent = fullText;
    if (container.scrollHeight <= container.clientHeight) return;

    var words = fullText.split(' ');
    while (words.length > 4 && container.scrollHeight > container.clientHeight) {
      words.pop();
      el.textContent = words.join(' ') + '…';
    }
  }

  function renderCurrent() {
    var item = items[index];
    list.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'jewish-item';

    var source = document.createElement('p');
    source.className = 'jewish-source';
    source.textContent = item.source;

    var headline = document.createElement('a');
    headline.className = 'jewish-headline';
    headline.href = item.link;
    headline.target = '_blank';
    headline.rel = 'noopener';
    headline.textContent = item.title;

    var summary = document.createElement('p');
    summary.className = 'jewish-summary';

    wrap.appendChild(source);
    wrap.appendChild(headline);
    wrap.appendChild(summary);
    list.appendChild(wrap);

    fitText(summary, item.summary, list);

    counter.textContent = (index + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    renderCurrent();
  });

  fetch(WORKER_URL + '/religion/jewish')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      renderCurrent();
    })
    .catch(function () {
      list.innerHTML = '<p class="jewish-error">Jewish world headlines unavailable right now — check back later.</p>';
    });
})();

(function () {
  // Right-column "Catholicism" card. Same Cloudflare Worker, /religion/catholic
  // route (Vatican News, Catholic News Agency, OSV News, National Catholic
  // Register, USCCB pooled together). Mirrors the Judaism card IIFE above.
  var list = document.getElementById('catholicList');
  var prevBtn = document.getElementById('catholicPrev');
  var nextBtn = document.getElementById('catholicNext');
  var counter = document.getElementById('catholicCounter');
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var items = [];
  var index = 0;

  function fitText(el, fullText, container) {
    el.textContent = fullText;
    if (container.scrollHeight <= container.clientHeight) return;

    var words = fullText.split(' ');
    while (words.length > 4 && container.scrollHeight > container.clientHeight) {
      words.pop();
      el.textContent = words.join(' ') + '…';
    }
  }

  function renderCurrent() {
    var item = items[index];
    list.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'catholic-item';

    var source = document.createElement('p');
    source.className = 'catholic-source';
    source.textContent = item.source;

    var headline = document.createElement('a');
    headline.className = 'catholic-headline';
    headline.href = item.link;
    headline.target = '_blank';
    headline.rel = 'noopener';
    headline.textContent = item.title;

    var summary = document.createElement('p');
    summary.className = 'catholic-summary';

    wrap.appendChild(source);
    wrap.appendChild(headline);
    wrap.appendChild(summary);
    list.appendChild(wrap);

    fitText(summary, item.summary, list);

    counter.textContent = (index + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    renderCurrent();
  });

  fetch(WORKER_URL + '/religion/catholic')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      renderCurrent();
    })
    .catch(function () {
      list.innerHTML = '<p class="catholic-error">Catholic world headlines unavailable right now — check back later.</p>';
    });
})();

(function () {
  // Right-column "Islam" card. Same Cloudflare Worker, /religion/islamic
  // route (Al Jazeera English, Religion News Service, Al Arabiya English,
  // MuslimMatters.org, Middle East Eye pooled together). Mirrors the
  // Judaism/Catholicism card IIFEs above.
  var list = document.getElementById('islamicList');
  var prevBtn = document.getElementById('islamicPrev');
  var nextBtn = document.getElementById('islamicNext');
  var counter = document.getElementById('islamicCounter');
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var items = [];
  var index = 0;

  function fitText(el, fullText, container) {
    el.textContent = fullText;
    if (container.scrollHeight <= container.clientHeight) return;

    var words = fullText.split(' ');
    while (words.length > 4 && container.scrollHeight > container.clientHeight) {
      words.pop();
      el.textContent = words.join(' ') + '…';
    }
  }

  function renderCurrent() {
    var item = items[index];
    list.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'islamic-item';

    var source = document.createElement('p');
    source.className = 'islamic-source';
    source.textContent = item.source;

    var headline = document.createElement('a');
    headline.className = 'islamic-headline';
    headline.href = item.link;
    headline.target = '_blank';
    headline.rel = 'noopener';
    headline.textContent = item.title;

    var summary = document.createElement('p');
    summary.className = 'islamic-summary';

    wrap.appendChild(source);
    wrap.appendChild(headline);
    wrap.appendChild(summary);
    list.appendChild(wrap);

    fitText(summary, item.summary, list);

    counter.textContent = (index + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    renderCurrent();
  });

  fetch(WORKER_URL + '/religion/islamic')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      renderCurrent();
    })
    .catch(function () {
      list.innerHTML = '<p class="islamic-error">Islamic world headlines unavailable right now — check back later.</p>';
    });
})();

(function () {
  // Right-column "Hinduism" card. Same Cloudflare Worker, /religion/hindu
  // route (Hindu Press International, ISKCON News, Hindu American
  // Foundation, Hindu Blog, Patheos Hindu Channel pooled together). Mirrors
  // the other religion card IIFEs above.
  var list = document.getElementById('hinduList');
  var prevBtn = document.getElementById('hinduPrev');
  var nextBtn = document.getElementById('hinduNext');
  var counter = document.getElementById('hinduCounter');
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var items = [];
  var index = 0;

  function fitText(el, fullText, container) {
    el.textContent = fullText;
    if (container.scrollHeight <= container.clientHeight) return;

    var words = fullText.split(' ');
    while (words.length > 4 && container.scrollHeight > container.clientHeight) {
      words.pop();
      el.textContent = words.join(' ') + '…';
    }
  }

  function renderCurrent() {
    var item = items[index];
    list.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'hindu-item';

    var source = document.createElement('p');
    source.className = 'hindu-source';
    source.textContent = item.source;

    var headline = document.createElement('a');
    headline.className = 'hindu-headline';
    headline.href = item.link;
    headline.target = '_blank';
    headline.rel = 'noopener';
    headline.textContent = item.title;

    var summary = document.createElement('p');
    summary.className = 'hindu-summary';

    wrap.appendChild(source);
    wrap.appendChild(headline);
    wrap.appendChild(summary);
    list.appendChild(wrap);

    fitText(summary, item.summary, list);

    counter.textContent = (index + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    renderCurrent();
  });

  fetch(WORKER_URL + '/religion/hindu')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      renderCurrent();
    })
    .catch(function () {
      list.innerHTML = '<p class="hindu-error">Hindu world headlines unavailable right now — check back later.</p>';
    });
})();

(function () {
  // Right-column "Buddhism" card. Same Cloudflare Worker, /religion/buddhist
  // route (Lion's Roar, Tricycle, Religion Unplugged, Buddhistdoor Global
  // pooled together). Mirrors the other religion card IIFEs above.
  var list = document.getElementById('buddhistList');
  var prevBtn = document.getElementById('buddhistPrev');
  var nextBtn = document.getElementById('buddhistNext');
  var counter = document.getElementById('buddhistCounter');
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';

  var items = [];
  var index = 0;

  function fitText(el, fullText, container) {
    el.textContent = fullText;
    if (container.scrollHeight <= container.clientHeight) return;

    var words = fullText.split(' ');
    while (words.length > 4 && container.scrollHeight > container.clientHeight) {
      words.pop();
      el.textContent = words.join(' ') + '…';
    }
  }

  function renderCurrent() {
    var item = items[index];
    list.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'buddhist-item';

    var source = document.createElement('p');
    source.className = 'buddhist-source';
    source.textContent = item.source;

    var headline = document.createElement('a');
    headline.className = 'buddhist-headline';
    headline.href = item.link;
    headline.target = '_blank';
    headline.rel = 'noopener';
    headline.textContent = item.title;

    var summary = document.createElement('p');
    summary.className = 'buddhist-summary';

    wrap.appendChild(source);
    wrap.appendChild(headline);
    wrap.appendChild(summary);
    list.appendChild(wrap);

    fitText(summary, item.summary, list);

    counter.textContent = (index + 1) + ' / ' + items.length;
    prevBtn.disabled = items.length <= 1;
    nextBtn.disabled = items.length <= 1;
  }

  prevBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index - 1 + items.length) % items.length;
    renderCurrent();
  });
  nextBtn.addEventListener('click', function () {
    if (!items.length) return;
    index = (index + 1) % items.length;
    renderCurrent();
  });

  fetch(WORKER_URL + '/religion/buddhist')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      items = data.items;
      index = 0;
      renderCurrent();
    })
    .catch(function () {
      list.innerHTML = '<p class="buddhist-error">Buddhist world headlines unavailable right now — check back later.</p>';
    });
})();
