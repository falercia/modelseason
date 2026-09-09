/**
 * Teste de ponta a ponta do Model Season.
 *
 * Existe porque a página é ferramenta de mercado: número errado publicado em
 * silêncio custa mais caro do que build que falha. O teste não checa aparência,
 * checa invariantes.
 *
 *   node tests/e2e.js [url]      (padrão: http://localhost:8000)
 *
 * Requer playwright: npm i -D playwright
 */
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8000';

const falhas = [];
const ok = [];
function checa(cond, nome, detalhe = '') {
  (cond ? ok : falhas).push(nome + (cond ? '' : ' — ' + detalhe));
}
const perto = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const browser = await chromium.launch();
  const erros = [];

  // ---------- 1. carga limpa, sem erro de JavaScript ----------
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  p.on('pageerror', e => erros.push('pageerror: ' + e.message));
  // Erros de rede de recursos externos (fontes) não são falha da página: em
  // ambiente sem saída para fonts.googleapis.com o navegador reclama e a página
  // segue funcionando com a pilha de fallback.
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) erros.push('requestfailed: ' + r.url()); });
  p.on('console', m => {
    const t = m.text();
    if (m.type() !== 'error') return;
    if (/fonts|favicon|Failed to load resource/.test(t)) return;
    erros.push('console: ' + t);
  });
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  checa(erros.length === 0, 'sem erros de JavaScript', erros.join(' | '));
  checa(await p.evaluate(() => !!window.MS), 'ponto de inspeção exposto');

  // ---------- 2. o que a página calcula bate com o que o pipeline calculou ----------
  const ref = await p.evaluate(async () => (await (await fetch('./data.json')).json()));
  const viva = await p.evaluate(() => window.MS.D);
  const N = ref.weeks.length;

  const cmpSerie = (nome, a, b, tol) => {
    if (!a || !b) return checa(false, nome, 'série ausente');
    let pior = 0, onde = -1;
    for (let i = 0; i < N; i++) { const d = Math.abs((a[i] || 0) - (b[i] || 0)); if (d > pior) { pior = d; onde = i; } }
    checa(pior <= tol, nome, `desvio máximo ${pior.toFixed(3)} na semana ${onde} (tolerância ${tol})`);
  };
  cmpSerie('volume semanal reconcilia com o pipeline', viva.weekly_total_T, ref.weekly_total_T, 0.02);
  cmpSerie('share de labs chineses reconcilia', viva.origin_share['China'], ref.origin_share['China'], 0.6);
  cmpSerie('share da Anthropic reconcilia', viva.an_share, ref.comp_share.anthropic, 0.6);
  cmpSerie('top 5 reconcilia', viva.top5, ref.top5, 0.6);

  // ---------- 3. shares somam 100 em toda semana ----------
  for (const chave of ['origin_share', 'weights_share', 'vendor_share', 'cobranca_share']) {
    const o = viva[chave]; let pior = 0;
    for (let i = 0; i < N; i++) {
      const s = Object.values(o).reduce((a, v) => a + (v[i] || 0), 0);
      pior = Math.max(pior, Math.abs(s - 100));
    }
    checa(pior < 0.6, `${chave} soma 100% em toda semana`, `pior desvio ${pior.toFixed(2)}pp`);
  }

  // ---------- 4. leaderboard não contém a linha agregada da fonte ----------
  checa(!viva.boards.last.some(r => r.model === 'other'),
        'leaderboard não lista a linha "other" da fonte');
  checa(viva.boards.last.length > 0 && viva.boards.last[0].T >= viva.boards.last[1].T,
        'leaderboard ordenado por volume');

  // ---------- 5. filtros: as partes somam o todo ----------
  const dimTeste = 'pesos';
  const totalSem = await p.evaluate(() => window.MS.D.weekly_total_T[window.MS.D.weeks.length - 1]);
  let soma = 0;
  const valores = await p.evaluate(d => window.MS.MX.dic[d], dimTeste);
  for (let i = 0; i < valores.length; i++) {
    const v = await p.evaluate(({ d, i }) => {
      Object.keys(window.MS.FILTROS).forEach(k => delete window.MS.FILTROS[k]);
      window.MS.FILTROS[d] = new Set([i]);
      window.MS.recalcular();
      return window.MS.D.weekly_total_T[window.MS.D.weeks.length - 1];
    }, { d: dimTeste, i });
    soma += v;
  }
  await p.evaluate(() => { Object.keys(window.MS.FILTROS).forEach(k => delete window.MS.FILTROS[k]); window.MS.recalcular(); });
  // a diferença é exatamente o volume sem metadado, que sai de qualquer recorte
  const semMeta = await p.evaluate(() => {
    const MX = window.MS.MX, NW = MX.semanas.length;
    let s = 0;
    MX.modelos.forEach((m, i) => { if (!m.m) { const a = MX.t0[i], v = MX.v[i]; const k = NW - 1 - a; if (v && k >= 0 && k < v.length) s += v[k]; } });
    return s / 1e6;
  });
  checa(perto(soma + semMeta, totalSem, totalSem * 0.01),
        'partes filtradas + sem metadado = total',
        `${soma.toFixed(2)} + ${semMeta.toFixed(2)} vs ${totalSem.toFixed(2)}`);

  // ---------- 6. estado do filtro vai e volta pela URL ----------
  await p.evaluate(() => {
    const i = window.MS.MX.dic.pesos.indexOf('Open-weights');
    window.MS.FILTROS.pesos = new Set([i]); window.MS.aplicar();
  });
  await p.waitForTimeout(300);
  const url = p.url();
  checa(/pesos=Open-weights/.test(decodeURIComponent(url)), 'filtro escrito na URL', url);
  const p2 = await browser.newPage();
  const err2 = []; p2.on('pageerror', e => err2.push(e.message));
  await p2.goto(url, { waitUntil: 'networkidle' }); await p2.waitForTimeout(2000);
  checa(err2.length === 0, 'página abre a partir de URL filtrada sem erro', err2.join(' | '));
  checa(await p2.evaluate(() => window.MS.filtrando()), 'filtro da URL é aplicado na carga');
  await p2.close();

  // ---------- 7. sem transbordo horizontal em três larguras ----------
  for (const w of [390, 768, 1440]) {
    const t = await browser.newPage({ viewport: { width: w, height: 900 } });
    const e3 = []; t.on('pageerror', e => e3.push(e.message));
    await t.goto(BASE + '/index.html', { waitUntil: 'networkidle' }); await t.waitForTimeout(2000);
    const over = await t.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    checa(!over, `sem transbordo horizontal em ${w}px`);
    checa(e3.length === 0, `sem erro de JavaScript em ${w}px`, e3.join(' | '));
    await t.close();
  }

  // ---------- 8. tema escuro renderiza ----------
  const d = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const e4 = []; d.on('pageerror', e => e4.push(e.message));
  await d.goto(BASE + '/index.html', { waitUntil: 'networkidle' }); await d.waitForTimeout(2000);
  checa(await d.evaluate(() => document.querySelectorAll('svg path').length) > 100, 'tema escuro desenha os gráficos');
  checa(e4.length === 0, 'sem erro de JavaScript no tema escuro', e4.join(' | '));
  await d.close();

  await browser.close();

  console.log(`\n${ok.length} verificações passaram`);
  ok.forEach(n => console.log('  ok  ' + n));
  if (falhas.length) {
    console.error(`\n${falhas.length} FALHA(S):`);
    falhas.forEach(n => console.error('  X   ' + n));
    process.exit(1);
  }
  console.log('\nTUDO PASSOU.');
})();
