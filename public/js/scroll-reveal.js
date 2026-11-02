// Progressive text reveal: split into words (SplitText), start them in a muted alto shade, and scrub them to
// the brand's darkest shade one after another as the marked element scrolls past — one word at a time, each a
// binary switch between the two shades as far as scroll position is concerned (there's no shade in between
// that any given scroll position can show), eased by a short, fixed-time CSS transition (WORD_TRANSITION_S)
// so the switch itself doesn't look like a sudden cut, without tying that easing to scroll position at all.
//
// This is driven by a ScrollTrigger onUpdate directly setting each word's colour from the trigger's own
// progress (0 to 1), not a GSAP tween with stagger/duration/delay: that was tried, and GSAP's handling of
// delay combined with stagger inside a scrubbed tween didn't behave as documented or expected — confirmed live
// with the trigger's own markers, the first word was showing fully revealed well before the marked start
// position had even been reached, which a tween has no direct way to guard against since it hands control of
// "what counts as before the start" to GSAP's own internal timeline maths. Plain arithmetic against
// self.progress has no equivalent ambiguity: progress is exactly 0 before start and can't go negative, so
// Math.floor(progress * words.length) is exactly 0 there too, and nothing can show as revealed early.
// This still doesn't use GSAP's own pin: pin:true was tried twice on this section and both times the reveal
// simply never animated, for a reason that couldn't be pinned down without a live browser to inspect. Instead,
// waiting for the user to be fully inside the section before anything starts is achieved on the CSS side
// (views/public/index.ejs's comment on <footer> covers it: a plain position: sticky element inside a
// deliberately taller <footer>), and this script just has to scrub across however long that sticky element
// stays visually held in place — trigger is the tall <footer> itself, not the paragraph, and start/end are its
// own top and bottom, not viewport-relative percentages.
//
// The same trigger also drives the ghost grid behind the paragraph (data-cell-grid, see createCellGrid below):
// one progress value, two things reading it, so the words and the cells always finish together. On a device with
// a hovering, precise pointer the grid also reacts to the cursor with a fading trail, and a click or tap sets off
// a ripple across it, both only once every cell has been highlighted. While the reveal is still under way, a
// "keep scrolling" toast (data-scroll-toast) is up.
//
// Progressive enhancement: without this script, GSAP, SplitText or ScrollTrigger, or with reduced motion, a
// marked element is left exactly as the markup renders it (plain, already-dark text, ordinary scrolling, no
// grid), so nothing here can make text unreadable or depend on JS to become legible.
(() => {
  const targets = [...document.querySelectorAll('[data-scroll-reveal]')];
  if (!targets.length) return;
  if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const START_DELAY_VH = 0.1; // extra scroll, as a fraction of the viewport's height, held back once the section has fully arrived before the first word can turn — a "settling in" with nothing happening yet, rather than the reveal starting on the very tick that finishes the arrival
  const END_SLACK_PX = 4; // how far short of the very bottom of the page the reveal counts as finished, so that it always finishes (see holdEnd below)
  const TOAST_IN_S = 0.5; // time for the "keep scrolling" toast to rise into view
  const TOAST_OUT_S = 0.3; // time for it to drop away again
  const TOAST_SLIDE_PX = 16; // how far below its resting place it waits, and returns to on its way out
  const WORD_TRANSITION_S = 0.25; // real time (not scroll-scrubbed) for a single word's own colour swap to ease in, once it happens — softens the jump from one shade to the other without reintroducing a scroll-position-dependent blend, since it's a plain CSS transition riding on top of the still-binary colour set below, not part of the scroll maths itself

  // Read the two colours from the theme itself (src/input.css's --color-alto-300 and --color-bunker-950)
  // instead of duplicating their hex values here, so this stays in step if the palette ever changes.
  const theme = getComputedStyle(document.documentElement);
  const START_COLOR = theme.getPropertyValue('--color-alto-300').trim();
  const END_COLOR = theme.getPropertyValue('--color-bunker-950').trim();
  // The cells' borders start one shade lighter than the words so the grid stays behind the text, and end on
  // a mid gray rather than the words' near-black so it never competes with it.
  const CELL_START_COLOR = theme.getPropertyValue('--color-alto-200').trim();
  const CELL_END_COLOR = theme.getPropertyValue('--color-alto-400').trim();
  const CELL_TARGET_REM = 6; // roughly how wide a cell should be, in rem; the real width is whatever makes a whole number of cells span the grid's width exactly
  // The cells' other layer is a background tint, shared by the cursor trail and the click ripple below; each
  // sets how opaque it gets, as a percentage of TINT_COLOR over the page.
  const TINT_COLOR = theme.getPropertyValue('--color-bunker-950').trim();
  // The cursor trail: cells near the pointer are tinted, and the tint fades out behind it.
  const TRAIL_MAX_PERCENT = 12; // opacity of the cell right under the pointer
  const TRAIL_RADIUS = 2.5; // how far the tint reaches from the pointer, in cells
  const TRAIL_CORE = 0.5; // within this many cells of the pointer the tint is at full strength, so it doesn't pulse as the pointer crosses a cell
  const TRAIL_FADE_S = 1.2; // time for a fully lit cell to fade out completely
  // The click ripple: a ring that expands from the clicked cell across the whole grid, tinting the cells it
  // passes and shrinking them, so the wave reads as something moving through the grid and not only a colour.
  const RIPPLE_MAX_PERCENT = 22; // opacity of the ring's leading edge at the clicked cell; it thins out as the ring travels
  // Shrinking, not growing: neighbouring cells that grow overlap each other, and their translucent tints and
  // borders pile up into darker seams and doubled lines. Shrinking cells open small gaps between separate
  // tiles instead, so the wave stays crisp however strong it is.
  const RIPPLE_SHRINK = 0.22; // how much smaller a cell gets at the peak of the wave, as a fraction of its size: 0.22 is 22% narrower and shorter; 0 for no size change
  const RIPPLE_SPEED = 40; // how fast the ring expands, in cells per second
  const RIPPLE_WIDTH = 7; // how far behind its leading edge the ring's tint trails off to nothing, in cells; wide enough that the ring reads as a band across several cells, since with only one or two the round wave turns into a jagged line on a grid of squares
  const RIPPLE_MAX_CONCURRENT = 6; // rapid clicking keeps the oldest ripples going but drops the oldest beyond this, so the per-frame work stays bounded

  // Fills gridEl with square cells and returns reveal(progress), which switches cells from the start border
  // colour to the end one, in reading order, as progress (0 to 1) grows: the same hard switch, eased by the
  // same short CSS transition, as the words above, so the two read as one effect.
  //
  // It also lets the cells react to the pointer (listenEl is what it is tracked on), painted as a background
  // tint. That is a separate channel from the reveal above, which owns the border colour, so the two layer
  // instead of fighting over one property. The pointer is tracked on listenEl as a whole, not on the cells,
  // since the grid takes no pointer events (the paragraph sits above it), and the cell under it is worked out
  // from its position instead. Both are switched off until every cell has been highlighted (ready()), and
  // whatever is still fading when the reveal is undone by scrolling back up just finishes fading. Two things
  // paint that tint, and a cell shows whichever is stronger:
  //  - a trail, on a device with a hovering, precise pointer: each cell has a "heat" from 0 to 1 that the
  //    pointer raises within TRAIL_RADIUS of it and a requestAnimationFrame loop drains at a fixed rate. Moves
  //    are filled in along the line from the previous position, so a fast swipe leaves a continuous trail, not
  //    a dotted one.
  //  - a ripple on click (or tap, so on any device): a ring expanding from the clicked cell. It isn't
  //    scheduled cell by cell; each frame works a cell's tint out from how far the ring's leading edge has
  //    travelled compared with the cell's distance from the origin, so there are no timers to clean up and a
  //    resize can't leave any behind. The same number also shrinks the cell (a transform: scale, which moves
  //    nothing else in the layout) as the ring passes, and lets it settle back after.
  // The loop only runs while something is still lit or travelling.
  //
  // The columns are chosen to fit gridEl's parent's width (round(width / target)) and the cell size is what
  // makes them span it exactly, so the grid lines up with the eyebrow's line above; the rows are however
  // many of those squares fit in the parent's height, centred, so the grid is concentric with the paragraph
  // rather than cut off mid-cell at the bottom. It is rebuilt whenever the parent is resized.
  //
  // Cells overlap their neighbours by 1px (negative right and bottom margin) so a shared edge is drawn once,
  // not doubled to 2px; the price is that whichever cell paints last owns that edge's colour, so a revealed
  // cell gets z-index 1 to always paint over its unrevealed neighbours. Grid items honour z-index without
  // being positioned. That way a revealed cell is outlined in the end colour on all four sides whatever order
  // the cells are revealed in.
  const createCellGrid = (gridEl, listenEl) => {
    const region = gridEl.parentElement;
    let cells = [];
    let cols = 0;
    let rows = 0;
    let size = 0; // one cell's width and height, in px
    let progress = 0;
    let shown = 0; // how many of the cells, from the first, are currently in the end colour
    let heat = new Float32Array(0); // per cell, how lit the trail has it, 0 to 1
    // The trail and the ripple wait until every cell has been highlighted, so the grid is a reward for
    // scrolling all the way through the reveal and not something that competes with it while it is still
    // being uncovered.
    const ready = () => cells.length > 0 && shown === cells.length;
    const lit = new Set(); // indices of the cells whose heat is above 0
    let ripples = []; // the rings still travelling: { x, y (origin, in cells), at (when it started), reach (the radius at which its tail has left the grid) }
    let sweeping = false; // whether the last frame had to visit every cell for a ripple, so the frame after it still knows to clear whatever that left behind
    let painted = new Float64Array(0); // per cell, the tint percentage last written to its background (64-bit, so the comparison against the next value isn't thrown off by rounding)
    let scaled = new Float64Array(0); // per cell, the scale last written to its transform, 1 when it has none
    let frame = 0; // the pending animation frame, or 0 when the loop is idle
    let lastFrameAt = 0;

    const setCell = (cell, on) => {
      cell.style.borderColor = on ? CELL_END_COLOR : CELL_START_COLOR;
      cell.style.zIndex = on ? '1' : '';
    };

    const reveal = (p) => {
      progress = p;
      const count = Math.floor(p * cells.length);
      if (count === shown) return;
      // Only the cells between the old count and the new one change, whichever way the scroll went.
      const from = Math.min(count, shown);
      const to = Math.max(count, shown);
      for (let i = from; i < to; i++) setCell(cells[i], i < count);
      shown = count;
    };

    // Writes a tint (a percentage) and a scale to a cell; each is skipped when it is what is already there.
    const paint = (i, percent, scale) => {
      percent = Math.round(percent * 100) / 100;
      scale = Math.round(scale * 1000) / 1000;
      const style = cells[i].style;
      if (percent !== painted[i]) {
        painted[i] = percent;
        style.backgroundColor = percent > 0 ? `color-mix(in srgb, ${TINT_COLOR} ${percent}%, transparent)` : '';
      }
      if (scale !== scaled[i]) {
        scaled[i] = scale;
        style.transform = scale === 1 ? '' : `scale(${scale})`;
      }
    };

    // Smoothstep, so the trail's tint eases in and out of its edges instead of dropping off linearly.
    const trailPercent = (h) => TRAIL_MAX_PERCENT * h * h * (3 - 2 * h);

    // What the strongest travelling ring does to cell i at time now, as two numbers from 0 to 1 in wave: how
    // tinted it is (wave.tint) and how shrunk (wave.dip). Both come from how far behind the ring's leading
    // edge the cell is, which is nothing until the edge reaches it.
    //  - The tint is at full strength the moment the edge arrives and fades (to the power 1.5, so fastest at
    //    first) over the RIPPLE_WIDTH the edge then travels beyond the cell.
    //  - The dip rises almost as fast, peaks about a quarter of that width behind the edge, then settles back
    //    to nothing by the end of it: a sine of the square root of the fraction of the width travelled. The
    //    square root pulls the peak in from the middle of the band towards the edge, so the cells shrink
    //    with the tint's front and not visibly after it.
    // The ring as a whole also thins out with distance from its origin, down to a quarter of its strength by
    // the time its tail leaves the far corner. Written into one shared object, not returned, so a frame's few
    // hundred cells don't each allocate one.
    const wave = { tint: 0, dip: 0 };
    const sampleRipples = (i, now) => {
      const cx = (i % cols) + 0.5;
      const cy = Math.floor(i / cols) + 0.5;
      let tint = 0;
      let dip = 0;
      ripples.forEach((r) => {
        const radius = Math.max(0, now - r.at) / 1000 * RIPPLE_SPEED;
        const behind = radius - Math.hypot(cx - r.x, cy - r.y); // how far the leading edge has travelled past this cell
        if (behind < 0 || behind > RIPPLE_WIDTH) return;
        const travelled = behind / RIPPLE_WIDTH;
        const thinning = 1 - 0.75 * (radius / r.reach);
        tint = Math.max(tint, (1 - travelled) ** 1.5 * thinning);
        dip = Math.max(dip, Math.sin(Math.PI * Math.sqrt(travelled)) * thinning);
      });
      wave.tint = tint;
      wave.dip = dip;
    };

    const tick = (now) => {
      const dt = Math.min((now - lastFrameAt) / 1000, 0.1); // capped, so a tab that was in the background doesn't wipe the trail in one jump
      lastFrameAt = now;
      lit.forEach((i) => {
        heat[i] = Math.max(0, heat[i] - dt / TRAIL_FADE_S);
        if (!heat[i]) lit.delete(i);
      });
      ripples = ripples.filter((r) => Math.max(0, now - r.at) / 1000 * RIPPLE_SPEED < r.reach);
      if (ripples.length || sweeping) {
        // A ring can touch any cell, so while one travels every cell is visited. That's a few hundred cheap
        // calculations a frame. One more sweep after the last ring has gone, so the cells it lit are cleared.
        for (let i = 0; i < cells.length; i++) {
          sampleRipples(i, now);
          paint(i, Math.max(trailPercent(heat[i]), RIPPLE_MAX_PERCENT * wave.tint), 1 - RIPPLE_SHRINK * wave.dip);
        }
        sweeping = ripples.length > 0;
      } else {
        lit.forEach((i) => paint(i, trailPercent(heat[i]), 1));
      }
      frame = lit.size || ripples.length || sweeping ? requestAnimationFrame(tick) : 0;
    };

    const wake = () => {
      if (frame) return;
      lastFrameAt = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const warm = (i, h) => {
      if (h <= heat[i]) return;
      heat[i] = h;
      lit.add(i);
      wake();
    };

    // Starts a ring from the middle of cell (col, row).
    const ripple = (col, row) => {
      const x = col + 0.5;
      const y = row + 0.5;
      // The far corner is the last cell the ring reaches; add the width so its tail has left by then too.
      const reach = Math.hypot(Math.max(x, cols - x), Math.max(y, rows - y)) + RIPPLE_WIDTH;
      ripples.push({ x, y, at: performance.now(), reach });
      if (ripples.length > RIPPLE_MAX_CONCURRENT) ripples.shift();
      wake();
    };

    // Lights the cells around a point given in cells (fx, fy), measured from the grid's top-left corner, so
    // (0.5, 0.5) is the middle of the first cell. Heat is full within TRAIL_CORE of the point and falls off
    // linearly to nothing at TRAIL_RADIUS, measured from each cell's centre.
    const feed = (fx, fy) => {
      const colFrom = Math.max(0, Math.floor(fx - TRAIL_RADIUS));
      const colTo = Math.min(cols - 1, Math.ceil(fx + TRAIL_RADIUS));
      const rowFrom = Math.max(0, Math.floor(fy - TRAIL_RADIUS));
      const rowTo = Math.min(rows - 1, Math.ceil(fy + TRAIL_RADIUS));
      for (let row = rowFrom; row <= rowTo; row++) {
        for (let col = colFrom; col <= colTo; col++) {
          const d = Math.hypot(fx - (col + 0.5), fy - (row + 0.5));
          if (d < TRAIL_RADIUS) warm(row * cols + col, 1 - Math.max(0, d - TRAIL_CORE) / (TRAIL_RADIUS - TRAIL_CORE));
        }
      }
    };

    const layout = () => {
      const width = region.clientWidth;
      const height = region.clientHeight;
      if (!width || !height) return;
      const target = parseFloat(getComputedStyle(document.documentElement).fontSize) * CELL_TARGET_REM;
      const nextCols = Math.max(1, Math.round(width / target));
      // The -1px margin makes the last column and row poke 1px past their tracks, so the tracks are sized
      // to leave that pixel over: cols * size + 1 is exactly the width.
      size = (width - 1) / nextCols;
      const nextRows = Math.max(1, Math.floor((height - 1) / size));
      gridEl.style.gridTemplateColumns = `repeat(${nextCols}, ${size}px)`;
      gridEl.style.gridAutoRows = `${size}px`;
      if (nextCols === cols && nextRows === rows) return;
      cols = nextCols;
      rows = nextRows;
      const fragment = document.createDocumentFragment();
      cells = Array.from({ length: cols * rows }, () => {
        const cell = document.createElement('span');
        cell.style.cssText = `border: 1px solid ${CELL_START_COLOR}; margin: 0 -1px -1px 0; transition: border-color ${WORD_TRANSITION_S}s ease-out;`;
        fragment.appendChild(cell);
        return cell;
      });
      gridEl.replaceChildren(fragment);
      // A new set of cells is all in the start colour and unlit; bring it up to wherever the scroll currently is.
      heat = new Float32Array(cells.length);
      painted = new Float64Array(cells.length);
      scaled = new Float64Array(cells.length).fill(1);
      lit.clear();
      ripples = [];
      sweeping = false;
      shown = 0;
      reveal(progress);
    };

    layout();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(layout).observe(region);

    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      let last = null; // the previous pointer position in cells, and when it happened, while the pointer is moving continuously
      listenEl.addEventListener(
        'pointermove',
        (e) => {
          if (!size || !ready()) return;
          const rect = gridEl.getBoundingClientRect();
          const x = (e.clientX - rect.left) / size;
          const y = (e.clientY - rect.top) / size;
          // Fill in along the line from the last position (in steps of at most half a cell) so a fast swipe
          // doesn't skip cells, but not from one that is old: after a pause the pointer may have come back
          // from anywhere, and a long line across the grid would be wrong.
          if (last && e.timeStamp - last.t < 100) {
            const steps = Math.ceil(Math.hypot(x - last.x, y - last.y) / 0.5);
            for (let s = 1; s < steps; s++) feed(last.x + ((x - last.x) * s) / steps, last.y + ((y - last.y) * s) / steps);
          }
          feed(x, y);
          last = { x, y, t: e.timeStamp };
        },
        { passive: true }
      );
      listenEl.addEventListener('pointerleave', () => (last = null));
    }

    // Not behind the hover check above: a tap sets off a ripple as well. It's the click event, not
    // pointerdown, so that a finger that starts a scroll on the grid doesn't fire one.
    listenEl.addEventListener('click', (e) => {
      if (!size || !ready()) return;
      const rect = gridEl.getBoundingClientRect();
      const col = Math.floor((e.clientX - rect.left) / size);
      const row = Math.floor((e.clientY - rect.top) / size);
      if (col >= 0 && col < cols && row >= 0 && row < rows) ripple(col, row);
    });
    // Clicking again and again on the paragraph would otherwise select a word (double click) or the whole
    // line (triple) each time; only that repeat-click selection is stopped, dragging to select text still works,
    // and only once clicking does something, since before then it's an ordinary click on ordinary text.
    listenEl.addEventListener('mousedown', (e) => {
      if (e.detail > 1 && ready()) e.preventDefault();
    });
    return reveal;
  };

  targets.forEach((el) => {
    // <footer> is what views/public/index.ejs's comments call "its own full screen" (plus the extra one
    // behind it for this to scrub across); falling back to the immediate parent keeps this working if
    // data-scroll-reveal is ever used somewhere without a <footer> ancestor.
    const section = el.closest('footer') || el.parentElement;
    const split = SplitText.create(el, { type: 'words' });
    gsap.set(split.words, { color: START_COLOR });
    split.words.forEach((word) => {
      word.style.transition = `color ${WORD_TRANSITION_S}s ease-out`;
    });
    const gridEl = section.querySelector('[data-cell-grid]');
    const revealCells = gridEl ? createCellGrid(gridEl, section) : null;
    // Where the sticky element's hold ends, as a scrollY position: <footer>'s bottom reaching the viewport's
    // bottom, less END_SLACK_PX. The page can't scroll past its own bottom, which is exactly where this is
    // without the slack, so a fractional pixel of rounding (a fractional devicePixelRatio, a dvh that isn't a
    // whole number of px) that left the page a hair short of it would leave the last word and cell unrevealed
    // and the trail and ripple, which wait for every cell, permanently locked. Shared by both triggers below.
    const holdEnd = () => section.offsetTop + section.offsetHeight - window.innerHeight - END_SLACK_PX;
    ScrollTrigger.create({
      trigger: section,
      // The sticky inner element (see views/public/index.ejs) holds in place for exactly the scroll distance
      // between <footer>'s own top reaching the viewport's top and its bottom reaching the viewport's bottom
      // — nothing is left to scrub past the second point, since the sticky element has already released and
      // started scrolling away by then. Before the first point, plus a bit further still (START_DELAY_VH's
      // worth), nothing happens either: the reveal doesn't begin the instant arrival finishes, it waits for
      // one small scroll more.
      // Computed as plain scrollY pixel positions (offsetTop, offsetHeight) rather than GSAP's own "top top"
      // / "bottom bottom" keyword strings: checked live with the trigger's markers, those keywords were
      // landing well off from where <footer>'s content actually arrives — most likely GSAP's own automatic
      // measurement getting thrown off by the position: sticky descendant inside this trigger, a known rough
      // edge with that combination. offsetTop/offsetHeight read <footer>'s own box directly and aren't
      // affected by what's sticky (or not) inside it.
      start: () => section.offsetTop + window.innerHeight * START_DELAY_VH,
      end: holdEnd,
      scrub: true,
      onUpdate: (self) => {
        // A hard cut, not a blend: every word up to this index is fully END_COLOR, every word from here on is
        // fully START_COLOR, with nothing in between — no interpolation, no per-word timing for GSAP to get
        // wrong, just this one comparison per word per scroll update.
        const revealedCount = Math.floor(self.progress * split.words.length);
        split.words.forEach((word, i) => {
          word.style.color = i < revealedCount ? END_COLOR : START_COLOR;
        });
        if (revealCells) revealCells(self.progress);
      },
    });

    // The "keep scrolling" toast (data-scroll-toast, see views/public/index.ejs) is up for as long as the
    // sticky element is holding and the reveal isn't finished: from <footer>'s top reaching the viewport's top
    // (the section has fully arrived, which is before the reveal itself starts, by START_DELAY_VH) until
    // holdEnd, where every word and cell is revealed and there is nothing left to scroll for. Scrolling back
    // up past the first point takes it away again, and scrolling down to the end does too, so it is exactly
    // "this trigger is active", which is what onToggle reports; no progress maths of its own to drift out of
    // step with the reveal's. Same explicit pixel positions as the reveal's trigger, for the same reason.
    const toast = document.querySelector('[data-scroll-toast]');
    if (toast) {
      const arrow = toast.querySelector('iconify-icon');
      // Rests hidden, and slid down by TOAST_SLIDE_PX so it rises into place; autoAlpha also keeps it from
      // the keyboard and the pointer while it is invisible.
      gsap.set(toast, { autoAlpha: 0, y: TOAST_SLIDE_PX });
      // The arrow bobs while the toast is up and is held still otherwise, so nothing runs while it's hidden.
      const bob = arrow ? gsap.to(arrow, { y: 4, duration: 0.7, ease: 'sine.inOut', repeat: -1, yoyo: true, paused: true }) : null;
      ScrollTrigger.create({
        start: () => section.offsetTop,
        end: holdEnd,
        onToggle: (self) => {
          const up = self.isActive;
          gsap.to(toast, { autoAlpha: up ? 1 : 0, y: up ? 0 : TOAST_SLIDE_PX, duration: up ? TOAST_IN_S : TOAST_OUT_S, ease: up ? 'power3.out' : 'power2.in', overwrite: 'auto' });
          if (bob) up ? bob.play() : bob.pause();
        },
      });
    }
  });

  // This measures the page as soon as the script runs, which can be before the custom fonts (Supreme, see
  // src/input.css) have actually finished loading and before loader.js's own intro has finished settling
  // everything into its final layout — either can shift where the footer and its content actually end up
  // just enough that the positions calculated here no longer match, which reads as the reveal firing at the
  // wrong scroll position rather than not firing at all. Refreshing again once fonts are confirmed loaded, once
  // more after the window's own load event, and once more again once the loader is gone (every path in
  // loader.js ends in loader.remove(), including its GIVE_UP_MS fallback, so this fires however the intro
  // actually finishes) recalculates every trigger against the page's settled state.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
  window.addEventListener('load', () => ScrollTrigger.refresh());
  const loaderEl = document.getElementById('loader');
  if (loaderEl && loaderEl.parentElement) {
    const loaderGone = new MutationObserver(() => {
      if (!document.getElementById('loader')) {
        ScrollTrigger.refresh();
        loaderGone.disconnect();
      }
    });
    loaderGone.observe(loaderEl.parentElement, { childList: true });
  }
})();

