// Client sites now live inside the combined "Live on the web" section.
// clients.json is merged (deduped by domain) by update-portfolio.mjs; this script just delegates to it.
await import('./update-portfolio.mjs');
console.log('Client sites merged into #live-projects via update-portfolio.mjs.');
