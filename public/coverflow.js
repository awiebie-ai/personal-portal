(function () {
  var goodNewsItems = [
    {
      title: 'White Storks Return to English Midlands After 600 Years',
      snippet: 'A breeding population of white storks has re-established itself in the English Midlands for the first time since the birds vanished from the region roughly six centuries ago. The comeback is the result of a years-long reintroduction effort that released captive-bred storks onto restored wetland and parkland habitat, then waited for wild pairs to nest and fledge chicks on their own. Conservationists say the milestone shows how quickly a lost species can return once the right habitat is back in place. (Good News Network)'
    },
    {
      title: 'DoorDash Driver Showered With Wedding Gifts After Viral Note',
      snippet: 'A delivery driver who tucked a short note about his upcoming wedding into a food bag had no idea it would reach thousands of strangers. After the customer shared it online, the post spread quickly, and people began sending the couple gifts, cards, and contributions toward their big day. The driver said he was stunned that a small, personal aside meant only for one customer ended up turning into support from an entire online community. (Good News Network)'
    },
    {
      title: 'A Neighbor’s Loud Music Led to an Unlikely Family',
      snippet: 'When a woman went upstairs to ask a neighbor to turn the music down, she found an 86-year-old widow living alone with no family nearby. What began as a courtesy visit turned into regular check-ins, then shared meals, then something closer to kinship. The two now describe each other as family, with the younger woman taking on the role of the granddaughter the older woman never had — proof that a minor annoyance can be the start of real connection. (Sunny Skyz)'
    },
    {
      title: 'Idaho Teens Turn Viral Fame Into a River Cleanup Mission',
      snippet: 'A group of Idaho teenagers who built a following online chronicling their summer decided to put that attention to use, organizing volunteers to pull trash out of the Boise River. What started as a single cleanup day has grown into an ongoing effort, with the teens using their platform to recruit more hands and keep momentum going through the season. Local residents say the river is visibly cleaner, and the group hopes the project outlasts the summer that inspired it. (Sunny Skyz)'
    },
    {
      title: 'A Traveling Library Brings Books to Children in Rural Syria',
      snippet: 'A colorfully painted bus loaded with books, puppets, and art supplies now travels between towns in war-affected parts of Syria, giving children access to stories and creative activities many haven’t had in years. Volunteers running the mobile library say the sessions offer more than literacy — they give kids a stretch of normal childhood amid ongoing hardship. The project has expanded its route as demand has grown, reaching villages that have gone without a library of any kind for a decade. (Positive News)'
    },
    {
      title: 'The ‘Sisterhood’ Restoring Indonesia’s Coral Reefs',
      snippet: 'On the small island of Gili Air, a group of local women has trained as marine conservationists, transplanting coral fragments onto reef frames to help damaged sections of the ecosystem recover. The program gives the women new skills and income while directly repairing reefs that support the island’s fishing and tourism economy. Organizers say the restored patches are already drawing back fish species that had disappeared from the area, and the program is training a new cohort each season. (Reasons to Be Cheerful)'
    },
    {
      title: 'Mother-Son Duo’s ‘Terrible’ Cartoon Becomes a Box-Office Hit',
      snippet: 'An animated film about a cow, made by a Chinese mother-and-son team with none of the polish of a major studio production, became a surprise commercial success after word of mouth turned it into a theater draw. Audiences embraced its rough-around-the-edges charm rather than being put off by it, and the pair’s low-budget passion project ended up outperforming far more expensive releases. The story has become a feel-good case study in what resonates with audiences when sincerity beats polish. (Upworthy)'
    }
  ];

  var page = document.querySelector('.page');
  var grid = document.querySelector('.grid');
  var colCenter = document.querySelector('.col-center');
  var viewport = document.querySelector('.coverflow-viewport');
  var track = document.getElementById('coverflowTrack');
  var nav = document.querySelector('.coverflow-nav');
  var prevBtn = document.getElementById('cfPrev');
  var nextBtn = document.getElementById('cfNext');
  var activeIndex = Math.min(3, goodNewsItems.length - 1);

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

    var cardHeight = Math.round(viewportHeight * 0.88);
    var cardWidth = Math.round(cardHeight * CARD_RATIO);

    track.innerHTML = '';

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

      var title = document.createElement('div');
      title.className = 'cf-title';
      title.textContent = item.title;
      card.appendChild(title);

      var snippet = document.createElement('div');
      snippet.className = 'cf-snippet';
      snippet.textContent = item.snippet;
      card.appendChild(snippet);

      track.appendChild(card);

      var available = cardHeight - CARD_PADDING_V - title.offsetHeight - SNIPPET_GAP;
      var maxLines = Math.max(1, Math.floor(available / SNIPPET_LINE_HEIGHT));
      snippet.style.webkitLineClamp = String(maxLines);

      card.addEventListener('click', function () {
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

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderCoverflow, 150);
  });
})();
