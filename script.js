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
