(function () {
  // Center "Good News" cover-flow card. Same Cloudflare Worker as the other
  // cards, /good-news route (Good News Network, Reasons to Be Cheerful
  // pooled together).
  var WORKER_URL = 'https://portfolio-headlines.mfzequeira.workers.dev';
  var goodNewsItems = [];
  var statusMessage = 'Loading good news…';

  var page = document.querySelector('.page');
  var grid = document.querySelector('.grid');
  var colCenter = document.querySelector('.col-center');
  var viewport = document.querySelector('.coverflow-viewport');
  var track = document.getElementById('coverflowTrack');
  var nav = document.querySelector('.coverflow-nav');
  var prevBtn = document.getElementById('cfPrev');
  var nextBtn = document.getElementById('cfNext');
  var activeIndex = 0;

  var CARD_RATIO = 124 / 140;
  var MAX_VIEWPORT_HEIGHT = 320;

  // CSS flex-grow nested two levels deep (page > section > viewport), with
  // the card sized as a percentage inside it, didn't reliably resolve in
  // the browser — the carousel kept collapsing to nothing. Measuring real
  // rendered positions here instead and setting an explicit pixel height
  // sidesteps that entirely: it's just arithmetic on values the browser
  // has already laid out, so there's nothing left to fail to resolve.
  // Capped at MAX_VIEWPORT_HEIGHT so a tall screen can't blow the cards
  // (and their fixed-size text) up to an unreadable, overflowing size.
  function fitViewportHeight() {
    var pagePaddingBottom = parseFloat(getComputedStyle(page).paddingBottom) || 0;
    var centerGap = parseFloat(getComputedStyle(colCenter).rowGap) || 0;
    var navMarginTop = parseFloat(getComputedStyle(nav).marginTop) || 0;

    var contentBottom = page.getBoundingClientRect().bottom - pagePaddingBottom;
    var sectionTop = grid.getBoundingClientRect().bottom + centerGap;
    var sectionHeight = contentBottom - sectionTop;
    var navHeight = nav.getBoundingClientRect().height;

    var viewportHeight = sectionHeight - navMarginTop - navHeight;
    return Math.min(Math.max(Math.round(viewportHeight), 60), MAX_VIEWPORT_HEIGHT);
  }

  // Side columns (3 left / 5 right) have no content of their own yet, so
  // there's nothing to size them against except the center column's real
  // rendered height. Same reasoning as fitViewportHeight above: measure the
  // actual laid-out box (post coverflow-height fix) and set fixed px
  // heights on each card, rather than trying to make flexbox stretch them
  // to match a sibling's auto height (unreliable — see project memory on
  // nested flex-grow).
  function fitSideColumns() {
    var centerRect = colCenter.getBoundingClientRect();
    var columns = document.querySelectorAll('.col-side');
    for (var c = 0; c < columns.length; c++) {
      var col = columns[c];
      var cards = col.querySelectorAll('.card-side');
      if (!cards.length) continue;
      var gap = parseFloat(getComputedStyle(col).rowGap) || 0;
      var cardHeight = Math.round((centerRect.height - gap * (cards.length - 1)) / cards.length);
      cardHeight = Math.max(cardHeight, 60);
      for (var i = 0; i < cards.length; i++) {
        cards[i].style.height = cardHeight + 'px';
      }
    }
  }

  function renderCoverflow() {
    var viewportHeight = fitViewportHeight();
    viewport.style.height = viewportHeight + 'px';

    track.innerHTML = '';

    if (!goodNewsItems.length) {
      var status = document.createElement('p');
      status.className = 'cf-status';
      status.textContent = statusMessage;
      track.appendChild(status);
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      fitSideColumns();
      return;
    }

    var cardHeight = Math.round(viewportHeight * 0.88);
    var cardWidth = Math.round(cardHeight * CARD_RATIO);

    // Card padding (14px top + 12px bottom, set in CSS) and the snippet's
    // own line-height (11.5px * 1.5), used below to work out how many full
    // lines of snippet actually fit under the title instead of just
    // letting overflow:hidden clip mid-line.
    var CARD_PADDING_V = 26;
    var SNIPPET_GAP = 6;
    var SNIPPET_LINE_HEIGHT = 11.5 * 1.5;

    var cards = goodNewsItems.map(function (item, i) {
      var card = document.createElement('div');
      card.className = 'cf-card';
      card.style.width = cardWidth + 'px';
      card.style.height = cardHeight + 'px';

      var source = document.createElement('div');
      source.className = 'cf-source';
      source.textContent = item.source;
      card.appendChild(source);

      var title = document.createElement('a');
      title.className = 'cf-title';
      title.textContent = item.title;
      title.href = item.link;
      title.target = '_blank';
      title.rel = 'noopener';
      card.appendChild(title);

      var snippet = document.createElement('div');
      snippet.className = 'cf-snippet';
      snippet.textContent = item.summary;
      card.appendChild(snippet);

      track.appendChild(card);

      var available = cardHeight - CARD_PADDING_V - source.offsetHeight - title.offsetHeight - SNIPPET_GAP;
      var maxLines = Math.max(1, Math.floor(available / SNIPPET_LINE_HEIGHT));
      snippet.style.webkitLineClamp = String(maxLines);

      card.addEventListener('click', function (e) {
        if (e.target === title) return; // let the headline link navigate normally
        activeIndex = i;
        renderCoverflow();
      });
      return card;
    });

    var stepX = cardWidth * 0.65;
    var stepZ = cardHeight * 0.85;

    cards.forEach(function (card, i) {
      var offset = i - activeIndex;
      var absOffset = Math.abs(offset);
      var translateX = offset * stepX;
      var rotateY = offset === 0 ? 0 : (offset > 0 ? -45 : 45);
      var translateZ = offset === 0 ? 0 : -stepZ * absOffset;
      var opacity = absOffset > 3 ? 0 : 1 - absOffset * 0.2;
      var zIndex = 100 - absOffset;

      card.style.transform = 'translate(-50%, -50%) translateX(' + translateX + 'px) translateZ(' + translateZ + 'px) rotateY(' + rotateY + 'deg)';
      card.style.opacity = opacity;
      card.style.zIndex = zIndex;
    });

    prevBtn.disabled = activeIndex === 0;
    nextBtn.disabled = activeIndex === goodNewsItems.length - 1;

    fitSideColumns();
  }

  prevBtn.addEventListener('click', function () {
    activeIndex = Math.max(0, activeIndex - 1);
    renderCoverflow();
  });

  nextBtn.addEventListener('click', function () {
    activeIndex = Math.min(goodNewsItems.length - 1, activeIndex + 1);
    renderCoverflow();
  });

  renderCoverflow();

  fetch(WORKER_URL + '/good-news')
    .then(function (res) {
      if (!res.ok) throw new Error('worker error');
      return res.json();
    })
    .then(function (data) {
      if (data.status !== 'ok' || !data.items || !data.items.length) {
        throw new Error('not ready yet');
      }
      goodNewsItems = data.items;
      activeIndex = Math.min(3, goodNewsItems.length - 1);
      renderCoverflow();
    })
    .catch(function () {
      statusMessage = 'Good news unavailable right now — check back later.';
      renderCoverflow();
    });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCoverflow, 150);
  });
})();
