(function () {
  var goodNewsItems = [
    {
      title: 'Community Garden Feeds 200 Families',
      snippet: 'A once-vacant lot on the east side has been transformed into a thriving community garden that now supplies fresh produce to roughly two hundred families each week. Volunteers rotate shifts to tend rows of tomatoes, squash, and leafy greens, while a local culinary school donates surplus seedlings every spring. Organizers say the harvest table, open every Saturday morning, has become a gathering spot as much as a food source, with neighbors trading recipes and tips long after the baskets are empty.'
    },
    {
      title: 'Teen Invents Low-Cost Water Filter',
      snippet: 'A sixteen-year-old student built a low-cost water filter using layered sand, charcoal, and repurposed plastic bottles after seeing reports of contaminated wells near rural schools. Early tests show the design removes the vast majority of common bacteria at a fraction of commercial filter prices. The teen has since partnered with a local nonprofit to distribute kits to a dozen schools, and engineering mentors are helping refine the build so students can assemble it with hardware-store materials.'
    },
    {
      title: 'Shelter Finds Homes for Every Dog',
      snippet: 'For the first time in its fifteen-year history, the county animal shelter reported an empty kennel this week after every dog in its care was adopted during a month-long fee-waived event. Staff credit a mix of expanded weekend hours, partnerships with local pet stores for meet-and-greets, and a social media push that turned several long-term residents into local minor celebrities. The shelter says it is already preparing foster placements to keep pace if intake rises again in the coming weeks.'
    },
    {
      title: 'Solar Co-op Cuts Bills by 40%',
      snippet: 'A resident-run solar cooperative that pooled panels across forty rooftops has cut member electric bills by roughly forty percent since going live last spring. The group negotiated bulk pricing on equipment and installation, then split the output using a shared metering agreement worked out with the utility. Founders say the model is easy to replicate and are now helping two neighboring communities set up their own co-ops, with a goal of reaching a thousand connected rooftops within three years.'
    },
    {
      title: 'Free Tutoring Program Hits 500 Students',
      snippet: 'A retired schoolteacher who started tutoring a handful of neighborhood kids at her kitchen table five years ago now runs a free after-school program serving more than five hundred students across three locations. Volunteer tutors, many of them former students themselves, cover everything from basic reading to algebra, and the program recently added a small lending library stocked entirely through community donations. Organizers say the biggest challenge now is simply finding enough space.'
    },
    {
      title: 'New Hospital Wing Opens After Fundraiser',
      snippet: 'A community fundraiser that ran for just under two years has paid for a new hospital wing, adding twenty beds and a dedicated pediatric unit to a facility that had been operating well beyond capacity. Local businesses matched individual donations dollar for dollar during the campaign’s final months, helping the effort clear its goal three months ahead of schedule. Administrators say the new wing will cut emergency room wait times and let more patients stay close to home for treatment.'
    },
    {
      title: 'Volunteers Restore Historic Park Pond',
      snippet: 'A crumbling pond in one of the city’s oldest parks has been fully restored after a two-year volunteer effort that removed decades of sediment and reintroduced native plants along its banks. The project also brought back a resident population of turtles and herons that had disappeared as the water quality declined. Neighbors who organized weekend cleanup crews say the pond is now a favorite stop on morning walks, and the parks department has committed to regular maintenance to keep it that way.'
    }
  ];

  var page = document.querySelector('.page');
  var grid = document.querySelector('.grid');
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
    var pageGap = parseFloat(getComputedStyle(page).rowGap) || 0;
    var navMarginTop = parseFloat(getComputedStyle(nav).marginTop) || 0;

    var contentBottom = page.getBoundingClientRect().bottom - pagePaddingBottom;
    var sectionTop = grid.getBoundingClientRect().bottom + pageGap;
    var sectionHeight = contentBottom - sectionTop;
    var navHeight = nav.getBoundingClientRect().height;

    var viewportHeight = sectionHeight - navMarginTop - navHeight;
    return Math.min(Math.max(Math.round(viewportHeight), 60), MAX_VIEWPORT_HEIGHT);
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
