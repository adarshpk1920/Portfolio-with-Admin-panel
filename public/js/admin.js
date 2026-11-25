(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const csrf = $('meta[name="csrf-token"]')?.content || $('input[name="_csrf"]')?.value || '';

  /* Theme */
  $$('[data-theme-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
    })
  );

  /* Mobile sidebar */
  const sidebar = $('[data-sidebar]');
  const backdrop = $('[data-sidebar-close]');
  const toggleSidebar = (open) => {
    sidebar?.classList.toggle('is-open', open);
    backdrop?.classList.toggle('is-open', open);
  };
  $('[data-sidebar-toggle]')?.addEventListener('click', () => toggleSidebar(!sidebar.classList.contains('is-open')));
  backdrop?.addEventListener('click', () => toggleSidebar(false));

  /* Dismissible alerts (success ones fade out automatically) */
  $$('[data-dismissible]').forEach((a) => {
    $('.alert-close', a)?.addEventListener('click', () => a.remove());
    if (a.classList.contains('alert-success')) setTimeout(() => a.remove(), 6000);
  });

  /* Confirm dialog for destructive forms */
  const modal = $('[data-confirm-modal]');
  let pendingForm = null;
  $$('form[data-confirm]').forEach((form) =>
    form.addEventListener('submit', (e) => {
      if (form.dataset.confirmed) return;
      e.preventDefault();
      if (!modal) return confirm(form.dataset.confirm) && form.submit();
      pendingForm = form;
      $('[data-confirm-text]', modal).textContent = form.dataset.confirm;
      modal.hidden = false;
      $('[data-confirm-cancel]', modal).focus();
    })
  );
  const closeModal = () => { if (modal) modal.hidden = true; pendingForm = null; };
  $('[data-confirm-cancel]')?.addEventListener('click', closeModal);
  $('[data-confirm-ok]')?.addEventListener('click', () => {
    if (!pendingForm) return;
    pendingForm.dataset.confirmed = '1';
    pendingForm.submit();
  });
  modal?.addEventListener('click', (e) => e.target === modal && closeModal());
  addEventListener('keydown', (e) => e.key === 'Escape' && closeModal());

  /* Password visibility */
  $$('[data-pw-toggle]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const input = btn.parentElement.querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    })
  );

  /* Loading state on submit */
  $$('form').forEach((f) =>
    f.addEventListener('submit', () => {
      const btn = $('button[type="submit"] .spinner', f)?.closest('button');
      if (btn) setTimeout(() => { btn.classList.add('is-loading'); btn.disabled = true; }, 0);
    })
  );

  /* ---------------- Project editor ---------------- */
  const form = $('[data-project-form]');
  if (form) {
    // Auto-generate slug from title until the user edits the slug themselves.
    const title = $('[data-title-input]', form);
    const slug = $('[data-slug-input]', form);
    const slugify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    title?.addEventListener('input', () => { if (!slug.hasAttribute('data-touched')) slug.value = slugify(title.value); });
    slug?.addEventListener('input', () => slug.setAttribute('data-touched', ''));
    slug?.addEventListener('blur', () => { slug.value = slugify(slug.value); if (!slug.value) slug.removeAttribute('data-touched'); });

    // Character counter
    $$('[data-count-chars]', form).forEach((ta) => {
      const out = ta.parentElement.querySelector('[data-char-count]');
      const upd = () => (out.textContent = ta.value.length);
      ta.addEventListener('input', upd);
      upd();
    });

    // Markdown toolbar
    const md = $('[data-md-input]', form);
    const insert = (before, after = '', placeholder = '') => {
      const { selectionStart: s, selectionEnd: e, value } = md;
      const sel = value.slice(s, e) || placeholder;
      md.setRangeText(before + sel + after, s, e, 'end');
      md.focus();
      md.setSelectionRange(s + before.length, s + before.length + sel.length);
    };
    $$('[data-md-toolbar] button').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.mdWrap) return insert(b.dataset.mdWrap, b.dataset.mdWrap, 'text');
        if (b.hasAttribute('data-md-link')) return insert('[', '](https://)', 'link text');
        const lineStart = md.value.lastIndexOf('\n', md.selectionStart - 1) + 1;
        md.setSelectionRange(lineStart, lineStart);
        insert(b.dataset.md);
      })
    );

    // Write / Preview tabs (server renders with the same sanitiser as the public page)
    const preview = $('[data-md-preview]', form);
    const toolbar = $('[data-md-toolbar]', form);
    $$('[data-tab]', form).forEach((tab) =>
      tab.addEventListener('click', async () => {
        const isPreview = tab.dataset.tab === 'preview';
        $$('[data-tab]', form).forEach((t) => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', String(t === tab)); });
        md.hidden = isPreview;
        toolbar.hidden = isPreview;
        preview.hidden = !isPreview;
        if (!isPreview) return;
        preview.innerHTML = '<p class="muted">Rendering…</p>';
        try {
          const res = await fetch('/admin/preview-markdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-CSRF-Token': csrf },
            body: JSON.stringify({ content: md.value }),
          });
          const data = await res.json();
          preview.innerHTML = data.html || '<p class="muted">Nothing to preview yet.</p>';
        } catch (e) {
          preview.innerHTML = '<p class="muted">Preview unavailable.</p>';
        }
      })
    );

    // Cover image preview
    const coverInput = $('[data-cover-input]', form);
    const coverBox = $('[data-cover-preview]', form);
    coverInput?.addEventListener('change', () => {
      const file = coverInput.files[0];
      if (!file) return;
      coverBox.innerHTML = '';
      const img = new Image();
      img.alt = 'New cover preview';
      img.src = URL.createObjectURL(file);
      coverBox.appendChild(img);
    });

    // Gallery previews + drag & drop highlight
    $$('[data-dropzone]', form).forEach((dz) => {
      const input = $('input[type="file"]', dz);
      const target = document.getElementById(input.dataset.previewTarget);
      ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.add('is-over')));
      ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, () => dz.classList.remove('is-over')));
      input.addEventListener('change', () => {
        target.innerHTML = '';
        [...input.files].forEach((file) => {
          const fig = document.createElement('figure');
          const img = new Image();
          img.src = URL.createObjectURL(file);
          img.alt = '';
          const cap = document.createElement('figcaption');
          cap.textContent = file.name;
          const badge = document.createElement('span');
          badge.className = 'new-badge';
          badge.textContent = 'NEW';
          fig.append(badge, img, cap);
          target.appendChild(fig);
        });
      });
    });

    // Visual feedback when marking gallery images for removal
    $$('.gallery-item input[type="checkbox"]', form).forEach((cb) =>
      cb.addEventListener('change', () => cb.closest('.gallery-item').classList.toggle('is-removing', cb.checked))
    );

    // Basic client-side validation (server validates too)
    form.addEventListener('submit', (e) => {
      const missing = $$('[required]', form).filter((i) => !i.value.trim());
      if (!missing.length) return;
      e.preventDefault();
      missing.forEach((i) => i.closest('.field')?.classList.add('has-error'));
      missing[0].focus();
      setTimeout(() => $$('button[type="submit"]', form).forEach((b) => { b.disabled = false; b.classList.remove('is-loading'); }), 0);
    });
  }

  /* Mark messages read when opened */
  $$('details[data-message-id]').forEach((d) =>
    d.addEventListener('toggle', () => {
      if (!d.open || !d.classList.contains('is-unread')) return;
      d.classList.remove('is-unread');
      d.querySelector('.pill-accent')?.remove();
      fetch(`/admin/messages/${d.dataset.messageId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-CSRF-Token': csrf },
        body: 'read=1',
        redirect: 'manual',
      }).catch(() => {});
    })
  );
})();
