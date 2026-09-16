import fs from 'node:fs';

const current = JSON.parse(fs.readFileSync('portfolio.json', 'utf8'));
const additions = fs.readFileSync('research/additional-repositories.txt', 'utf8')
  .split(/\r?\n/).map(value => value.trim()).filter(Boolean);
const byRepo = new Map(current.map(item => [item.repo, item]));

for (const repo of additions) {
  if (byRepo.has(repo)) continue;
  const slash = repo.indexOf('/');
  if (slash < 1 || slash === repo.length - 1) throw new Error(`Invalid repository: ${repo}`);
  const owner = repo.slice(0, slash);
  const name = repo.slice(slash + 1);
  byRepo.set(repo, {
    repo,
    owner,
    name,
    url: `https://github.com/${repo}`,
    access: 'unverified',
    fork: false
  });
}

const merged = [...byRepo.values()];
fs.writeFileSync('portfolio.json', `${JSON.stringify(merged, null, 2)}\n`);
console.log(JSON.stringify({before: current.length, supplied: additions.length, uniqueSupplied: new Set(additions).size, after: merged.length, added: merged.length - current.length}));
