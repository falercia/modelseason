// Teste de foto. Refatoracao pura nao pode mudar um pixel, e as 73 checagens do
// e2e verificam comportamento, nao o resultado inteiro. Este captura o texto e a
// estrutura renderizada em 12 configuracoes e exige igualdade byte a byte.
//
//   node tests/foto.js --gravar    grava a referencia em tests/foto.json
//   node tests/foto.js             compara com a referencia e falha na diferenca
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv.find((a) => a.startsWith('http')) || process.env.BASE || 'http://localhost:8000';
const REF = path.join(__dirname, 'foto.json');
const GRAVAR = process.argv.includes('--gravar');

const JANELAS = ['all', 'ytd', '52', '26', '13', '4'];
const GRANS = ['semana', 'mes'];

// Capturado: todo texto visivel, a estrutura das secoes, e a assinatura de cada
// SVG. Nao capturamos pixel, que muda com fonte e com maquina.
const capturar = () => {
  const limpa = s => s.replace(/\s+/g, ' ').trim();
  const svgSig = s => {
    const c = {};
    s.querySelectorAll('*').forEach(e => { c[e.tagName] = (c[e.tagName] || 0) + 1; });
    const textos = [...s.querySelectorAll('text')].map(t => limpa(t.textContent));
    return { marcas: c, textos };
  };
  const cartoes = [...document.querySelectorAll('.card[data-chart]')].map(c => {
    const svg = c.querySelector('svg');
    const h3 = c.querySelector('.card-h h3');
    const clone = h3 ? h3.cloneNode(true) : null;
    clone?.querySelector('.expl')?.remove();
    return {
      id: c.dataset.chart,
      titulo: clone ? limpa(clone.textContent) : null,
      sub: limpa(c.querySelector('.card-h p')?.textContent || ''),
      svg: svg ? svgSig(svg) : null,
      tabela: [...c.querySelectorAll('.tbl th')].map(t => limpa(t.textContent)),
      linhasTabela: c.querySelectorAll('.tbl tbody tr').length,
      modos: [...c.querySelectorAll('.views button')].map(b => limpa(b.textContent)),
    };
  });
  const leituras = {};
  document.querySelectorAll('[id^="read-"]').forEach(e => { leituras[e.id] = limpa(e.innerText); });
  const tiles = [...document.querySelectorAll('#tiles > div')].map(t => limpa(t.innerText));
  return {
    tiles,
    cartoes,
    leituras,
    meta: limpa(document.querySelector('.meta')?.innerText || ''),
    fstat: limpa(document.getElementById('fstat')?.textContent || ''),
    secoes: [...document.querySelectorAll('main section')].map(s => limpa(s.querySelector('h2')?.textContent || '')),
  };
};

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const foto = {};
  for (const g of GRANS) {
    for (const j of JANELAS) {
      await page.evaluate(async ([g, j]) => {
        document.querySelectorAll('.chip[data-gran]').forEach(b => { if (b.dataset.gran === g) b.click(); });
        document.querySelectorAll('.chip[data-range]').forEach(b => { if (b.dataset.range === j) b.click(); });
        await new Promise(r => setTimeout(r, 500));
      }, [g, j]);
      foto[`${g}/${j}`] = await page.evaluate(capturar);
    }
  }

  // painel de metodologia: titulo e texto proprio de cada grafico
  foto['painel'] = await page.evaluate(async () => {
    const limpa = s => s.replace(/\s+/g, ' ').trim();
    const out = {};
    for (const c of document.querySelectorAll('.card[data-chart]')) {
      const b = c.querySelector('.card-h h3 .expl'); if (!b) continue;
      b.click(); await new Promise(r => setTimeout(r, 90));
      out[c.dataset.chart] = {
        titulo: limpa(document.getElementById('painel-met-t').textContent),
        texto: limpa(document.getElementById('painel-grafico').textContent),
        verbetes: [...document.querySelectorAll('#painel-corpo details')]
          .filter(d => !d.hidden).map(d => limpa(d.querySelector('summary').textContent)),
      };
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return out;
  });

  await browser.close();

  if (erros.length) { console.error('ERRO DE JAVASCRIPT:', erros.join(' | ')); process.exit(1); }

  const atual = JSON.stringify(foto, null, 1);
  if (GRAVAR) {
    fs.writeFileSync(REF, atual);
    const n = Object.keys(foto).length;
    console.log(`referência gravada: ${n} configurações, ${(atual.length / 1024).toFixed(0)} KB`);
    return;
  }
  if (!fs.existsSync(REF)) { console.error('sem referência. rode com --gravar primeiro.'); process.exit(1); }
  const ref = fs.readFileSync(REF, 'utf8');
  if (ref === atual) { console.log(`foto idêntica em ${Object.keys(foto).length} configurações.`); return; }

  // diferenca: apontar exatamente onde
  const a = JSON.parse(ref), b = foto;
  const difs = [];
  const anda = (x, y, cam) => {
    if (JSON.stringify(x) === JSON.stringify(y)) return;
    if (typeof x !== 'object' || typeof y !== 'object' || x === null || y === null) {
      difs.push(`${cam}\n    antes: ${JSON.stringify(x)?.slice(0, 140)}\n    agora: ${JSON.stringify(y)?.slice(0, 140)}`);
      return;
    }
    for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) anda(x[k], y[k], `${cam}.${k}`);
  };
  anda(a, b, 'foto');
  console.error(`\nA FOTO MUDOU em ${difs.length} pontos:\n`);
  difs.slice(0, 25).forEach(d => console.error('  ' + d));
  if (difs.length > 25) console.error(`  ... e mais ${difs.length - 25}`);
  process.exit(1);
})();
