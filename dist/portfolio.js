(() => {
  const form = document.getElementById('repo-search-form');
  if (!form || !document.getElementById('repo-search') || !document.getElementById('repo-results')) return;
  const search = document.getElementById('repo-search');
  const owner = document.getElementById('repo-owner');
  const rows = [...document.querySelectorAll('.repo-row')];
  const count = document.getElementById('repo-count');
  const empty = document.getElementById('repo-empty');
  const forkSection = document.querySelector('.fork-section');
  const initialParams = new URLSearchParams(location.search);
  search.value = initialParams.get('q') || '';
  owner.value = initialParams.get('owner') || '';
  const toggle = document.createElement('button');
  toggle.className = 'show-repositories';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'repo-results');
  document.getElementById('repo-results').after(toggle);
  const TAGS = { ai: /\b(ai|gpt|llm|bot|agents?|smart|chat)\b|intelligen|noraio|snora|nestai/, web: /(web|site|next|landing|page|portfolio|vercel|react)/, mobile: /(mobile|app|android|ios|flutter)/, health: /(health|med|clinic|dental|care|hair|beauty)/, education: /(edu|learn|kid|school|tutor|l3)/, commerce: /(shop|store|commerce|market|fresh|retail|sales)/, automation: /(auto|workflow|tracker|crm|erp|staff|recruit)/, release: /(release|installer|build|deploy)/, green: /(green|hydrogen|eco|waste|zero|aqua|solar)/ };
  const tagsOf = name => Object.keys(TAGS).filter(t => TAGS[t].test(name));
  rows.forEach(r => { r.dataset.tags = tagsOf(r.dataset.name.split('/').pop().replace(/[-_/.]/g, ' ')).join(' '); });
  const lev = (a, b) => { if (Math.abs(a.length - b.length) > 3) return 9; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i-1][j] + 1, d[i][j-1] + 1, d[i-1][j-1] + (a[i-1] === b[j-1] ? 0 : 1), i > 1 && j > 1 && a[i-1] === b[j-2] && a[i-2] === b[j-1] ? d[i-2][j-2] + 1 : 9); return d[a.length][b.length]; };
  const tokens = r => r._tok || (r._tok = r.dataset.name.split(/[-_/. ]+/).filter(Boolean));
  const fuzzy = (r, w) => { const n = r.dataset.name; if (n.includes(w) || (r.dataset.owner || '').toLowerCase().includes(w) || r.dataset.tags.includes(w)) return true; if (w.length >= 4 && tokens(r).some(t => lev(t.slice(0, w.length + 1), w) <= 1 || lev(t, w) <= 1)) return true; let i = 0; for (const ch of n) if (ch === w[i]) i++; return w.length >= 3 && i === w.length && n.length < w.length * 4; };
  let activeTag = '';
  const chipBar = document.createElement('div');
  chipBar.className = 'fx-chips'; chipBar.setAttribute('role', 'group'); chipBar.setAttribute('aria-label', 'Filter by inferred topic');
  const tagCounts = Object.keys(TAGS).map(t => [t, rows.filter(r => r.dataset.tags.split(' ').includes(t)).length]).filter(([, n]) => n);
  chipBar.innerHTML = tagCounts.map(([t, n]) => `<button type="button" class="fx-chip" data-tag="${t}" aria-pressed="false">#${t}<span>${n}</span></button>`).join('');
  form.after(chipBar);
  chipBar.addEventListener('click', e => { const b = e.target.closest('[data-tag]'); if (!b) return; activeTag = activeTag === b.dataset.tag ? '' : b.dataset.tag; chipBar.querySelectorAll('[data-tag]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.tag === activeTag))); filter(); });
  const suggest = document.createElement('p'); suggest.className = 'fx-suggest'; empty.append(suggest);
  suggest.addEventListener('click', e => { const b = e.target.closest('[data-sugg]'); if (!b) return; search.value = b.dataset.sugg; owner.value = ''; activeTag = ''; chipBar.querySelectorAll('[data-tag]').forEach(x => x.setAttribute('aria-pressed', 'false')); filter(); });
  let expanded = false;
  function filter() {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    let forks = 0;
    let matched = 0;
    const filtering = words.length > 0 || !!owner.value || !!activeTag;
    for (const row of rows) {
      const matches = (!owner.value || row.dataset.owner === owner.value) && (!activeTag || row.dataset.tags.split(' ').includes(activeTag)) && words.every(word => fuzzy(row, word));
      if (matches) matched++;
      const show = matches && (filtering || expanded || matched <= 18);
      row.hidden = !show;
      if (show) { visible++; if (row.dataset.fork === 'true') forks++; }
    }
    count.textContent = `Showing ${visible} of ${filtering ? matched : rows.length} repositories${filtering ? ' matching your search' : ''}`;
    empty.hidden = visible !== 0;
    if (!visible && words.length) { const q = words.join(' '); const best = rows.map(r => [r.dataset.name.split('/').pop(), Math.min(lev(r.dataset.name.split('/').pop().slice(0, q.length + 2), q), ...tokens(r).map(t => lev(t.slice(0, words[0].length + 2), words[0])))]).sort((a, b) => a[1] - b[1]).filter((x, i, arr) => arr.findIndex(y => y[0] === x[0]) === i).slice(0, 4); suggest.innerHTML = 'Did you mean ' + best.map(([n]) => `<button type="button" data-sugg="${n}">${n}</button>`).join(', ') + '?'; } else suggest.textContent = '';
    forkSection.hidden = forks === 0;
    toggle.hidden = filtering || rows.length <= 18;
    toggle.textContent = expanded ? 'Show fewer repositories ↑' : `Show all ${rows.length} repositories ↓`;
    toggle.setAttribute('aria-expanded', String(expanded));
    const params = new URLSearchParams(location.search);
    search.value.trim() ? params.set('q', search.value.trim()) : params.delete('q');
    owner.value ? params.set('owner', owner.value) : params.delete('owner');
    const query = params.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }
  toggle.addEventListener('click', () => { expanded = !expanded; filter(); if (!expanded) document.getElementById('project-index').scrollIntoView({block:'start'}); });
  search.addEventListener('input', filter);
  owner.addEventListener('change', filter);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => { search.value = ''; owner.value = ''; activeTag = ''; chipBar.querySelectorAll('[data-tag]').forEach(x => x.setAttribute('aria-pressed', 'false')); expanded = false; filter(); });
  filter();
})();