// Line slide-up reveal: each of the paragraph's hand-authored lines (data-line-reveal, see
// views/public/index.ejs — a real pair of nested <span>s per line, not SplitText's own line-splitting, which
// broke this paragraph three separate times before and is deliberately not used again here) starts translated
// fully below its own static mask (the wrapping overflow-hidden <span>) and slides up into place, the same
// technique loader.js already uses for the nav's own links, once the line has scrolled into view. It's a
// plain, one-off entrance, entirely independent of the colour reveal above and its ScrollTrigger — a separate
// IIFE, no shared state, so a bug in one can't touch the other.
//
// Deliberately not another ScrollTrigger: the section this sits inside is a position: sticky descendant (see
// the colour reveal's own comment on why that combination needed extra care with ScrollTrigger's start/end
// maths). An IntersectionObserver has no equivalent ambiguity to worry about — it just reports whether the
// element is actually on screen, regardless of what's sticky nearby — so it's used here instead.
//
// Progressive enhancement: without this script, GSAP or IntersectionObserver, or with reduced motion, a line
// is left exactly as the markup renders it (plain, already-in-place text), so nothing here can hide text
// permanently or depend on JS to become visible.
(() => {
  const lines = [...document.querySelectorAll('[data-line-reveal]')];
  if (!lines.length) return;
  if (typeof gsap === 'undefined' || typeof IntersectionObserver === 'undefined') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const LINE_S = 0.7; // time for a line to slide up into place; the same as the nav's own LINK_S in loader.js
  const VISIBLE_FRACTION = 0.15; // how far up from the bottom of the viewport a line counts as "visible" and starts its slide, as a fraction of the viewport's height

  gsap.set(lines, { yPercent: 100 });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        gsap.to(entry.target, { yPercent: 0, duration: LINE_S, ease: 'power3.out' });
        // One-off, like the nav's own reveal: once a line has made its entrance it stays, so there's nothing
        // left to watch for it.
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: `0px 0px -${VISIBLE_FRACTION * 100}% 0px` }
  );
  lines.forEach((line) => observer.observe(line));
})();
