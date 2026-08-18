(function () {
  var heroImg = document.getElementById('heroImage');
  var caption = document.getElementById('heroCaption');

  // Tags chosen to reflect "building websites" as day-to-day work
  var topics = [
    'programming', 'coding', 'web-development', 'software-developer',
    'javascript', 'developer-desk', 'computer-code', 'keyboard'
  ];

  function dayOfYear(date) {
    var start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / 86400000);
  }

  var today = new Date();
  var seed = today.getFullYear() * 1000 + dayOfYear(today); // unique per calendar day
  var topic = topics[seed % topics.length];
  var url = 'https://loremflickr.com/1600/900/' + topic + '?lock=' + seed;

  heroImg.onload = function () {
    caption.textContent = 'Image of the day — "' + topic.replace('-', ' ') + '". Refreshes daily.';
  };
  heroImg.onerror = function () {
    // Service unreachable — keep the plain dark background + default caption
    heroImg.remove();
  };
  heroImg.src = url;
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
