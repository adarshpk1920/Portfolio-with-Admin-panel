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
  const onScroll = () => {
    const y = window.scrollY;
    header?.classList.toggle('is-scrolled', y > 20);
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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

    const visual = $('.hero-visual');
    visual?.addEventListener('pointermove', (e) => {
      const r = visual.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      $$('.hero-card', visual).forEach((c, i) => (c.style.translate = `${px * (i + 1) * 14}px ${py * (i + 1) * 14}px`));
    });
    visual?.addEventListener('pointerleave', () => $$('.hero-card', visual).forEach((c) => (c.style.translate = '')));
  }

  /* ---------- Portfolio filters ---------- */
  const grid = $('[data-projects]');
  $$('[data-filter]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      $$('[data-filter]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      let shown = 0;
      $$('.project-card', grid).forEach((card) => {
        const show = f === 'all' || card.dataset.category === f;
        card.classList.toggle('is-hidden', !show);
        card.classList.remove('is-filtering');
        if (show) { shown++; void card.offsetWidth; card.classList.add('is-filtering', 'is-visible'); }
      });
      const empty = $('[data-filter-empty]');
      if (empty) empty.hidden = shown > 0;
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
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('.field', form).forEach((f) => f.classList.remove('has-error'));
      const invalid = $$('input[required], textarea[required], input[type="email"]', form).filter((i) => !i.checkValidity());
      if (invalid.length) {
        invalid.forEach((i) => i.closest('.field')?.classList.add('has-error'));
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
        setStatus("Thanks! Your message has been sent. I'll be in touch soon.", 'success');
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
