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

  // ---------- 6b. granularidade mensal preserva os números ----------
  // Absoluto vira média semanal dentro do mês, senão um mês de 5 semanas parece
  // 25% maior sem nada ter acontecido. Share é razão de somas e não pode mudar.
  await p.evaluate(() => { Object.keys(window.MS.FILTROS).forEach(k => delete window.MS.FILTROS[k]); window.MS.aplicar(); });
  await p.waitForTimeout(400);
  const semanal = await p.evaluate(() => ({ w: window.MS.D.weeks.slice(), tot: window.MS.D.weekly_total_T.slice(),
                                            china: window.MS.D.origin_share['China'].slice() }));
  await p.click('.chip[data-gran="mes"]'); await p.waitForTimeout(900);
  const mensal = await p.evaluate(() => ({ m: window.MS.D.weeks.slice(), tot: window.MS.D.weekly_total_T.slice(),
                                           china: window.MS.D.origin_share['China'].slice(),
                                           gran: window.MS.gran }));
  checa(mensal.gran === 'mes' && mensal.m.length < semanal.w.length, 'granularidade mensal reduz o número de pontos');
  let piorAbs = 0, piorSh = 0;
  mensal.m.forEach((mes, i) => {
    const pref = mes.slice(0, 7);
    let soma = 0, nsem = 0, num = 0, den = 0;
    semanal.w.forEach((s, j) => {
      if (s.slice(0, 7) !== pref) return;
      soma += semanal.tot[j]; nsem++;
      num += semanal.china[j] * semanal.tot[j]; den += semanal.tot[j];
    });
    if (!nsem) return;
    piorAbs = Math.max(piorAbs, Math.abs(mensal.tot[i] * nsem - soma) / Math.max(soma, 1e-9) * 100);
    piorSh = Math.max(piorSh, Math.abs((den ? num / den : 0) - mensal.china[i]));
  });
  checa(piorAbs < 0.1, 'média mensal × nº de semanas reconstitui a soma semanal', `erro ${piorAbs.toFixed(3)}%`);
  checa(piorSh < 0.05, 'share mensal é a média ponderada das semanas', `desvio ${piorSh.toFixed(3)}pp`);
  for (const r of ['52', '26', '13', '4', 'ytd', 'all']) {
    await p.click(`.chip[data-range="${r}"]`); await p.waitForTimeout(200);
  }
  checa(erros.length === 0, 'trocar janela e granularidade não gera erro', erros.join(' | '));
  await p.click('.chip[data-gran="semana"]'); await p.waitForTimeout(600);

  // ---------- 6b2. nenhum SVG com atributo NaN em nenhuma janela ----------
  // Escala com domínio degenerado produz NaN e o gráfico sai quebrado em
  // silêncio: o SVG existe, não lança exceção, e não desenha nada.
  for (const g of ['semana', 'mes']) {
    await p.click(`.chip[data-gran="${g}"]`); await p.waitForTimeout(500);
    for (const r of ['all', '52', '26', '13', '4', 'ytd']) {
      await p.click(`.chip[data-range="${r}"]`); await p.waitForTimeout(320);
      const quebrados = await p.evaluate(() => {
        const out = [];
        document.querySelectorAll('.card[data-chart]').forEach(c => {
          const n = [...c.querySelectorAll('svg *')]
            .filter(e => [...e.attributes].some(a => /NaN/i.test(a.value)));
          if (n.length) out.push(c.dataset.chart);
        });
        return out;
      });
      checa(quebrados.length === 0, `sem atributo NaN em ${g}/${r}`, quebrados.join(', '));
    }
  }
  await p.click('.chip[data-gran="semana"]'); await p.waitForTimeout(400);
  await p.click('.chip[data-range="all"]'); await p.waitForTimeout(500);

  // ---------- 6b3. as leituras respondem à janela ----------
  // Se o texto não muda quando a janela muda, ele está descrevendo outra coisa.
  const leituraDe = async r => {
    await p.click(`.chip[data-range="${r}"]`); await p.waitForTimeout(450);
    return p.evaluate(() => document.getElementById('read-volume').innerText);
  };
  const lTudo = await leituraDe('all'), l13 = await leituraDe('13'), l4 = await leituraDe('4');
  checa(lTudo !== l13 && l13 !== l4, 'painel de leitura muda quando a janela muda');
  await p.click('.chip[data-range="all"]'); await p.waitForTimeout(400);

  // ---------- 6c. o mapa da temporada ----------
  const mapa = await p.evaluate(() => {
    const M = window.MS.D.mapa;
    if (!M) return null;
    const fora = M.labs.filter(o => o.y < 0 || o.y > 100 || (o.xRec != null && (o.xRec < 0 || o.xRec > 100)));
    return { labs: M.labs.length, comIndice: M.com_indice, fora: fora.length,
             semX: M.labs.filter(o => o.xRec == null).length };
  });
  checa(!!mapa && mapa.labs > 0, 'mapa tem laboratórios');
  checa(mapa && mapa.fora === 0, 'percentis do mapa ficam entre 0 e 100', `${mapa && mapa.fora} fora da faixa`);
  checa(mapa && mapa.semX === 0, 'todo laboratório tem posição no modo Recursos', `${mapa && mapa.semX} sem eixo x`);
  await p.click('.views button[data-mapa="indice"]'); await p.waitForTimeout(600);
  checa(erros.length === 0, 'alternar o modo do mapa não gera erro', erros.join(' | '));
  await p.click('.views button[data-mapa="recursos"]'); await p.waitForTimeout(400);

  // ---------- 6d. metodologia ----------
  const met = await p.evaluate(() => ({
    n: document.querySelectorAll('#metodologia details').length,
    semNao: [...document.querySelectorAll('#metodologia details')].filter(d => !d.querySelector('.nao')).length,
  }));
  checa(met.n >= 12, 'seção de metodologia documenta os indicadores', `${met.n} blocos`);
  checa(met.semNao === 0, 'todo indicador diz o que NÃO conclui', `${met.semNao} sem esse bloco`);

  // ---------- 6e. sinais da temporada ----------
  // Esta secao ja nasceu com o bug classico da pagina: texto que nao reage a
  // janela. Aqui a janela precisa mudar a BASE do estimador, nao so o recorte.
  const lerSinais = async (range) => {
    await p.click(`.chip[data-range="${range}"]`); await p.waitForTimeout(400);
    return p.evaluate(() => {
      const S = window.MS.D.sinais;
      return { base: S.base, horiz: S.horiz, n: window.MS.D.weeks.length,
               projs: S.projs.map(x => ({ taxa: x.taxa, alvo: x.alvo, rompe: !!x.rompe })) };
    });
  };
  const sAll = await lerSinais('all'), s26 = await lerSinais('26'), s4 = await lerSinais('4');
  checa(sAll.projs.length > 0, 'seção de sinais projeta séries');
  checa(sAll.base !== s26.base && s26.base !== s4.base,
    'a janela muda a base do estimador', `${sAll.base} / ${s26.base} / ${s4.base}`);
  checa([sAll, s26, s4].every(s => s.horiz <= Math.max(2, Math.round(s.n / 4))),
    'horizonte nunca passa de um quarto do observado');
  const taxaZero = [sAll, s26, s4].flatMap(s => s.projs).filter(x => /^0,0(pp)?$/.test(x.taxa) || /^US\$ 0,00$/.test(x.taxa));
  checa(taxaZero.length === 0, 'nenhuma projeção publica taxa que arredonda para zero', `${taxaZero.length} linhas`);
  const alvoFurado = [sAll, s26, s4].flatMap(s => s.projs).filter(x => x.rompe && x.alvo !== null);
  checa(alvoFurado.length === 0, 'reta que rompe o limite não publica valor de chegada', `${alvoFurado.length} linhas`);
  const txtSinais = await p.evaluate(() => document.querySelector('#sinais').innerText);
  checa(!/0 padr[õo]/.test(txtSinais) && !/NaN|undefined/.test(txtSinais), 'seção de sinais sem texto degenerado');
  await p.click('.chip[data-range="all"]'); await p.waitForTimeout(400);

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
