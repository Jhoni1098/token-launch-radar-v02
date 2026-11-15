/* Momentum Radar: the board, its movers strip, filters and detail views. Reads window.RADAR from data.js. */
(function () {
  var D = window.RADAR;
  if (!D) {
    document.getElementById('meta').textContent = 'No data: data.js did not load.';
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var fmtUsd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var fmtTvl = function (n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n / 1e3) + 'K';
  };
  var fmtPct = function (n) {
    if (n === null || n === undefined) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
  };
  var fmtAge = function (d) { return d === null || d === undefined ? '—' : d + 'd'; };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  $('meta').textContent =
    D.board_size + ' pre-token protocols ranked · ' + D.watchlist_size + ' on the watchlist · ' +
    D.early_size + ' found below the floor · snapshot ' + D.as_of + ' · model ' + D.model_version +
    ' · global category ratio ' + D.global_ratio.toFixed(3) + 'x';

  var state = { q: '', cat: '', chain: '', sort: 'rank', watch: false, hot: false, sel: null };

  function fillSelect(el, values) {
    values.slice().sort().forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      el.appendChild(o);
    });
  }
  var cats = Array.from(new Set(D.rows.map(function (r) { return r.category; }).filter(Boolean)));
  var chains = Array.from(new Set(D.rows.flatMap(function (r) { return r.chains; })));
  fillSelect($('cat'), cats);
  fillSelect($('chain'), chains);

  // Movers strip: the fastest growers, clickable into the detail view.
  $('movers').innerHTML = D.movers.map(function (m) {
    return '<div class="mover" data-slug="' + esc(m.slug) + '">' +
      '<div class="m-name">' + esc(m.name) + '</div>' +
      '<div class="m-pct">' + fmtPct(m.change_7d) + '</div>' +
      '<div class="m-meta">TVL ' + fmtTvl(m.tvl_usd) + ' · #' + m.rank + ' · ' + fmtUsd(m.implied_value_usd) + '</div></div>';
  }).join('');
  $('movers').addEventListener('click', function (e) {
    var card = e.target.closest('.mover[data-slug]');
    if (card) showDetail(card.getAttribute('data-slug'));
  });

  // Deep-linkable state: ?q=..&cat=..&chain=..&sort=..&watch=1&hot=1, and #<slug> opens a detail view.
  var SORTS = {
    rank: function (a, b) { return a.rank - b.rank; },
    implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
    growth: function (a, b) { return (b.change_7d || 0) - (a.change_7d || 0); },
    tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
    age: function (a, b) { return (b.age_days || 0) - (a.age_days || 0); },
    name: function (a, b) { return a.name.localeCompare(b.name); },
  };
  (function () {
    var p = new URLSearchParams(window.location.search);
    if (p.get('q')) { state.q = p.get('q'); $('q').value = state.q; }
    if (p.get('cat')) { state.cat = p.get('cat'); $('cat').value = state.cat; }
    if (p.get('chain')) { state.chain = p.get('chain'); $('chain').value = state.chain; }
    if (p.get('sort') && SORTS[p.get('sort')]) { state.sort = p.get('sort'); $('sort').value = state.sort; }
    if (p.get('watch') === '1') { state.watch = true; $('watch').checked = true; }
    if (p.get('hot') === '1') { state.hot = true; $('hot').checked = true; }
  })();

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var rows = D.rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.hot && !(r.change_7d !== null && r.change_7d > 0)) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) === -1) return false;
      if (q && (r.name.toLowerCase().indexOf(q) === -1 && r.slug.indexOf(q) === -1)) return false;
      return true;
    });
    rows.sort(SORTS[state.sort] || SORTS.rank);
    return rows;
  }

  function barHtml(g) {
    if (g === null || g === undefined) return '';
    var w = Math.min(100, Math.abs(g) / 100 * 100);
    if (g < 0) w = Math.min(100, Math.abs(g) / 40 * 100);
    return '<span class="bar' + (g < 0 ? ' neg' : '') + '"><i style="width:' + Math.max(2, w).toFixed(0) + '%"></i></span>';
  }

  function rowHtml(r) {
    var cls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'up' : 'down');
    var tag = r.watchlist ? '<span class="tag">WATCHLIST</span>' : '';
    var hot = r.hot ? '<span class="hottag">HOT</span>' : '';
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.sel === r.slug ? ' class="sel"' : '') + '>' +
      '<td class="num">' + r.rank + '</td>' +
      '<td class="name">' + esc(r.name) + tag + hot + '<small>' + esc(r.slug) + '</small></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td class="num">' + fmtTvl(r.tvl_usd) + '</td>' +
      '<td class="num ' + cls + '">' + fmtPct(r.change_7d) + barHtml(r.change_7d) + '</td>' +
      '<td class="num">×' + r.momentum_multiplier.toFixed(2) + '</td>' +
      '<td class="num"><strong>' + fmtUsd(r.implied_value_usd) + '</strong></td></tr>';
  }

  function render() {
    var rows = filtered();
    $('rows').innerHTML = rows.map(rowHtml).join('') || '<tr><td colspan="7">No protocol matches these filters.</td></tr>';
    $('count').textContent = rows.length + ' of ' + D.rows.length + ' protocols shown';
  }

  function showDetail(slug) {
    var r = D.rows.find(function (x) { return x.slug === slug; });
    if (!r) return;
    state.sel = slug;
    $('detail').hidden = false;
    $('d-rank').textContent = 'RANK ' + r.rank + (r.watchlist ? ' · WATCHLIST' : ' · EARLY FIND') + (r.hot ? ' · HOT' : '');
    $('d-name').textContent = r.name;
    $('d-sub').textContent = (r.category || 'No category') + ' · ' + (r.chains.join(', ') || 'no chain listed') +
      ' · TVL ' + fmtTvl(r.tvl_usd) + ' · listed ' + (r.listed_at || 'unknown') + ' · ' + fmtAge(r.age_days) + ' old';
    $('d-value').textContent = fmtUsd(r.implied_value_usd);
    var base = r.tvl_usd * r.ratio;
    var modelRows = [
      ['TVL × category ratio', fmtTvl(r.tvl_usd) + ' × ' + r.ratio.toFixed(3) + ' = ' + fmtUsd(base)],
      ['Seven-day growth', fmtPct(r.change_7d) + ' → momentum ×' + r.momentum_multiplier.toFixed(2)],
      ['Hot streak (' + fmtPct(r.change_7d) + ' this week)', r.hot ? '×1.15' : '×1.00'],
      ['Fresh (under a year, no token)', r.fresh ? '×1.10' : '×1.00'],
      ['Size adjustment (TVL ' + fmtTvl(r.tvl_usd) + ' vs $100M)', '×' + r.size_multiplier.toFixed(2)],
      ['Chains (' + r.chains.length + ')', '×' + (1 + 0.05 * Math.min(Math.max(r.chains.length - 1, 0), 4)).toFixed(2)],
      ['Implied value', fmtUsd(r.implied_value_usd)],
    ];
    $('d-model').innerHTML = modelRows.map(function (m) {
      return '<tr><td>' + esc(m[0]) + '</td><td>' + esc(m[1]) + '</td></tr>';
    }).join('');
    $('d-steps').innerHTML = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    render();
    $('detail').scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) showDetail(tr.getAttribute('data-slug'));
  });
  document.querySelectorAll('#board thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-k');
      if (k && SORTS[k]) { state.sort = k; $('sort').value = k; render(); }
    });
  });

  $('q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; render(); });
  $('chain').addEventListener('change', function (e) { state.chain = e.target.value; render(); });
  $('sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });
  $('watch').addEventListener('change', function (e) { state.watch = e.target.checked; render(); });
  $('hot').addEventListener('change', function (e) { state.hot = e.target.checked; render(); });

  $('live-rows').innerHTML = D.live.map(function (p) {
    var cls = p.change_7d === null ? '' : (p.change_7d >= 0 ? 'up' : 'down');
    return '<tr><td class="name">' + esc(p.name) + '</td><td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + fmtTvl(p.tvl_usd) + '</td>' +
      '<td class="num">' + (p.mcap_usd ? fmtUsd(p.mcap_usd) : '—') + '</td>' +
      '<td class="num ' + cls + '">' + fmtPct(p.change_7d) + '</td></tr>';
  }).join('');

  var hash = window.location.hash.replace('#', '');
  if (hash) showDetail(hash);
  else render();

  // A #<slug> link opened while already on the page must open the detail too:
  // the hash is read on load only, so listen for later hash changes as well.
  window.addEventListener('hashchange', function () {
    var h = window.location.hash.replace('#', '');
    if (h) showDetail(h);
  });
})();
