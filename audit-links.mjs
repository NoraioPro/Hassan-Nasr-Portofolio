import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]));
const refs = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map((m) => m[1]);
const unique = [...new Set(refs)];
const findings = [];

for (const ref of unique) {
  if (ref.startsWith('data:') || ref === '#') continue;
  if (ref.startsWith('#')) {
    if (!ids.has(ref.slice(1))) findings.push({ ref, status: 'missing-anchor' });
    continue;
  }
  if (!/^https?:\/\//i.test(ref)) {
    try { await access(resolve(root, ref.split(/[?#]/)[0])); }
    catch { findings.push({ ref, status: 'missing-file' }); }
  }
}

const external = unique.filter((ref) => /^https?:\/\//i.test(ref) && !ref.includes('github.com/'));
async function check(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 link audit' },
    });
    return { ref: url, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { ref: url, status: 'error', error: error.message };
  } finally { clearTimeout(timer); }
}

const checked = [];
for (let i = 0; i < external.length; i += 6) {
  checked.push(...await Promise.all(external.slice(i, i + 6).map(check)));
}

const badExternal = checked.filter((item) => item.status === 'error' || item.status >= 400);
console.log(JSON.stringify({
  totals: { references: refs.length, unique: unique.length, externalChecked: checked.length },
  structuralFindings: findings,
  badExternal,
  checked,
}, null, 2));
process.exitCode = findings.length || badExternal.length ? 1 : 0;
