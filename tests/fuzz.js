/**
 * Varredura de recortes.
 *
 * A classe de bug mais cara desta página é texto que assume um fato que o filtro
 * pode remover: "vs.xiaomi[84]" quando Xiaomi saiu do top 8, "×66716" quando a
 * base é zero, "US$ NaN" quando nenhum modelo do recorte tem preço.
 *
 * Revisar isso a olho não escala: são 29 opções de filtro em 7 dimensões. Este
 * teste aplica cada opção isolada, mais combinações de duas e alguns recortes
 * propositalmente degenerados, e falha se aparecer erro de JavaScript ou lixo
 * numérico no texto visível.
 *
 *   node tests/fuzz.js [url]
 */
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:8000';

// Padrões que nunca devem aparecer no texto renderizado.
const LIXO = [
  /\bNaN\b/, /\bundefined\b/, /\bInfinity\b/, /\bnull\b/,
  /×0\b/, /×Infinity/, /US\$\s*NaN/, /\[object Object\]/,
  /—%/, /—pp/, /US\$\s*—/, /\bde 0 modelos\b/, /NaNpp/, /-Infinity/,
];

const falhas = [];
let casos = 0;

(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);

  const dims = await p.evaluate(() => {
    const o = {};
    for (const d of window.MS.MX.dims) o[d] = window.MS.MX.dic[d];
    return o;
  });
  const GRUPOS = ['cobranca', 'pesos', 'origin', 'faixa_preco', 'faixa_ctx', 'multimodal', 'raciocinio'];

  async function aplica(recorte) {
    erros.length = 0;
    const r = await p.evaluate(rec => {
      Object.keys(window.MS.FILTROS).forEach(k => delete window.MS.FILTROS[k]);
      for (const [d, vals] of Object.entries(rec)) {
        const s = new Set();
        vals.forEach(v => { const i = window.MS.MX.dic[d].indexOf(v); if (i >= 0) s.add(i); });
        if (s.size) window.MS.FILTROS[d] = s;
      }
      try { window.MS.aplicar(); } catch (e) { return { erro: e.message }; }
      // Card sem grafico nem estado vazio explicito e falha silenciosa: o leitor
      // ve um retangulo em branco e nao sabe se e bug ou se nao ha dado.
      const mudos = [...document.querySelectorAll('.card[data-chart]')]
        .filter(c => {
          const plot = c.querySelector('.plot');
          if (!plot) return false;
          const temSvg = plot.querySelector('svg');
          const temTexto = plot.innerText.trim().length > 0;
          return !temSvg && !temTexto;
        })
        .map(c => c.dataset.chart);
      // Painel de leitura vazio idem.
      const leiturasVazias = [...document.querySelectorAll('.read')]
        .filter(a => a.innerText.trim().length < 20)
        .map(a => a.id);
      return {
        texto: document.querySelector('.wrap').innerText,
        modelos: window.MS.selecionados().length,
        mudos, leiturasVazias,
      };
    }, recorte);
    casos++;
    const nome = JSON.stringify(recorte);
    if (r.erro) return falhas.push(`${nome} → exceção em aplicar(): ${r.erro}`);
    if (erros.length) return falhas.push(`${nome} → erro de JS: ${erros[0]}`);
    for (const re of LIXO) {
      const m = r.texto.match(new RegExp('.{0,60}' + re.source + '.{0,60}'));
      if (m) return falhas.push(`${nome} → lixo no texto (${re.source}): "${m[0].replace(/\n/g, ' ')}"`);
    }
    if (r.mudos.length) return falhas.push(`${nome} → card em branco, sem gráfico nem mensagem: ${r.mudos.join(', ')}`);
    if (r.leiturasVazias.length) return falhas.push(`${nome} → painel de leitura vazio: ${r.leiturasVazias.join(', ')}`);
  }

  // 1. cada opção isolada
  for (const d of GRUPOS) for (const v of dims[d]) await aplica({ [d]: [v] });

  // 2. pares entre dimensões diferentes, primeira opção de cada
  for (let i = 0; i < GRUPOS.length; i++)
    for (let j = i + 1; j < GRUPOS.length; j++)
      await aplica({ [GRUPOS[i]]: [dims[GRUPOS[i]][0]], [GRUPOS[j]]: [dims[GRUPOS[j]][0]] });

  // 3. recortes propositalmente degenerados
  const degenerados = [
    { cobranca: ['Endpoint gratuito'], faixa_preco: ['Acima de $5'] },   // provavelmente vazio
    { pesos: ['Não identificado'] },
    { faixa_ctx: ['Não identificado'], raciocinio: ['Não identificado'] },
    { origin: ['Europa'] },                                              // fatia minúscula
    { origin: ['Coreia'], multimodal: ['Multimodal'] },
    { cobranca: ['Pago'], pesos: ['Proprietário'], origin: ['China'] },
  ];
  for (const r of degenerados) await aplica(r);

  await browser.close();

  console.log(`\n${casos} recortes testados`);
  if (falhas.length) {
    console.error(`\n${falhas.length} FALHA(S):`);
    falhas.forEach(f => console.error('  X  ' + f));
    process.exit(1);
  }
  console.log('Nenhum recorte produziu erro ou número inválido.');
})();
