(() => {
  const form = document.getElementById('repo-search-form');
  const search = document.getElementById('repo-search');
  const owner = document.getElementById('repo-owner');
  const rows = [...document.querySelectorAll('.repo-row')];
  const count = document.getElementById('repo-count');
  const empty = document.getElementById('repo-empty');
  const forkSection = document.querySelector('.fork-section');
  const toggle = document.createElement('button');
  toggle.className = 'show-repositories';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'repo-results');
  document.getElementById('repo-results').after(toggle);
  let expanded = false;
  function filter() {
    const words = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    let forks = 0;
    let matched = 0;
    const filtering = words.length > 0 || !!owner.value;
    for (const row of rows) {
      const matches = (!owner.value || row.dataset.owner === owner.value) && words.every(word => row.dataset.name.includes(word));
      if (matches) matched++;
      const show = matches && (filtering || expanded || matched <= 18);
      row.hidden = !show;
      if (show) { visible++; if (row.dataset.fork === 'true') forks++; }
    }
    count.textContent = `Showing ${visible} of ${filtering ? matched : rows.length} repositories${filtering ? ' matching your search' : ''}`;
    empty.hidden = visible !== 0;
    forkSection.hidden = forks === 0;
    toggle.hidden = filtering || rows.length <= 18;
    toggle.textContent = expanded ? 'Show fewer repositories ↑' : `Show all ${rows.length} repositories ↓`;
    toggle.setAttribute('aria-expanded', String(expanded));
  }
  toggle.addEventListener('click', () => { expanded = !expanded; filter(); if (!expanded) document.getElementById('project-index').scrollIntoView({block:'start'}); });
  search.addEventListener('input', filter);
  owner.addEventListener('change', filter);
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('reset', () => { search.value = ''; owner.value = ''; expanded = false; filter(); });
  filter();
})();
