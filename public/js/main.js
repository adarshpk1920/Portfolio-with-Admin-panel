(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- Theme toggle ---------- */
  $$('[data-theme-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
    })
  );

  /* ---------- Header state + scroll progress ---------- */
  const header = $('[data-header]');
  const progress = $('.scroll-progress');
  const toTop = $('[data-to-top]');
  let scrollTicking = false;
  const onScroll = () => {
    scrollTicking = false;
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 20);
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? Math.min(1, y / max) : 0;
    if (progress) progress.style.transform = `scaleX(${ratio})`;
    if (toTop) {
      toTop.classList.toggle('is-visible', y > 600);
      toTop.style.setProperty('--p', ratio.toFixed(3));
    }
  };
  addEventListener('scroll', () => {
    if (!scrollTicking) { scrollTicking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();
  toTop?.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

  /* ---------- Toast ---------- */
  const toastEl = $('[data-toast]');
  let toastTimer;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  };

  /* ---------- Button ripple ---------- */
  if (!reduceMotion) {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const ink = document.createElement('span');
      ink.className = 'ripple';
      Object.assign(ink.style, { width: `${size}px`, height: `${size}px`, left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px` });
      btn.append(ink);
      ink.addEventListener('animationend', () => ink.remove());
    });
  }

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('[data-menu-toggle]');
  const nav = $('[data-nav]');
  const setMenu = (open) => {
    nav?.classList.toggle('is-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
    menuBtn?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav?.addEventListener('click', (e) => e.target.closest('a') && setMenu(false));
  addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

  /* ---------- Active nav link ---------- */
  const links = $$('.nav-links a[href*="#"]:not(.btn)');
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);
  if (sections.length) {
    const spy = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-active', a.hash === `#${en.target.id}`));
      }),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Split headline into animated words ---------- */
  $$('[data-split]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words
      .map((w, i) => `<span class="word" aria-hidden="true"><span style="--i:${i}">${w.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])}</span></span>`)
      .join(' ');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-split')));
  });

  /* ---------- Reveal on scroll ---------- */
  const revealer = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) {
        const el = en.target;
        el.classList.add('is-visible');
        revealer.unobserve(el);
        // After the entrance animation, drop the stagger delay so hover effects feel instant.
        setTimeout(() => el.classList.add('is-done'), 1000 + (parseFloat(getComputedStyle(el).transitionDelay) || 0) * 1000);
      }
    }),
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  $$('.reveal').forEach((el) => revealer.observe(el));

  /* ---------- Animated counters ---------- */
  const counter = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      counter.unobserve(en.target);
      const el = en.target;
      const target = parseFloat(el.dataset.count) || 0;
      if (reduceMotion) return (el.textContent = target);
      const start = performance.now();
      const dur = 1600;
      const tick = (now) => {
        const t = Math.min(1, (now - start) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }),
    { threshold: 0.6 }
  );
  $$('[data-count]').forEach((el) => counter.observe(el));

  /* ---------- Typing effect ---------- */
  const typed = $('[data-typed]');
  if (typed && !reduceMotion) {
    let words = [];
    try { words = JSON.parse(typed.dataset.typed); } catch (e) { /* ignore */ }
    if (words.length > 1) {
      let w = 0, c = words[0].length, deleting = true;
      const loop = () => {
        const word = words[w];
        c += deleting ? -1 : 1;
        typed.textContent = word.slice(0, c);
        let delay = deleting ? 45 : 85;
        if (!deleting && c === word.length) { deleting = true; delay = 1800; }
        else if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; delay = 300; }
        setTimeout(loop, delay);
      };
      setTimeout(loop, 2200);
    }
  }

  /* ---------- Pointer effects (desktop only) ---------- */
  if (canHover && !reduceMotion) {
    const glow = $('.cursor-glow');
    let gx = 0, gy = 0, tx = 0, ty = 0;
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    const follow = () => {
      gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
      if (glow) glow.style.transform = `translate(${gx - 210}px, ${gy - 210}px)`;
      requestAnimationFrame(follow);
    };
    if (glow) { glow.style.left = '0'; glow.style.top = '0'; follow(); }

    $$('.magnetic').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        btn.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
      });
      btn.addEventListener('pointerleave', () => (btn.style.transform = ''));
    });

    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(900px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg) translateY(-6px)`;
      });
      card.addEventListener('pointerleave', () => (card.style.transform = ''));
    });

    $$('[data-spotlight]').forEach((card) =>
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      })
    );

    // Hero motion: one requestAnimationFrame loop eases every value toward the pointer target
    // (critically damped), and only writes compositor-friendly transform/translate values.
    // This is what makes the tilt, shine, badges and blobs glide instead of jitter.
    const hero = $('.hero');
    const visual = $('.hero-visual');
    const stage = $('.deck', visual || document);
    const badges = $$('.orbit-badge', visual || document);
    const blobs = $$('.hero .blob');
    const shines = visual ? $$('.card-shine', visual) : [];
    const deckT = { x: 0, y: 0 };
    const deckC = { x: 0, y: 0 };
    const heroT = { x: 0, y: 0 };
    const heroC = { x: 0, y: 0 };
    let motionRaf = 0;
    let last = 0;
    const step = (now) => {
      // Frame-rate independent smoothing: same feel at 60 Hz and 144 Hz.
      const dt = Math.min(64, now - (last || now)) / 16.667;
      last = now;
      const k = 1 - Math.pow(1 - 0.085, dt);
      deckC.x += (deckT.x - deckC.x) * k; deckC.y += (deckT.y - deckC.y) * k;
      heroC.x += (heroT.x - heroC.x) * k; heroC.y += (heroT.y - heroC.y) * k;
      if (stage) stage.style.transform = `rotateX(${(-deckC.y * 10).toFixed(3)}deg) rotateY(${(deckC.x * 14).toFixed(3)}deg)`;
      shines.forEach((sh) => (sh.style.transform = `translate3d(${(deckC.x * 50).toFixed(2)}%, ${(deckC.y * 50).toFixed(2)}%, 0)`));
      badges.forEach((b) => {
        const d = Number(b.dataset.depth) || 20;
        b.style.translate = `${(deckC.x * d).toFixed(2)}px ${(deckC.y * d).toFixed(2)}px`;
      });
      blobs.forEach((b, i) => (b.style.translate = `${(heroC.x * (i + 1) * -36).toFixed(2)}px ${(heroC.y * (i + 1) * -36).toFixed(2)}px`));
      const moving = Math.abs(deckT.x - deckC.x) + Math.abs(deckT.y - deckC.y) + Math.abs(heroT.x - heroC.x) + Math.abs(heroT.y - heroC.y) > 0.0004;
      motionRaf = moving ? requestAnimationFrame(step) : 0;
      if (!moving) last = 0;
    };
    const kick = () => { if (!motionRaf) motionRaf = requestAnimationFrame(step); };

    visual?.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = visual.getBoundingClientRect();
      deckT.x = Math.max(-0.5, Math.min(0.5, (e.clientX - r.left) / r.width - 0.5));
      deckT.y = Math.max(-0.5, Math.min(0.5, (e.clientY - r.top) / r.height - 0.5));
      kick();
    });
    visual?.addEventListener('pointerleave', () => { deckT.x = 0; deckT.y = 0; kick(); });
    hero?.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      heroT.x = e.clientX / innerWidth - 0.5;
      heroT.y = e.clientY / innerHeight - 0.5;
      kick();
    });
    hero?.addEventListener('pointerleave', () => { heroT.x = 0; heroT.y = 0; kick(); });
  }

  /* ---------- Hero deck: auto-shuffling featured projects ---------- */
  const deckRoot = $('[data-deck]');
  const deckCards = deckRoot ? $$('.hero-card', deckRoot) : [];
  if (deckRoot && deckCards.length > 1) {
    const n = deckCards.length;
    const dots = $$('[data-deck-dot]', deckRoot);
    const count = $('[data-deck-count]', deckRoot);
    const pad = (x) => String(x).padStart(2, '0');
    let active = 0;
    const pauses = new Set();
    const setPaused = (reason, on) => {
      pauses[on ? 'add' : 'delete'](reason);
      deckRoot.classList.toggle('is-paused', pauses.size > 0);
    };
    // The active dot's fill is a CSS animation; when it ends we advance. Pausing the
    // animation (hover, off-screen) therefore pauses the timer too.
    const restartTimer = () => {
      dots.forEach((d) => $('.deck-dot-fill', d).classList.remove('is-running'));
      const fill = dots[active] && $('.deck-dot-fill', dots[active]);
      if (!fill || reduceMotion) return;
      void fill.offsetWidth;
      fill.classList.add('is-running');
    };
    const go = (k) => {
      const prevFront = deckCards[active];
      active = ((k % n) + n) % n;
      deckCards.forEach((card, i) => {
        const pos = (i - active + n) % n;
        card.dataset.pos = String(pos);
        if (card === prevFront && pos === n - 1 && !reduceMotion) {
          card.classList.remove('is-leaving');
          void card.offsetWidth;
          card.classList.add('is-leaving');
        }
      });
      dots.forEach((d, i) => {
        d.classList.toggle('is-active', i === active);
        if (i === active) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
      if (count) count.textContent = `${pad(active + 1)} / ${pad(n)}`;
      restartTimer();
    };
    deckCards.forEach((card, i) => {
      card.addEventListener('animationend', (e) => e.animationName === 'deck-out' && card.classList.remove('is-leaving'));
      // Clicking a card behind the front one brings it forward instead of navigating.
      card.addEventListener('click', (e) => {
        if (card.dataset.pos !== '0' || deckRoot.dataset.swiped) { e.preventDefault(); if (card.dataset.pos !== '0') go(i); }
      });
    });
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    deckRoot.addEventListener('animationend', (e) => {
      if (e.animationName === 'deck-progress' && !reduceMotion) go(active + 1);
    });

    // Swipe left/right on touch screens (and drag with a mouse).
    let startX = null;
    deckRoot.addEventListener('pointerdown', (e) => { if (!e.target.closest('.deck-nav')) startX = e.clientX; });
    deckRoot.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 45) {
        deckRoot.dataset.swiped = '1';
        setTimeout(() => delete deckRoot.dataset.swiped, 50);
        go(active + (dx < 0 ? 1 : -1));
      }
    });
    deckRoot.addEventListener('pointercancel', () => (startX = null));

    if (canHover) {
      deckRoot.addEventListener('pointerenter', () => setPaused('hover', true));
      deckRoot.addEventListener('pointerleave', () => setPaused('hover', false));
    }
    deckRoot.addEventListener('focusin', () => setPaused('focus', true));
    deckRoot.addEventListener('focusout', () => setPaused('focus', false));
    new IntersectionObserver((en) => setPaused('offscreen', !en[0].isIntersecting), { threshold: 0.2 }).observe(deckRoot);
    document.addEventListener('visibilitychange', () => setPaused('tab', document.hidden));
    restartTimer();
  }

  /* ---------- Skills tabs (WAI-ARIA tabs pattern) ---------- */
  $$('[data-tabs]').forEach((root) => {
    const tabs = $$('[role="tab"]', root);
    const indicator = $('.tab-indicator', root);
    const moveIndicator = () => {
      const active = tabs.find((t) => t.getAttribute('aria-selected') === 'true');
      if (!indicator || !active) return;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    const select = (tab, focus = false) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      moveIndicator();
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        select(tabs[(map[e.key] + tabs.length) % tabs.length], true);
      });
    });
    moveIndicator();
    document.fonts?.ready.then(moveIndicator);
    if ('ResizeObserver' in window) new ResizeObserver(moveIndicator).observe(root);
    new IntersectionObserver((entries, obs) => {
      if (entries[0].isIntersecting) { root.classList.add('is-inview'); obs.disconnect(); }
    }, { threshold: 0.3 }).observe(root);
  });

  /* ---------- Process steps light up in sequence ---------- */
  const processList = $('[data-process]');
  if (processList) {
    new IntersectionObserver((entries, obs) => {
      if (!entries[0].isIntersecting) return;
      obs.disconnect();
      $$('li', processList).forEach((li, i) => setTimeout(() => li.classList.add('is-lit'), reduceMotion ? 0 : 300 + i * 380));
    }, { threshold: 0.35 }).observe(processList);
  }

  /* ---------- Carousels: native scroll-snap + dots, arrows, keyboard, autoplay ---------- */
  $$('[data-carousel]').forEach((root) => {
    const track = $('[data-carousel-track]', root);
    const dots = $('[data-carousel-dots]', root);
    const prev = $('[data-carousel-prev]', root);
    const next = $('[data-carousel-next]', root);
    if (!track || !track.children.length) return;
    let step = 1;
    let positions = 1;

    const current = () => Math.max(0, Math.min(positions - 1, Math.round(track.scrollLeft / step)));
    const update = () => {
      const c = current();
      $$('button', dots).forEach((d, i) => {
        d.classList.toggle('is-active', i === c);
        d.setAttribute('aria-current', i === c ? 'true' : 'false');
      });
      if (prev) prev.disabled = positions < 2;
      if (next) next.disabled = positions < 2;
    };
    const measure = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      step = track.children[0].getBoundingClientRect().width + gap || 1;
      const overflow = track.scrollWidth - track.clientWidth;
      const count = overflow > 4 ? Math.round(overflow / step) + 1 : 1;
      if (count !== positions || (dots && dots.children.length !== (count > 1 ? count : 0))) {
        positions = count;
        if (dots) dots.innerHTML = positions > 1
          ? Array.from({ length: positions }, (_, i) => `<button type="button" aria-label="Go to slide ${i + 1}"></button>`).join('')
          : '';
      }
      update();
    };
    const go = (i) => {
      const target = ((i % positions) + positions) % positions;
      const max = track.scrollWidth - track.clientWidth;
      track.scrollTo({ left: Math.min(max, target * step), behavior: reduceMotion ? 'auto' : 'smooth' });
    };

    dots?.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) go([...dots.children].indexOf(b));
    });
    prev?.addEventListener('click', () => go(current() - 1));
    next?.addEventListener('click', () => go(current() + 1));
    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current() + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current() - 1); }
    });
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(track);
    addEventListener('load', measure);
    measure();

    // Autoplay only when visible, not hovered/focused/touched, and motion is allowed.
    const delay = Number(root.dataset.autoplay);
    if (delay && !reduceMotion) {
      let paused = false;
      let visible = false;
      let resumeTimer;
      const pause = () => { paused = true; clearTimeout(resumeTimer); };
      const resume = (after = 0) => { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => (paused = false), after); };
      root.addEventListener('pointerenter', pause);
      root.addEventListener('pointerleave', () => resume());
      root.addEventListener('focusin', pause);
      root.addEventListener('focusout', () => resume());
      track.addEventListener('touchstart', pause, { passive: true });
      track.addEventListener('touchend', () => resume(delay), { passive: true });
      new IntersectionObserver((en) => (visible = en[0].isIntersecting), { threshold: 0.4 }).observe(root);
      setInterval(() => {
        if (!paused && visible && !document.hidden && positions > 1) go(current() + 1);
      }, delay);
    }
  });

  /* ---------- Portfolio: category filters + live search + "show more" on phones ---------- */
  const grid = $('[data-projects]');
  if (grid) {
    const cards = $$('.project-card', grid);
    const filterBtns = $$('[data-filter]');
    const search = $('[data-project-search]');
    const empty = $('[data-filter-empty]');
    const more = $('[data-show-more]');
    const phone = matchMedia('(max-width: 640px)');
    const LIMIT = 4;
    let category = 'all';
    let expanded = false;
    const haystack = new Map(cards.map((c) => [c, c.textContent.replace(/\s+/g, ' ').toLowerCase()]));

    const apply = (animateAll = false) => {
      const q = (search?.value || '').trim().toLowerCase();
      let shown = 0;
      let overflow = 0;
      cards.forEach((card) => {
        const match = (category === 'all' || card.dataset.category === category) && (!q || haystack.get(card).includes(q));
        const capped = match && !expanded && phone.matches && shown >= LIMIT;
        const show = match && !capped;
        if (show) shown++;
        if (capped) overflow++;
        const wasHidden = card.classList.contains('is-hidden');
        card.classList.toggle('is-hidden', !show);
        if (show && (animateAll || wasHidden)) {
          card.classList.remove('is-filtering');
          void card.offsetWidth;
          card.classList.add('is-filtering', 'is-visible');
        }
      });
      if (empty) {
        empty.hidden = shown > 0;
        $('p', empty).textContent = q
          ? `No projects match "${search.value.trim()}". Try another word or category.`
          : 'No projects in this category yet. New case studies are on their way!';
      }
      if (more) {
        more.hidden = overflow === 0;
        $('button', more).textContent = `Show ${overflow} more project${overflow === 1 ? '' : 's'}`;
      }
    };

    filterBtns.forEach((btn) =>
      btn.addEventListener('click', () => {
        category = btn.dataset.filter;
        filterBtns.forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-pressed', String(b === btn));
        });
        btn.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
        apply(true);
      })
    );
    search?.addEventListener('input', () => apply());
    search?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { search.value = ''; apply(); search.blur(); }
    });
    // Press "/" anywhere to jump to the project search.
    addEventListener('keydown', (e) => {
      if (e.key !== '/' || !search || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      e.preventDefault();
      search.focus({ preventScroll: true });
      search.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    more?.addEventListener('click', () => { expanded = true; apply(); });
    phone.addEventListener?.('change', () => apply());
    apply();
  }

  /* ---------- FAQ accordion (one open at a time; height animated in CSS) ---------- */
  const setFaq = (item, open) => {
    item.classList.toggle('is-open', open);
    $('.faq-q', item)?.setAttribute('aria-expanded', String(open));
  };
  $$('.faq-q').forEach((btn) =>
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const open = !item.classList.contains('is-open');
      $$('.faq-item.is-open').forEach((other) => other !== item && setFaq(other, false));
      setFaq(item, open);
    })
  );

  /* ---------- Copy to clipboard ---------- */
  $$('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const text = btn.dataset.copy;
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = Object.assign(document.createElement('textarea'), { value: text });
        Object.assign(ta.style, { position: 'fixed', opacity: '0' });
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      btn.textContent = 'Copied!';
      btn.classList.add('is-copied');
      toast('Email address copied to clipboard ✓');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-copied'); }, 2000);
    })
  );

  /* ---------- Contact form (progressive enhancement) ---------- */
  const form = $('[data-contact-form]');
  if (form) {
    const status = $('.form-status', form);
    const btn = $('button[type="submit"]', form);
    const setStatus = (msg, type) => {
      status.textContent = msg;
      status.className = `form-status ${type ? `is-${type}` : ''}`;
    };
    const inputs = $$('input[required], textarea[required], input[type="email"]', form);
    const check = (input) => {
      const field = input.closest('.field');
      const value = input.value.trim();
      const ok = input.checkValidity() && (!input.required || value !== '') && (!input.minLength || input.minLength < 0 || value.length >= input.minLength);
      field?.classList.toggle('has-error', !ok);
      field?.classList.toggle('is-valid', ok && value !== '');
      return ok;
    };
    // Validate on leaving a field, then live while the user fixes it.
    inputs.forEach((input) => {
      input.addEventListener('blur', () => input.value.trim() && check(input));
      input.addEventListener('input', () => {
        const field = input.closest('.field');
        if (field?.classList.contains('has-error') || field?.classList.contains('is-valid')) check(input);
      });
    });
    const message = $('textarea[name="message"]', form);
    const counter = $('[data-char-count]', form);
    const updateCount = () => {
      if (!message || !counter) return;
      const n = message.value.length;
      counter.textContent = `${n} / ${message.maxLength > 0 ? message.maxLength : 5000}`;
      counter.classList.toggle('is-short', n > 0 && message.value.trim().length < 10);
    };
    message?.addEventListener('input', updateCount);
    updateCount();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const invalid = inputs.filter((i) => !check(i));
      if (invalid.length) {
        invalid[0].focus();
        return setStatus('Please check the highlighted fields.', 'error');
      }
      btn.disabled = true;
      btn.classList.add('is-loading');
      setStatus('');
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
        form.reset();
        $$('.field', form).forEach((f) => f.classList.remove('is-valid', 'has-error'));
        updateCount();
        setStatus("Thanks! Your message has been sent. I'll be in touch soon.", 'success');
        toast('Message sent! 🎉');
      } catch (err) {
        setStatus(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.classList.remove('is-loading');
      }
    });
  }

  /* ---------- Lightbox ---------- */
  const lb = $('[data-lightbox-root]');
  if (lb) {
    const img = $('img', lb);
    const close = () => { lb.hidden = true; document.body.style.overflow = ''; };
    $$('[data-lightbox]').forEach((el) =>
      el.addEventListener('click', () => {
        img.src = el.currentSrc || el.src;
        img.alt = el.alt;
        lb.hidden = false;
        document.body.style.overflow = 'hidden';
        $('.lightbox-close', lb).focus();
      })
    );
    lb.addEventListener('click', (e) => e.target !== img && close());
    addEventListener('keydown', (e) => e.key === 'Escape' && !lb.hidden && close());
  }

  /* ---------- Misc ---------- */
  $$('[data-history-back]').forEach((b) => b.addEventListener('click', () => (history.length > 1 ? history.back() : (location.href = '/'))));
})();
