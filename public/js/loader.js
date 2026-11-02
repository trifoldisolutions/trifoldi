// Landing-page loader: the .trifoldi wordmark starts as an outline and fills from the baseline up as the
// page finishes loading, then slides up into its place in the nav while the overlay clears. Once it has
// landed, the middle of the page comes in first, on its own: the headline's letters slide into view from
// behind their own masks (the top line's from below, the bottom line's from above), each line at its own
// pace. As soon as the top line has landed, while the bottom line may still be landing, the photo strip opens
// under the two lines: each photo starts as a thin line that draws out from its middle while it grows into
// a rectangle that uncovers the photo, all of them together, and the row, as tall as they are, pushes the two
// lines up to make room. The strip is timed to finish growing exactly as the bottom line lands, so the whole
// headline and the strip settle together.
// As the strip opens, its borders hit the text and the letters themselves give a slight bounce, one after
// another from left to right: each goes a touch further up, the way it was pushed, and settles back. As
// the letters land, the round buttons at the end of the headline's lines pop in. The strip scrolls, right to
// left, for ever, from the moment the loader starts, so it is already moving as the photos are uncovered; it
// stands still while a photo is hovered, and a round button with an arrow takes the pointer's place over it.
// Once the strip is open it can also be scrolled by hand, with the wheel, a swipe or a drag: it follows the input
// and, when that stops, carries on and slows down gradually, and the photos trail the pointer like water dragged
// along by a hand: the ones behind it are late, so the gaps open up as the strip picks up speed and close again as
// it slows down. A tiny pause / play button under the strip's right end stops and restarts the strip's own scroll.
// Under the strip's left end, the active project's name and category stay put while the strip goes by, and change
// as each photo's left edge reaches the line the headline's text starts on; that photo is in colour (stripInfo).
// Clicking a photo opens it: a copy of it grows from its place in the strip to fill the whole screen (stripExpand),
// which is the effect the page transitions will use. For now it stays until it is clicked or Escape is pressed, and
// then shrinks back to its place. The strip stands still meanwhile.
// Inside its box each photo is drawn a little bigger and slides against the box's travel, for a parallax: a little
// with where the box is on screen, and more, trailing the box, while the strip is moving.
// The rest of the page waits until the middle has arrived (both lines of text landed and the strip fully
// open), and then comes in together, while the round buttons are still popping in and the letters settling from
// their bounce: the nav links slide in from their own containers and the line under the nav grows from the
// middle out to the sides. The footer's eyebrow, which peeks in at the bottom of the first screen, comes in with
// them: its line grows the same way and its label slides up out of its row. The footer's paragraph
// (data-scroll-reveal) has no load-timed reveal; it turns from muted to full colour on scroll instead, in
// public/js/scroll-reveal.js, independently of this load sequence.
//
// The fill follows real loading. When the loader appears, whatever is still pending (fonts, images, the
// window `load` event) becomes a list of tasks, and the fill is the fraction of them that have finished.
// Nothing here sets how long loading takes: a page with nothing left to wait for fills straight away, and
// a heavy one fills as its assets arrive. The only fixed times are cosmetic (SWEEP_S, FLIGHT_S, LINK_S,
// LINE_S, FOOTER_*, HEADLINE_S, REST_START_S, BUTTON_S, STRIP_*, CURSOR_*) plus a safety net (GIVE_UP_MS) so a stalled asset can't leave the overlay up for ever.
(() => {
  const SWEEP_S = 0.6; // time for the fill to travel the whole word; smaller steps take proportionally less
  const FLIGHT_S = 0.9; // time for the wordmark to slide up into the nav
  const LINK_S = 0.7; // time for each nav link to slide up out of its container
  const LINK_STAGGER_S = 0.07; // delay between neighbouring links, moving outward from the wordmark
  const LINE_S = 1; // time for the nav line to grow from the middle out to both sides; the footer's line takes the same
  const FOOTER_S = 0.7; // time for each line of the footer's text to slide up out of its container
  const FOOTER_STAGGER_S = 0.07; // delay between neighbouring lines of the footer's text: top to bottom in the paragraph, column by column (label, then value) on the right
  const HEADLINE_S = 0.9; // time for each headline letter to slide into view
  const HEADLINE_STAGGER_S = 0.035; // delay between neighbouring letters, left to right
  const HEADLINE_DELAY_S = 0.2; // the headline starts this long after the wordmark lands
  const REST_START_S = 0; // the nav and the footer start this long after the headline's two lines have landed and the strip is open; negative is earlier, so they begin while the last letters are still landing, positive is later
  const HEADLINE_BOUNCE_EM = 0.08; // how far past its place a pushed letter goes before settling back, in em of the headline size; 0 for no bounce. Each letter's mask has room for about 0.13 above and below the glyph, and anything further would be cut off
  const HEADLINE_BOUNCE_HIT_S = 0.2; // the bounce starts this long after the photo strip starts to open, which is when its borders hit the text; smaller is sooner, but never before the first letters have landed (HEADLINE_S)
  const HEADLINE_BOUNCE_UP_S = 0.4; // time from a letter starting to bounce to its furthest point
  const HEADLINE_BOUNCE_DOWN_S = 0.55; // time to settle back from there
  const HEADLINE_BOUNCE_STAGGER_S = 0.025; // delay between neighbouring letters' bounces, left to right; 0 for all at once
  const BUTTON_S = 0.6; // time for each headline button to fade and scale in
  const BUTTON_STAGGER_S = 0.12; // delay between the two buttons, top line first
  const STRIP_START_S = -0.5; // the strip starts this long after the top line has landed; negative is earlier, so it is already visibly moving by the moment the letters settle, not just starting then
  const STRIP_LINE_PX = 2; // thickness of the line the strip starts as, the same as the nav line's
  const STRIP_LINE_S = 0.5; // time for each line to draw out from its middle to the photo's full width
  const STRIP_GROW_S = 1.2; // fallback time for each rectangle to grow from its line to the full photo, used only when there is no headline timing to sync to (no SplitText); otherwise this is however long is left until the bottom line lands
  const STRIP_FADE_S = 0.4; // time for each photo to fade in as its rectangle starts to grow
  const STRIP_SCROLL_S = 75; // time for the strip to scroll one full cycle (the four photos and their gaps); longer is slower
  const STRIP_HOVER_S = 0.5; // time for the scroll to slow to a standstill when a photo is hovered or the pause button is pressed, and to pick up again when the pointer leaves the photo or the button is pressed again; 0 to stop and start at once
  const STRIP_GLIDE_S = 0.5; // how long the strip keeps gliding once a scroll gesture is over: the distance still to go shrinks by about two thirds every this many seconds, so it is fast at first and takes a few of them to come to a stop; longer is glidier, shorter is tighter
  const STRIP_WHEEL_GAIN = 1.5; // how far the strip goes for each pixel of wheel or trackpad movement
  const STRIP_WHEEL_PASSES = 2; // how many full cycles the wheel must carry the user forward, net of scrolling back, before it stops trapping the page's vertical scroll (see stripGestures)
  const STRIP_FLING_MS = 100; // a drag is let go at the speed the pointer had over this last stretch of it, and the strip carries on from there
  const STRIP_WAVE_S = 0.4; // how late the water is to follow the pointer, in seconds of travel: a photo a whole row's width behind the pointer is held back by the strip's speed times this, nearer ones by proportionally less; the faster the strip goes the bigger the wave. 0 for all photos moving rigidly together
  const STRIP_WAVE_SETTLE_S = 0.25; // how slowly the wave builds up after the pointer sets off and dies away after it stops; longer is a heavier, slower-to-settle water
  const STRIP_WAVE_MAX = 0.25; // the most any photo is ever held back, as a share of the row's width; a hard flick's wave is squeezed smoothly to stay under it, so it can't fling a photo across the screen
  const STRIP_PARALLAX_SCALE = 1.2; // how much bigger each photo is drawn than its box; the spare room around it is all the sliding it has, so this is also how strong the parallax can be. 1 for no parallax
  const STRIP_PARALLAX = 0.7; // how much of that spare room a photo's position on screen uses, from the strip's right edge to its left: 0 for none, 1 for all of it. What is left over is for the lag below
  const STRIP_PARALLAX_LAG_S = 0.04; // how far a photo trails its box while the strip is moving, in seconds of the strip's speed; it slides back as the strip slows down. This is what shows when the strip is flicked
  const STRIP_CLICK_SLOP_PX = 6; // a press on the strip that travels further than this along the row before it is let go was a drag, not a click, and opens no photo
  const EXPAND_S = 0.9; // time for a clicked photo to grow from its place in the strip to fill the screen, and to shrink back to it when it is closed
  const EXPAND_FADE_S = 0.15; // time for the copy to fade in over its photo as it sets off, and out again as it arrives back: it hides the swap of the photo's hover caption for the plain copy
  const INFO_OUT_S = 0.3; // time for the project info's name and category to slide up out of sight when another project becomes active
  const INFO_IN_S = 0.6; // time for each letter of the new name, and for the new category, to rise into view; the photos' captions take the same
  const INFO_STAGGER_S = 0.03; // delay between neighbouring letters of the name as they rise, left to right
  const INFO_CATEGORY_S = 0.2; // the category starts rising this long after the name's first letter
  const CURSOR_FOLLOW_S = 0.3; // time for the button that stands in for the pointer over a photo to catch up with the pointer; smaller is snappier
  const CURSOR_S = 0.4; // time for that button to scale and fade in as a photo comes under the pointer, and out as it leaves
  const REDUCED_FADE_S = 0.2; // with reduced motion the overlay just fades
  const FONT_TIMEOUT_MS = 2000; // don't wait for ever on the wordmark's own font
  const GIVE_UP_MS = 10000; // safety net: dismiss the loader even if something never finishes

  const loader = document.getElementById('loader');
  if (!loader) return;

  // Without GSAP nothing can dismiss the loader, so don't leave it covering the page.
  if (typeof gsap === 'undefined') {
    loader.remove();
    return;
  }

  const word = document.getElementById('loader-word');
  const fill = document.getElementById('loader-fill');
  const navMark = document.getElementById('nav-mark');
  const leftLinks = [...document.querySelectorAll('[data-nav-links="left"] a')];
  const rightLinks = [...document.querySelectorAll('[data-nav-links="right"] a')];
  const links = [...leftLinks, ...rightLinks];
  const navLine = document.getElementById('nav-line');
  const footerLine = document.getElementById('footer-line');
  const footerText = document.querySelector('[data-footer-text]');
  const footerItems = [...document.querySelectorAll('[data-footer-item]')];
  let footerSplit = null;
  const headlineLines = [...document.querySelectorAll('[data-headline-line]')];
  const headlineButtons = [...document.querySelectorAll('[data-headline-button]')];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fineHover = matchMedia('(hover: hover) and (pointer: fine)').matches; // a mouse or the like; a touch screen has no pointer for the photos' cursor to stand in for
  const stripRow = document.querySelector('[data-strip]');
  const stripTrack = document.querySelector('[data-strip-track]');
  // The strip scrolls on two tracks, the photos' own and a twin laid beside it (see scrollStrip). The twin is made
  // here, before anything is held back, so it is a copy of the strip at rest, and its photos are then held,
  // revealed and released along with the original's, which keeps the row's height in step. Reduced motion never
  // scrolls, so it gets no twin.
  const stripTwin = stripRow && stripTrack && navMark && !reduceMotion ? stripTrack.cloneNode(true) : null;
  if (stripTwin) {
    stripTwin.setAttribute('aria-hidden', 'true');
    stripTrack.after(stripTwin);
  }
  const stripPhotos = [...document.querySelectorAll('[data-strip-photo]')];
  const stripImages = stripPhotos.map((photo) => photo.querySelector('img'));
  const stripCursor = document.querySelector('[data-strip-cursor]');
  const stripExpander = document.querySelector('[data-strip-expander]'); // what a clicked photo grows into (see index.ejs)
  const stripToggle = document.querySelector('[data-strip-toggle]'); // the pause / play button under the strip (see index.ejs)
  const info = document.querySelector('[data-strip-info]'); // the active project's name and category under the strip (see stripInfo)
  const infoName = info && info.querySelector('[data-strip-info-name]');
  const infoLabel = info && info.querySelector('[data-strip-info-label]');
  const infoCategory = info && info.querySelector('[data-strip-info-category]');
  const infoReady = !!(infoName && infoCategory);
  let stripReady = false; // true once the strip is fully open and nothing is being held on it any more; it can only be scrolled by hand from then (see stripGlider)
  let headlineSplits = [];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const once = (target, ...events) =>
    new Promise((resolve) => events.forEach((name) => target.addEventListener(name, resolve, { once: true })));

  // The word stays hidden until the fonts are in, so the loader never flashes a fallback typeface. That is
  // Bevellier for the wordmark, plus Supreme, which the headline is measured and split in.
  const fontReady = Promise.race([
    Promise.all([document.fonts.load('600 1em Bevellier'), document.fonts.load('800 1em Supreme')]),
    wait(FONT_TIMEOUT_MS),
  ]).catch(() => {});

  // Vertical extent of the letters' ink, as a percentage of the fill layer's height measured from its
  // top. The line box is taller than the glyphs, so running the fill over the whole box would leave it
  // idle at the start and at the end.
  const measureInk = () => {
    const style = getComputedStyle(fill);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const m = ctx.measureText(fill.textContent);
    if (m.fontBoundingBoxAscent === undefined) return { top: 0, bottom: 100 };

    const box = parseFloat(style.lineHeight) || parseFloat(style.fontSize);
    const baseline = (box - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
    return {
      top: ((baseline - m.actualBoundingBoxAscent) / box) * 100,
      bottom: ((baseline + m.actualBoundingBoxDescent) / box) * 100,
    };
  };

  // One task per thing still loading right now. Work that finished before the loader could show isn't
  // counted, so the fill reflects what happens while it is on screen. Lazy images are skipped: the
  // browser doesn't fetch them until they scroll into view, so they would never finish.
  const pendingTasks = () => {
    const tasks = [];
    if (document.fonts.status === 'loading') tasks.push(document.fonts.ready);
    for (const img of document.images) {
      if (!img.complete && img.loading !== 'lazy') tasks.push(once(img, 'load', 'error'));
    }
    if (document.readyState !== 'complete') tasks.push(once(window, 'load'));
    return tasks;
  };

  // The rest of the nav is held back until the middle of the page has arrived (see revealHeadline),
  // then comes in together: each link slides up out of its own container (its <li>), moving outward from the
  // wordmark, while the line under the nav grows from the middle out to both sides. The containers only clip
  // while the links are on the move.
  // Afterwards, and whenever there is no animation, nothing is clipped or scaled, so keyboard focus rings
  // aren't cut off and the line is simply there.
  const holdNav = () => {
    if (navLine) gsap.set(navLine, { scaleX: 0 });
    if (!links.length) return;
    links.forEach((link) => link.parentElement.classList.add('overflow-hidden'));
    gsap.set(links, { yPercent: 100 });
  };
  const showNav = () => {
    if (navLine) gsap.set(navLine, { clearProps: 'all' });
    if (!links.length) return;
    links.forEach((link) => link.parentElement.classList.remove('overflow-hidden'));
    gsap.set(links, { clearProps: 'all' });
  };
  // The nav's line and the footer's grow the same way: one definition, so they can't drift apart. The ease is an
  // out one, like the links' and the footer text's, so the line is at speed from its first frame and visibly
  // starts spreading the moment the rest of the page comes in. An ease-in would keep a line this wide under a
  // pixel for its first tenth of a second or so, which reads as a delay.
  const growLine = () => ({ scaleX: 1, duration: LINE_S, ease: 'power3.out' });
  const revealNav = () => {
    const slide = (from) => ({ yPercent: 0, duration: LINK_S, ease: 'power3.out', stagger: { each: LINK_STAGGER_S, from } });
    const timeline = gsap.timeline({ onComplete: showNav });
    if (links.length) timeline.to(leftLinks, slide('end'), 0).to(rightLinks, slide('start'), 0);
    if (navLine) timeline.to(navLine, growLine(), 0);
  };

  // The footer is held back like the nav and comes in at the same moment, once the middle of the page has
  // arrived (see revealRest): its line grows from the middle out to both sides, and every line of its text slides up
  // out of its own container.
  //
  // The paragraph's lines depend on the width, so they are split at load, each inside its own clipping mask
  // (SplitText). On the right, each label and each value is already a single line, and the <dt> or <dd> around
  // it is the container: it clips only while the line is on the move, as the nav's <li>s do, so afterwards
  // nothing is clipped, scaled or moved and keyboard focus rings aren't cut off. Undoing the split puts the
  // original paragraph back, so it wraps as ordinary text again if the window is resized afterwards.
  //
  // The paragraph and the right side start together. Each moves in its own reading order, one line after
  // another (FOOTER_STAGGER_S): the paragraph top to bottom, the right side column by column, each label just
  // before its value, which is the order they are in the page. Both are finished about as the line is.
  const holdFooter = () => {
    if (footerLine) gsap.set(footerLine, { scaleX: 0 });
    if (footerText && typeof SplitText !== 'undefined') {
      footerSplit = SplitText.create(footerText, { type: 'lines', mask: 'lines' });
      gsap.set(footerSplit.lines, { yPercent: 100 });
    }
    if (!footerItems.length) return;
    footerItems.forEach((item) => item.parentElement.classList.add('overflow-hidden'));
    gsap.set(footerItems, { yPercent: 100 });
  };
  const showFooter = () => {
    if (footerLine) gsap.set(footerLine, { clearProps: 'all' });
    if (footerSplit) footerSplit.revert();
    footerSplit = null;
    if (!footerItems.length) return;
    footerItems.forEach((item) => item.parentElement.classList.remove('overflow-hidden'));
    gsap.set(footerItems, { clearProps: 'all' });
  };
  const revealFooter = () => {
    const slide = () => ({ yPercent: 0, duration: FOOTER_S, ease: 'power3.out', stagger: FOOTER_STAGGER_S });
    const timeline = gsap.timeline({ onComplete: showFooter });
    if (footerSplit) timeline.to(footerSplit.lines, slide(), 0);
    if (footerItems.length) timeline.to(footerItems, slide(), 0);
    if (footerLine) timeline.to(footerLine, growLine(), 0);
  };
  // The nav and the footer come in together, and only after the middle of the page: revealHeadline calls this
  // once the two lines of text have landed and the strip is open.
  const revealRest = () => {
    revealNav();
    revealFooter();
  };

  // The headline is split into letters, each inside its own clipping mask. The top line's letters wait
  // below their masks and rise into view; the bottom line's wait above theirs and drop into view. Once
  // they have arrived, and given their bounce (see bounceLetters), the split is undone, which puts the
  // original text back.
  //
  // Two things about per-letter boxes need putting right so the split text sits exactly where the real
  // text does, and undoing the split shifts nothing:
  //  - Each letter is its own box, which drops the font's kerning between neighbours (22px on the bottom
  //    line). Every letter is given that kerning back as a margin, in em so it follows the fluid font size.
  //  - A letter's box is narrower than the letter when the tracking is negative, so the mask would shave
  //    the letter's edge. The mask's clip area is widened with padding, cancelled by an equal negative
  //    margin so the layout doesn't change.
  const MASK_PAD_EM = 0.12;
  const fitMasks = (split) => {
    const ctx = document.createElement('canvas').getContext('2d');
    const shown = (el) => (getComputedStyle(el).textTransform === 'uppercase' ? el.textContent.toUpperCase() : el.textContent);
    split.masks.forEach((mask, i) => {
      let kernEm = 0;
      const char = split.chars[i];
      const prev = split.chars[i - 1];
      const word = split.words.find((w) => w.contains(char));
      if (prev && word && word.contains(prev)) {
        const style = getComputedStyle(char);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const [a, b] = [shown(prev), shown(char)];
        kernEm = (ctx.measureText(a + b).width - ctx.measureText(a).width - ctx.measureText(b).width) / parseFloat(style.fontSize);
      }
      mask.style.padding = `0 ${MASK_PAD_EM}em`;
      mask.style.margin = `0 -${MASK_PAD_EM}em 0 ${kernEm - MASK_PAD_EM}em`;
    });
  };
  const holdHeadline = () => {
    if (typeof SplitText === 'undefined') return;
    headlineLines.forEach((line, i) => {
      const split = SplitText.create(line, { type: 'words,chars', mask: 'chars' });
      headlineSplits.push(split);
      fitMasks(split);
      gsap.set(split.chars, { yPercent: i === 0 ? 100 : -100 });
    });
  };
  const showHeadline = () => {
    headlineSplits.forEach((split) => split.revert());
    headlineSplits = [];
  };
  // The buttons wait, invisible, until the letters have landed, then fade and scale in one after the other.
  // autoAlpha also hides them from the keyboard and pointer while they wait. As with the nav, nothing is
  // left on them afterwards, so the stylesheet's own hover colours apply.
  const holdButtons = () => {
    if (headlineButtons.length) gsap.set(headlineButtons, { autoAlpha: 0, scale: 0.6 });
  };
  const showButtons = () => {
    if (headlineButtons.length) gsap.set(headlineButtons, { clearProps: 'all' });
  };
  const revealButtons = () => {
    if (!headlineButtons.length) return;
    gsap.to(headlineButtons, {
      autoAlpha: 1,
      scale: 1,
      duration: BUTTON_S,
      ease: 'power3.out',
      stagger: BUTTON_STAGGER_S,
      onComplete: showButtons,
    });
  };

  // The photo strip is held back as a row of 2px lines, with no width yet and no margins, under the two
  // headline lines, so as the text animates it sits on its own. As soon as the top line has landed
  // (STRIP_START_S) all the rectangles open together, growing for exactly as long as it takes the bottom
  // line to land, so the strip is fully revealed at the same moment the headline is (see revealHeadline).
  //
  // Each rectangle does the same three things at once: its line draws out from its middle to the photo's
  // full width, it grows from that line to the photo's full height, and the photo fades in. The line draws
  // faster than the rectangle grows, so it reads as a line thickening into a rectangle. The growth's ease is
  // a gentle one, which is already moving a tenth of a second in; a steeper ease-in would sit still for the
  // first stretch and look like a delay.
  //
  // Every photo's wrapper is its own rectangle with its own height. It clips its photo and keeps it centred
  // (overflow-clip, items-center), so the photo is uncovered from its middle outwards. The row is as tall as
  // the wrappers, all growing together, so it is that growth that takes up room in the flow and, because
  // <main> centres the headline, pushes the two lines up by half the growth. The row's margins follow that
  // same growth. The line is a flat colour (the text colour)
  // instead of a sliver of the photo, so it reads the same whatever the photo shows. As with the buttons,
  // nothing is left on the row or the wrappers afterwards, which hands the sizes back to the stylesheet.
  //
  // The line's draw tweens the clip-path with both ends spelled out (fromTo), always as four values. Read
  // back from the browser, equal insets come out shortened (`inset(0px 50%)`), so a start value taken from
  // there wouldn't line up with the four-value end value.
  const holdStrip = () => {
    if (!stripRow || !stripPhotos.length) return;
    gsap.set(stripRow, { marginTop: 0, marginBottom: 0 });
    gsap.set(stripPhotos, { height: STRIP_LINE_PX, clipPath: 'inset(0px 50% 0px 50%)', backgroundColor: 'currentColor' });
    gsap.set(stripImages, { opacity: 0 });
  };
  const showStrip = () => {
    if (stripRow && stripPhotos.length) {
      gsap.set([stripRow, ...stripPhotos], { clearProps: 'all' });
      gsap.set(stripImages, { clearProps: 'opacity' }); // the rest of what is on the photos is the parallax's (see stripParallax)
    }
    stripReady = true;
  };
  // The pause button starts hidden in the markup and is only unhidden by scrollStrip, when there is a scroll to pause.
  // From then it waits invisible and scaled down (autoAlpha also keeps it from the keyboard and the pointer) until
  // the strip is open, and pops in the way the headline's buttons do. As with those, nothing is left on it afterwards,
  // so the stylesheet's own hover colours apply.
  const popToggle = () => {
    if (!stripToggle || stripToggle.hidden) return;
    gsap.to(stripToggle, {
      autoAlpha: 1,
      scale: 1,
      duration: BUTTON_S,
      ease: 'power3.out',
      onComplete: () => gsap.set(stripToggle, { clearProps: 'all' }),
    });
  };
  const showToggle = () => {
    if (stripToggle && !stripToggle.hidden) gsap.set(stripToggle, { clearProps: 'all' });
  };

  // The project info under the strip (see index.ejs): the name and category of the active project. A photo becomes
  // active when its left edge reaches the line the headline's text starts on, the info's own left edge, and stays so
  // until the next photo's left edge gets there: the active one is the photo with the nearest left edge at or past
  // the line. That photo, and only that one, not its copy in the other track, also gets its colours back
  // (data-active, which the stylesheet reads, see index.ejs). followActive works it out every frame from the photos'
  // real boxes on screen, so the wave, a drag and a scroll back all count, and the twin's photos, which carry the same
  // project data, count as well; which track a photo is in makes no difference. scrollStrip starts it, so it only
  // runs on a strip that scrolls; with reduced motion the info and the coloured photo stay as the server rendered
  // them.
  //
  // The info itself stays put. When the active project changes, the name and category slide up out of their masks
  // together, then the new ones come up from below: the name letter by letter and the category as one line, a moment
  // after, as in the photos' captions. A change that comes while one is under way waits for it to finish and then goes
  // straight to whichever project is active by then, so a flick across several photos ends on the right one without
  // playing every one in between. The letters are inline-block spans made here (a transform needs a box), and the
  // visually hidden copy gets the whole name, so it is announced as one word. At load the info is held below its masks
  // and comes in as the strip finishes opening (revealInfo, from revealStrip), already on whichever project is active
  // by then.
  let infoShown = ''; // the name of the project the info is showing
  let infoActive = null; // the active project as of the last frame, { name, category }
  let infoBusy = false; // a change, or the entrance, is under way
  let infoLive = false; // the info has made its entrance, so changes can play
  const writeInfo = ({ name, category }) => {
    infoShown = name;
    if (infoLabel) infoLabel.textContent = name;
    infoName.replaceChildren(
      ...[...name].map((letter) => {
        const span = document.createElement('span');
        span.className = 'inline-block';
        span.textContent = letter === ' ' ? ' ' : letter; // a plain space would collapse to nothing in its own box
        return span;
      })
    );
    infoCategory.textContent = category;
  };
  // Puts the new letters and the category below their masks and brings them up.
  const riseInfo = (onComplete) => {
    gsap.set(infoName, { yPercent: 0 });
    gsap.set([...infoName.children, infoCategory], { yPercent: 100 });
    gsap
      .timeline({ onComplete })
      .to(infoName.children, { yPercent: 0, duration: INFO_IN_S, ease: 'power3.out', stagger: INFO_STAGGER_S }, 0)
      .to(infoCategory, { yPercent: 0, duration: INFO_IN_S, ease: 'power3.out' }, INFO_CATEGORY_S);
  };
  const swapInfo = () => {
    if (!infoLive || infoBusy || !infoActive || infoActive.name === infoShown) return;
    infoBusy = true;
    gsap.to([infoName, infoCategory], {
      yPercent: -100,
      duration: INFO_OUT_S,
      ease: 'power2.in',
      onComplete: () => {
        writeInfo(infoActive);
        riseInfo(() => {
          infoBusy = false;
          swapInfo();
        });
      },
    });
  };
  const holdInfo = () => {
    if (!infoReady) return;
    writeInfo({ name: infoName.textContent.trim(), category: infoCategory.textContent.trim() });
    gsap.set([...infoName.children, infoCategory], { yPercent: 100 });
  };
  const revealInfo = () => {
    if (!infoReady || infoLive) return;
    infoLive = true;
    infoBusy = true;
    if (infoActive && infoActive.name !== infoShown) writeInfo(infoActive);
    riseInfo(() => {
      infoBusy = false;
      swapInfo();
    });
  };
  const showInfo = () => {
    if (!infoReady) return;
    gsap.set([infoName, ...infoName.children, infoCategory], { clearProps: 'transform' });
    infoLive = true;
  };
  let activePhoto = null; // the photo that has most recently reached the line, the one in colour
  const followActive = () => {
    const lineOf = info || stripRow.closest('main'); // the info's left edge is the text's; without the info, <main>'s content edge is the same line
    gsap.ticker.add(() => {
      const line = lineOf.getBoundingClientRect().left + (info ? 0 : parseFloat(getComputedStyle(lineOf).paddingLeft));
      let reached = null;
      let nearest = -Infinity;
      stripPhotos.forEach((photo) => {
        const left = photo.getBoundingClientRect().left;
        if (left <= line && left > nearest) {
          nearest = left;
          reached = photo;
        }
      });
      // Nothing has reached the line only for a moment, while the wave holds the first photo back across it; the
      // photo that was active stays so until one does.
      if (!reached || reached === activePhoto) return;
      activePhoto = reached;
      // Every photo, so the twin's copy of the server's first-photo marking (see index.ejs) is cleared as well.
      stripPhotos.forEach((photo) => photo.toggleAttribute('data-active', photo === reached));
      if (!infoReady) return;
      infoActive = { name: reached.dataset.projectName, category: reached.dataset.projectCategory };
      swapInfo();
    });
  };
  // The rectangles' resting height and the row's margins come from the stylesheet. They are read at reveal
  // time, so a resize while the loader was up is accounted for, by clearing what is held and putting it back
  // straight away, before anything is painted.
  const stripRestingSize = () => {
    gsap.set(stripRow, { clearProps: 'marginTop,marginBottom' });
    gsap.set(stripPhotos, { clearProps: 'height' });
    const style = getComputedStyle(stripRow);
    const size = {
      height: stripPhotos[0].getBoundingClientRect().height,
      marginTop: style.marginTop,
      marginBottom: style.marginBottom,
    };
    gsap.set(stripRow, { marginTop: 0, marginBottom: 0 });
    gsap.set(stripPhotos, { height: STRIP_LINE_PX });
    return size;
  };
  // The photos' cursor (the button is in index.ejs): a round button with an arrow that stands in for the pointer
  // while it is over a photo. It rests scaled down to nothing and invisible, and is centred on its own position
  // (xPercent, yPercent), which is then the pointer's, so moving x and y is all it takes to move it. It is carried
  // along by the pointer, eased over CURSOR_FOLLOW_S, not stuck to it; each move re-aims one standing tween per
  // axis (quickTo) instead of starting a new tween for every pointer event. The real cursor is hidden on the
  // photos here and not before, so it is only ever hidden when the button is going to be there: a touch screen,
  // reduced motion (which never scrolls the strip, so never gets here) and a page without the button keep theirs.
  // That is a class and not an inline style because showStrip's clearProps wipes the photos' inline styles.
  // Showing and hiding tween only the button's scale and opacity, with overwrite 'auto' so each replaces just the
  // one before it; overwrite true would kill the follow tweens too, as they are on the same element.
  // Returns null when there is nothing to show.
  const photoCursor = () => {
    if (!stripCursor || !fineHover) return null;
    gsap.set(stripCursor, { xPercent: -50, yPercent: -50, scale: 0, autoAlpha: 0 });
    stripPhotos.forEach((photo) => photo.classList.add('cursor-none'));
    const glide = { duration: CURSOR_FOLLOW_S, ease: 'power3.out' };
    const followX = gsap.quickTo(stripCursor, 'x', glide);
    const followY = gsap.quickTo(stripCursor, 'y', glide);
    return {
      // Puts the button on the pointer with no glide, for a pointer that comes onto the strip from elsewhere.
      jumpTo: (x, y) => gsap.set(stripCursor, { x, y }),
      follow: (x, y) => {
        followX(x);
        followY(y);
      },
      show: (visible) =>
        gsap.to(stripCursor, {
          scale: visible ? 1 : 0,
          autoAlpha: visible ? 1 : 0,
          duration: CURSOR_S,
          ease: 'power3.out',
          overwrite: 'auto',
        }),
    };
  };

  // Scrolling the strip by hand: it follows the input and, when the input stops, carries on and slows down
  // gradually, as if it had weight. Whatever the input asks for is added to a distance still to go (remaining), and
  // every frame the strip covers a fixed share of that distance, the share STRIP_GLIDE_S works out to for the length
  // of the frame. So it is fast at first, while there is a lot to go, and eases out as there is less, with a long
  // tail (the distance shrinks by the same fraction every moment, an exponential decay) instead of stopping at a
  // set time. Input only ever adds to the distance, so one notch of a wheel, a continuous trackpad swipe and the
  // trackpad's own momentum after the fingers have left all work the same way, and there is no step to wait for:
  // scrolling on while it is still gliding carries it further, and scrolling back brakes it. Dragging is the
  // exception: the strip goes with the pointer, one to one, and is let go at the pointer's speed.
  //
  // The strip is moved through the scroll's own progress, which wraps round, so any distance is fine on the two
  // tracks, and it adds to whatever the scroll is doing by itself: the two just sum, and the hover standstill,
  // which acts on the scroll's speed, doesn't stop it. Forward is the way the strip scrolls by itself (photos
  // going left), so a positive distance is forward.
  //
  // On top of that the photos trail the pointer like water dragged along by a hand. At the pointer, and ahead of
  // it in the way the strip is going, the photos move with the input. The ones behind it are late, the more so
  // the further behind they are: a photo a whole row's width behind the pointer is held back by the strip's speed
  // times STRIP_WAVE_S, nearer ones by proportionally less. So the gaps between photos open up as the strip picks
  // up speed and close again as it slows down, and a hard flick makes a bigger wave than a nudge. The speed used is
  // the strip's speed smoothed over STRIP_WAVE_SETTLE_S, so the wave takes a moment to build after the pointer
  // sets off and a moment to die away after it stops: the far photos keep following slowly until they have
  // caught up, and then nothing is left on them. However hard the flick, no photo is held back by more than
  // STRIP_WAVE_MAX of the row's width: the hold is squeezed under that with a tanh, which is smooth, keeps the
  // order (further behind is still held back more) and leaves small waves as they were.
  //
  // Which side is behind the pointer depends on the way the strip is going, and photos are only ever held back
  // the way that opens the gap to the one nearer the pointer, so they never overlap, even when the direction is
  // reversed halfway. The hold is a transform on each photo, worked out from where the photo would be without it
  // and from nothing else, so it makes no difference which of the two tracks a photo is in and the strip's
  // wrapping round can't show. The pointer's position is eased over a tenth of a second, so a pointer that has
  // moved since the last input doesn't make the water jump.
  const stripGlider = (scroll) => {
    let remaining = 0; // distance the strip still has to go, in px
    let held = 0; // distance the pointer has dragged it since the last frame, in px
    let cycle = 0; // one track's width, in px: a full turn of the scroll's progress
    let flow = 0; // how fast the strip is going, in px/s, smoothed over STRIP_WAVE_SETTLE_S; positive is forward. The wave and the photos' parallax (see stripParallax) both use it
    let hand = null; // the pointer's x on screen, in px: where it is drawn to (target) and where the water takes it to be (x)
    let trailing = false; // whether any photo is being held back at the moment
    const late = stripPhotos.map(() => 0); // how far each photo is being held back, in px; positive is to the right
    const setX = stripPhotos.map((photo) => gsap.quickSetter(photo, 'x', 'px'));

    const wake = () => {
      const row = stripRow.getBoundingClientRect();
      const boxes = stripPhotos.map((photo) => photo.getBoundingClientRect()); // all read before any is written
      boxes.forEach((box, i) => {
        const centre = box.left + box.width / 2 - late[i]; // where the photo would be with nothing holding it back
        const behind = flow > 0 ? centre - hand.x : hand.x - centre; // how far behind the pointer it is, going the way the strip goes
        const cap = STRIP_WAVE_MAX * row.width;
        late[i] = cap * Math.tanh((flow * STRIP_WAVE_S * gsap.utils.clamp(0, 1, behind / row.width)) / cap);
        setX[i](late[i]);
      });
      const some = late.some((px) => Math.abs(px) > 0.3); // under a third of a pixel is out of sight, so the photos are let go
      if (!some && trailing) {
        gsap.set(stripPhotos, { clearProps: 'x' });
        late.fill(0);
      }
      trailing = some;
    };

    gsap.ticker.add((time, deltaTime) => {
      const dt = Math.min(deltaTime, 50) / 1000; // a frame that took very long (a background tab, say) counts as a short one
      let move = remaining * (1 - Math.exp(-dt / STRIP_GLIDE_S));
      if (Math.abs(remaining - move) < 0.1) move = remaining; // the last fraction of a pixel isn't worth a tail
      remaining -= move;
      const distance = move + held;
      held = 0;
      if (cycle && distance) scroll.progress((((scroll.progress() + distance / cycle) % 1) + 1) % 1);
      if (!dt) return;
      flow += (distance / dt - flow) * (1 - Math.exp(-dt / STRIP_WAVE_SETTLE_S));
      if (!STRIP_WAVE_S || !hand) return;
      hand.x += (hand.target - hand.x) * (1 - Math.exp(-dt / 0.1));
      if (trailing || Math.abs(flow) > 1) wake();
    });
    const measure = () => {
      cycle = stripTrack.getBoundingClientRect().width;
    };
    const aim = (x) => {
      if (hand) hand.target = x;
      else hand = { x, target: x };
    };
    return {
      push: (distance, x) => {
        if (!stripReady) return;
        measure();
        aim(x);
        remaining += distance;
      },
      // A finger or the mouse goes down on the strip: whatever it was still gliding through stops. False if the strip can't be scrolled yet.
      hold: (x) => {
        if (!stripReady) return false;
        measure();
        aim(x);
        remaining = 0;
        return true;
      },
      drag: (distance, x) => {
        aim(x);
        held += distance;
      },
      // Let go at a speed in px/s: with this decay the distance left to cover is exactly that speed times the time constant.
      release: (speed) => {
        remaining = speed * STRIP_GLIDE_S;
      },
      // How fast the strip is going now, in px/s, as smoothed for the wave; positive is forward.
      flow: () => flow,
      // One track's width, in px, as of the last push or hold (see measure). Forward distance this big is a full
      // cycle: everything has gone by once, the last photo included.
      cycle: () => cycle,
    };
  };

  // The inputs that scroll the strip by hand, all feeding the glider (see stripGlider).
  //  - The wheel, or two fingers on a trackpad, over the strip: every bit of movement counts, STRIP_WHEEL_GAIN
  //    times over, sideways or up and down alike, so the page never scrolls vertically while the pointer is over
  //    the strip; it is always the strip that moves. Down or to the right moves the photos left, as it does
  //    anywhere else. The strip loops for ever, but there is still a last photo in it, and once the wheel has
  //    carried the user STRIP_WHEEL_PASSES full cycles forward (wheelPast, below) they have gone by it that many
  //    times; from that moment the wheel is the page's again, even while it is still over the strip, and this
  //    doesn't reverse, so scrolling back over the strip later doesn't re-trap it. Only the wheel counts towards
  //    this, not the strip's own endless scroll or a drag, since those aren't the user asking to move past
  //    something.
  //  - A finger or the mouse pressed on the strip and dragged: the strip goes with the pointer, and a glide in
  //    progress stops dead at the touch, as it does under a finger on a scrolling list. When the pointer is let go
  //    the strip carries on at the speed it had over the last STRIP_FLING_MS, or stays put if it had stopped, and
  //    slows down like everything else. The row is touch-pan-y (index.ejs), so a finger moving along it is ours
  //    and one moving up and down is still the page's (the browser then cancels the pointer and the drag ends where
  //    it is). The pointer is followed on the window, so a drag that leaves the strip carries on.
  // A drag that ends on the photo it started on still raises a click there, so this also keeps how far the last press
  // travelled along the row and hands back a test for it (dragged), for whatever opens a photo on a click.
  const stripGestures = (glider) => {
    let wheelPast = 0; // net forward px the wheel has pushed the strip since the page opened, floored at 0 so scrolling back doesn't count against it
    let wheelDone = false; // true once wheelPast has reached STRIP_WHEEL_PASSES full cycles and the wheel has been handed back to the page; sticky, never re-trapped
    stripRow.addEventListener(
      'wheel',
      (event) => {
        if (event.ctrlKey) return; // a pinch to zoom the page, not a scroll
        if (wheelDone) return; // the wheel has already carried the user past the last photo the required number of times; it scrolls the page from here on
        event.preventDefault();
        const sideways = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        const movement = (sideways ? event.deltaX : event.deltaY) * [1, 16, 400][event.deltaMode]; // pixels, lines or pages
        glider.push(movement * STRIP_WHEEL_GAIN, event.clientX);
        wheelPast = Math.max(0, wheelPast + movement * STRIP_WHEEL_GAIN);
        if (wheelPast >= glider.cycle() * STRIP_WHEEL_PASSES) wheelDone = true;
      },
      { passive: false }
    );

    let grab = null; // the pointer that is down on the strip: its id, where it last was, and where it has been lately
    let travelled = 0; // how far the last press moved along the row, in px, whichever way; reset at every press, even one that can't grab the strip yet
    stripRow.addEventListener('pointerdown', (event) => {
      travelled = 0;
      if (event.button !== 0 || !glider.hold(event.clientX)) return;
      grab = { id: event.pointerId, x: event.clientX, trail: [[event.timeStamp, event.clientX]] };
    });
    addEventListener('pointermove', (event) => {
      if (!grab || event.pointerId !== grab.id) return;
      glider.drag(grab.x - event.clientX, event.clientX);
      travelled += Math.abs(grab.x - event.clientX);
      grab.x = event.clientX;
      grab.trail.push([event.timeStamp, event.clientX]);
      grab.trail = grab.trail.filter(([time]) => event.timeStamp - time <= STRIP_FLING_MS);
    });
    addEventListener('pointerup', (event) => {
      if (!grab || event.pointerId !== grab.id) return;
      const [firstTime, firstX] = grab.trail[0];
      const [lastTime, lastX] = grab.trail[grab.trail.length - 1];
      grab = null;
      if (event.timeStamp - lastTime > STRIP_FLING_MS || lastTime === firstTime) return;
      glider.release(((firstX - lastX) / (lastTime - firstTime)) * 1000);
    });
    addEventListener('pointercancel', () => {
      grab = null;
    });
    stripRow.addEventListener('dragstart', (event) => event.preventDefault()); // a drag along the strip scrolls it, it does not pick the photo up
    return { dragged: () => travelled > STRIP_CLICK_SLOP_PX };
  };

  // Parallax: the photo inside each box slides against the way the box travels, so it moves a little slower than its
  // frame, which reads as depth, and it trails the frame a little while the strip is on the move. Each photo is drawn
  // STRIP_PARALLAX_SCALE times bigger than its box, about its middle, and the box's own clip (overflow-clip) hides
  // what sticks out. The spare room on each side, (scale - 1) / 2 of the box's width, is all the sliding the photo
  // has, and it never slides further: a tanh squeezes the sum under that room, so an edge of the photo is never let
  // into the box.
  //
  // Two things add up to the slide, both in the direction that makes the photo late:
  //  - Depth, from where the box is on screen. The photo is shifted to one side by STRIP_PARALLAX of the spare room
  //    when the box is about to come in at the right edge, not at all when it is in the middle, and to the other
  //    side when it is about to leave at the left, so it drifts across its frame as the box crosses the screen.
  //  - Lag, from the strip's speed (the glider's, smoothed): the photo trails its box by that speed times
  //    STRIP_PARALLAX_LAG_S, like the water trailing the hand, and slides back as the strip slows to a stop. Depth
  //    alone moves the photo by only a few percent of the box's own speed, which at the strip's slow scroll of its
  //    own is out of sight, as it should be; the lag is what shows when the strip is flicked.
  // Both come from the box's position on screen and the strip's speed, and from nothing else, so it makes no
  // difference which of the two tracks a box is in and the wrap-around can't show. It also composes with the wave,
  // which moves the boxes and not the photos, since the position read is the box's real one. It is set going as the
  // scroll starts, while the loader is still up and the photos are invisible, so nothing jumps when the strip opens
  // (and showStrip leaves what this puts on the photos alone). Reduced motion never scrolls the strip, never gets
  // here, and keeps its photos at their own size.
  const stripParallax = (flowOf) => {
    if (STRIP_PARALLAX_SCALE <= 1) return;
    gsap.set(stripImages, { scale: STRIP_PARALLAX_SCALE });
    const setX = stripImages.map((image) => gsap.quickSetter(image, 'x', 'px'));
    gsap.ticker.add(() => {
      const row = stripRow.getBoundingClientRect();
      const boxes = stripPhotos.map((photo) => photo.getBoundingClientRect()); // all read before any is written
      const lag = flowOf() * STRIP_PARALLAX_LAG_S;
      boxes.forEach((box, i) => {
        const room = (box.width * (STRIP_PARALLAX_SCALE - 1)) / 2;
        const across = (box.left + box.width / 2 - (row.left + row.width / 2)) / ((row.width + box.width) / 2); // -1 to 1 as the box crosses the screen
        setX[i](room * Math.tanh(lag / room - gsap.utils.clamp(-1, 1, across) * STRIP_PARALLAX));
      });
    });
  };

  // Opening a photo: a click on one grows it from its place in the strip to the whole screen, and it stays there until
  // it is clicked or Escape is pressed, when it shrinks back into its place. The click is listened for on the row as a
  // whole, so the twin's photos count. What grows is not the photo but a copy of it (the expander, see index.ejs): the
  // photo sits in a track that moves under a transform and in a row that clips, so it can't cover the screen from
  // where it is. The copy is laid exactly over the photo, with the photo's picture, box and parallax (drawn bigger and
  // slid aside, so both show the same part of it), and then the box grows to the screen while the picture settles to
  // its plain, centred self. Both share one ease, which keeps the picture's edges outside the box all the way: the
  // slide is never more than the room the scale leaves.
  // The copy has no caption or gradient, so it fades in quickly as it sets off, and the photo's own (which are showing,
  // as the pointer is over it) dissolve under it instead of being cut. Going back is the same trip in reverse, to the
  // box the photo has at that moment, with the fade at the end: it hides the copy's colour being swapped for the
  // photo's grayscale, which it has gone back to now that the pointer has left it.
  //
  // A click opens a photo only once the strip is fully open (stripReady), only if it isn't the end of a drag (dragged),
  // and only when none is open. It only closes once it has finished opening, so a double click doesn't shut it again
  // at once. While it is open the strip stands still (onChange, see scrollStrip). Once open, its size is the
  // stylesheet's (inset-0) and not a size in px, so a resize keeps it covering the screen. When the photos link to
  // pages, arriving at the full screen is where the navigation goes, and the closing goes with it.
  const stripExpand = ({ dragged, onChange }) => {
    const copy = stripExpander;
    const picture = copy && copy.querySelector('img');
    if (!picture) return;
    let card = null; // the photo that is open, opening or closing
    let phase = null; // null while no photo is open, then 'opening', 'open' or 'closing'
    const plain = { scale: 1, x: 0 }; // the picture's own place in a box, with no parallax

    const screen = () => ({ left: 0, top: 0, width: document.documentElement.clientWidth, height: document.documentElement.clientHeight });
    const boxOf = (element) => {
      const { left, top, width, height } = element.getBoundingClientRect();
      return { left, top, width, height };
    };
    const lookOf = (image) => ({ scale: gsap.getProperty(image, 'scale'), x: gsap.getProperty(image, 'x') });

    // Takes the copy from one box and picture to another. The starting state is set at once, before anything is
    // painted, so the copy is exactly where the trip starts. Its fade is at the start when opening and at the end when closing.
    const travel = (from, to, opening, onComplete) => {
      const trip = { duration: EXPAND_S, ease: 'power3.inOut' };
      gsap
        .timeline({ onComplete })
        .fromTo(copy, from.box, { ...to.box, ...trip }, 0)
        .fromTo(picture, from.look, { ...to.look, ...trip }, 0)
        .fromTo(
          copy,
          { autoAlpha: opening ? 0 : 1 },
          { autoAlpha: opening ? 1 : 0, duration: EXPAND_FADE_S, ease: 'none' },
          opening ? 0 : EXPAND_S - EXPAND_FADE_S
        );
    };

    const open = (photo) => {
      const image = photo.querySelector('img');
      card = photo;
      phase = 'opening';
      picture.src = image.currentSrc || image.src;
      onChange(true);
      travel({ box: boxOf(photo), look: lookOf(image) }, { box: screen(), look: plain }, true, () => {
        gsap.set(copy, { clearProps: 'left,top,width,height' }); // the stylesheet's inset-0 has it from here
        phase = 'open';
      });
    };
    const close = () => {
      if (phase !== 'open') return;
      phase = 'closing';
      travel({ box: screen(), look: plain }, { box: boxOf(card), look: lookOf(card.querySelector('img')) }, false, () => {
        gsap.set([copy, picture], { clearProps: 'all' }); // back to the invisible copy the stylesheet describes
        card = null;
        phase = null;
        onChange(false);
      });
    };

    stripRow.addEventListener('click', (event) => {
      const photo = event.target.closest('[data-strip-photo]');
      if (photo && stripReady && !phase && !dragged()) open(photo);
    });
    copy.addEventListener('click', close);
    addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });
  };

  // The strip scrolls for ever, right to left, from the moment the loader starts (see start), so it is already
  // moving while the photos are being uncovered and nothing waits for the reveal. The photos' track is exactly
  // one cycle wide (see index.ejs), so the twin laid beside it carries on where it ends. Both move left by
  // their own width, which brings the twin to where the original started, and the loop starts over from there
  // with no visible change. The distance is a percentage of the track, so a resize needs no measuring, and
  // since the track is sized in vw, the speed follows the screen like everything else in the strip. It is at
  // full speed from the first frame, with no build-up: an ease-in from a standstill leaves the strip looking
  // still for the first half second or so, which reads as a delay. It runs on the tracks' transforms, which
  // showStrip's clearProps doesn't touch. Reduced motion never scrolls: there is no twin then, and start only
  // calls this when the strip is being held back for the animation.
  //
  // While the pointer is over a photo the scroll stands still, and it picks up again once the pointer is on
  // anything else: the gap between photos, the rest of the page, or off the strip. The scroll's timeScale
  // does the stopping and starting, eased over STRIP_HOVER_S so neither is a jolt; that also means a
  // pointer crossing the gap between two photos only lets the scroll stir before it stops again. Each
  // change of speed replaces the one before it. What is under the pointer is checked every frame, from the
  // pointer's last position on the strip, rather than when pointer events arrive: a photo sliding under a
  // pointer that has stopped moving raises no event, and the scroll should stop for it all the same. The
  // listeners are on the row, and the check looks at whatever is at the pointer, so the twin's photos
  // count as well.
  //
  // The same check brings the photos' cursor in and out (see photoCursor), so the button and the standstill
  // always agree on whether a photo is under the pointer. The button itself follows every move of the pointer on
  // the row, hidden or not, so it is already at the pointer when a photo comes under it.
  //
  // The pause button under the strip (see index.ejs) stops the scroll the same way, through the same check: it takes
  // the scroll's speed to zero while a photo is under the pointer or the strip is paused, and back to full speed when
  // neither is, so hovering a photo while paused leaves it paused. An open photo (stripExpand) holds it still the same
  // way, and the pointer's position is dropped while one is open. This is where the button is switched on: it is
  // unhidden and held back for its entrance (popToggle) only here, since only a strip that scrolls has anything to
  // pause. Its click swaps the two icons and the label.
  //
  // The same scroll is what the strip's hand scrolling moves (see stripGlider and stripGestures, hooked up last): it
  // adds to the scroll's progress every frame, on top of the scroll's own movement, so scrolling by hand still works
  // while the strip is paused, which stops only the scroll's own speed.
  const scrollStrip = () => {
    if (!stripRow || !stripTrack || !stripTwin) return;
    const scroll = gsap.to([stripTrack, stripTwin], { xPercent: -100, duration: STRIP_SCROLL_S, ease: 'none', repeat: -1 });
    const speedTo = (speed, duration) => gsap.to(scroll, { timeScale: speed, duration, ease: 'power1.inOut', overwrite: true });
    const cursor = photoCursor();

    let pointer = null; // the pointer's last position while it is on the strip, null while it is off it
    let over = false; // whether a photo is under the pointer
    let paused = false; // whether the button has paused the strip
    let opened = false; // whether a photo is open on the screen (see stripExpand)
    let still = false; // whether the scroll is at a standstill, or slowing to one: a photo is under the pointer, it is paused, or a photo is open
    if (stripToggle) {
      stripToggle.hidden = false;
      gsap.set(stripToggle, { autoAlpha: 0, scale: 0.6 });
      const pauseIcon = stripToggle.querySelector('[data-strip-toggle-pause]');
      const playIcon = stripToggle.querySelector('[data-strip-toggle-play]');
      stripToggle.addEventListener('click', () => {
        paused = !paused;
        stripToggle.setAttribute('aria-label', paused ? 'Play the photo strip' : 'Pause the photo strip');
        // toggleAttribute, not the hidden property: the play icon is an SVG, which has no such property
        pauseIcon?.toggleAttribute('hidden', paused);
        playIcon?.toggleAttribute('hidden', !paused);
      });
    }
    stripRow.addEventListener('pointermove', (event) => {
      if (!pointer) cursor?.jumpTo(event.clientX, event.clientY);
      pointer = { x: event.clientX, y: event.clientY };
      cursor?.follow(event.clientX, event.clientY);
    });
    stripRow.addEventListener('pointerleave', () => {
      pointer = null;
    });
    gsap.ticker.add(() => {
      const under = pointer && document.elementFromPoint(pointer.x, pointer.y);
      const nowOver = !!(under && under.closest('[data-strip-photo]'));
      if (nowOver !== over) {
        over = nowOver;
        cursor?.show(over);
      }
      const stop = over || paused || opened;
      if (stop === still) return;
      still = stop;
      speedTo(stop ? 0 : 1, STRIP_HOVER_S);
    });
    const glider = stripGlider(scroll);
    const gestures = stripGestures(glider);
    stripParallax(glider.flow);
    followActive();
    // The pointer's position is dropped as a photo opens: the row sees nothing of the pointer while the copy covers
    // it, so the last position would be stale by the time the photo closes, and would hold the strip and show the
    // photos' cursor for a photo the pointer has long left.
    stripExpand({
      dragged: gestures.dragged,
      onChange: (isOpen) => {
        opened = isOpen;
        if (isOpen) pointer = null;
      },
    });
  };
  // growDuration is how long the rectangles take to reach full height: normally set by revealHeadline so
  // they land exactly as the bottom line does (see stripGrowS there); STRIP_GROW_S is only a fallback for
  // when there is no headline timing to sync to (no SplitText, see revealHeadline).
  const revealStrip = (growDuration = STRIP_GROW_S) => {
    if (!stripRow || !stripPhotos.length) return;
    const size = stripRestingSize();
    const timeline = gsap.timeline({
      onComplete: () => {
        showStrip();
        popToggle();
        revealInfo();
      },
    });
    stripPhotos.forEach((photo, i) => {
      timeline
        .fromTo(
          photo,
          { clipPath: 'inset(0px 50% 0px 50%)' },
          { clipPath: 'inset(0px 0% 0px 0%)', duration: STRIP_LINE_S, ease: 'power3.out' },
          0
        )
        .to(photo, { height: size.height, duration: growDuration, ease: 'power1.inOut' }, 0)
        .to(stripImages[i], { opacity: 1, duration: STRIP_FADE_S, ease: 'none' }, 0);
    });
    // The row's margins grow along with the rectangle that starts first, which sets the row's height.
    timeline.to(
      stripRow,
      { marginTop: size.marginTop, marginBottom: size.marginBottom, duration: growDuration, ease: 'power1.inOut' },
      0
    );
  };

  // The strip opening under the text hits it, and the hit gives the letters a slight bounce. Each letter, not
  // the line as a whole, goes a touch further the way it is being pushed (up, on both lines, as the strip
  // opens under them) and settles back, one after another from left to right like the letters' own entrance. It
  // starts shortly after the strip starts to open (hitAt, on the timeline's clock, plus HEADLINE_BOUNCE_HIT_S),
  // while the strip is still spreading and the push is under way, so it reads as the strip's borders hitting
  // the text and not as something that happens once the strip is done. It moves the letter by `y`, which is
  // separate from the `yPercent` that slid it in, and the letter's mask has room above and below the glyph, so
  // nothing is clipped. Not before the first letters have landed, in case the strip is set to start early.
  const bounceLetters = (timeline, hitAt) => {
    const bounce = parseFloat(getComputedStyle(headlineLines[0]).fontSize) * HEADLINE_BOUNCE_EM;
    if (!(bounce > 0)) return;
    const from = Math.max(hitAt + HEADLINE_BOUNCE_HIT_S, HEADLINE_S);
    headlineSplits.forEach((split) => {
      const stagger = HEADLINE_BOUNCE_STAGGER_S;
      timeline
        .to(split.chars, { y: -bounce, duration: HEADLINE_BOUNCE_UP_S, ease: 'sine.inOut', stagger }, from)
        .to(split.chars, { y: 0, duration: HEADLINE_BOUNCE_DOWN_S, ease: 'sine.inOut', stagger }, from + HEADLINE_BOUNCE_UP_S);
    });
  };

  // The middle of the page goes first and alone: the nav and the footer (revealRest) come in once the two lines
  // of text have landed and the strip is open (REST_START_S either side of that). The strip is timed to finish
  // just as the bottom line lands, so that is a single moment on this timeline's clock. It is also when the
  // round buttons start to pop in, and the letters' bounce is still settling then, so both carry on underneath
  // the nav's arrival instead of holding it back.
  const revealHeadline = () => {
    // Without SplitText there are no letters to animate or bounce, so the buttons and the strip just come in,
    // and the rest of the page follows once the strip is open.
    if (!headlineSplits.length) {
      revealButtons();
      revealStrip();
      gsap.delayedCall(Math.max(0, STRIP_GROW_S + REST_START_S), revealRest);
      return;
    }
    // The split is undone only when this whole timeline is over, the bounce included, since the bounce needs
    // the letters.
    const timeline = gsap.timeline({ delay: HEADLINE_DELAY_S, onComplete: showHeadline });
    // Every line's letters follow one another at the same gap, so the top line (10 letters) lands before the
    // bottom line (16) does. Each takes the time it takes; nothing waits for the other.
    let topLanded = 0;
    headlineSplits.forEach((split, line) => {
      timeline.to(split.chars, { yPercent: 0, duration: HEADLINE_S, ease: 'power3.out', stagger: HEADLINE_STAGGER_S }, 0);
      // Every line starts at 0, so once the top line's letters are in, the timeline ends where they land.
      if (line === 0) topLanded = timeline.duration();
    });
    // Every line starts at 0 too, so once every line's letters are in, the timeline ends where the last of
    // them (the bottom line, having more letters) lands.
    const bottomLanded = timeline.duration();
    // The strip is timed from the top line having landed, a little before that moment (STRIP_START_S), so it
    // starts as the top line visibly settles, while the bottom line
    // is still coming in. It grows for exactly as long as it takes the bottom line to land after that, so the
    // two finish together instead of the strip's own fixed pace (STRIP_GROW_S) running on regardless. The
    // buttons come in once every line has landed, which is where the timeline ends so far, and so does the
    // rest of the page (revealRest), REST_START_S either side of that. All of these are called from this
    // timeline so they stay in step with the letters.
    const stripAt = Math.max(0, topLanded + STRIP_START_S);
    const stripGrowS = Math.max(0.01, bottomLanded - stripAt);
    timeline.call(revealButtons, null, timeline.duration());
    timeline.call(revealRest, null, Math.max(0, bottomLanded + REST_START_S));
    // The strip's own timeline starts when this call fires, which can be a frame late, so the moment it starts
    // to open is read off this timeline's clock then, instead of being worked out in advance, and the bounce is
    // added from there: it stays locked to the strip whatever the frame rate. Tweens added to a timeline that
    // is playing extend it, so the split is still undone only once the bounce is over.
    timeline.call(
      () => {
        revealStrip(stripGrowS);
        bounceLetters(timeline, timeline.time());
      },
      null,
      stripAt
    );
  };

  const start = () => {
    const ink = measureInk();
    const state = { p: 0 };
    let finished = false;

    // Only hold the nav, footer, headline, its buttons, the photo strip and its project info back when the wordmark is going to
    // fly to the nav; otherwise they just stay put. The strip's scroll starts here too, with the strip still
    // held back: it is on from the start, not something the reveal has to finish before it begins.
    if (!reduceMotion && navMark) {
      holdNav();
      holdFooter();
      holdHeadline();
      holdButtons();
      holdStrip();
      holdInfo();
      scrollStrip();
    }

    // Reveal the solid copy from the bottom of the ink (p = 0) to the top of it (p = 1).
    const paint = () => {
      const edge = ink.bottom + (ink.top - ink.bottom) * state.p;
      fill.style.clipPath = `inset(${edge}% 0 0 0)`;
    };

    const fadeOut = () =>
      gsap.to(loader, { opacity: 0, duration: REDUCED_FADE_S, ease: 'power1.inOut', onComplete: () => loader.remove() });

    // Hand the wordmark over to the nav. The real nav wordmark is placed exactly over the loader's word
    // at the same size and the loader's copy is hidden. It then slides up and shrinks into its own
    // place, so the last frame is the untouched nav and there is no swap to notice at the end.
    const flyToNav = () => {
      try {
        const scale = parseFloat(getComputedStyle(word).fontSize) / parseFloat(getComputedStyle(navMark).fontSize);
        const from = word.getBoundingClientRect();
        const to = navMark.getBoundingClientRect();
        // Aligning the box centres also aligns the baselines, since both scale with the font size.
        gsap.set(navMark, {
          x: from.left + from.width / 2 - (to.left + to.width / 2),
          y: from.top + from.height / 2 - (to.top + to.height / 2),
          scale,
          position: 'relative',
          zIndex: 60, // above the overlay, which is z-50
          force3D: false, // keep the text crisp at every size instead of scaling a bitmap
        });
        word.style.visibility = 'hidden';

        gsap
          .timeline({
            onComplete: () => {
              gsap.set(navMark, { clearProps: 'all' });
              loader.remove();
              revealHeadline();
            },
          })
          .to(navMark, { x: 0, y: 0, scale: 1, duration: FLIGHT_S, ease: 'power3.inOut', force3D: false }, 0)
          .to(loader, { backgroundColor: 'rgba(255,255,255,0)', duration: FLIGHT_S * 0.8, ease: 'power1.inOut' }, 0);
      } catch {
        gsap.set(navMark, { clearProps: 'all' });
        word.style.visibility = '';
        showNav();
        showFooter();
        showHeadline();
        showButtons();
        showStrip();
        showToggle();
        showInfo();
        fadeOut();
      }
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      loader.style.pointerEvents = 'none';
      if (reduceMotion || !navMark) fadeOut();
      else flyToNav();
    };

    // Move the fill to `target`. A bigger jump takes proportionally longer, so it never teleports.
    const sweepTo = (target) => {
      if (finished) return;
      gsap.to(state, {
        p: target,
        duration: reduceMotion ? 0 : SWEEP_S * (target - state.p),
        ease: 'none',
        overwrite: true,
        onUpdate: paint,
        onComplete: () => {
          paint();
          if (target >= 1) finish();
        },
      });
    };

    paint();
    gsap.to(word, { opacity: 1, duration: reduceMotion ? 0 : 0.3 });

    const tasks = pendingTasks();
    let done = 0;
    tasks.forEach((task) =>
      task.then(() => {
        done += 1;
        sweepTo(done / tasks.length);
      })
    );
    if (!tasks.length) sweepTo(1);

    wait(GIVE_UP_MS).then(() => sweepTo(1));
  };

  fontReady.then(start).catch(() => {
    showNav();
    showFooter();
    showHeadline();
    showButtons();
    showStrip();
    showToggle();
    showInfo();
    loader.remove();
  });
})();
