/**
 * Testes de ponta a ponta da v2, contra o site rodando (`next start`).
 * Herdam as travas da v1 que valem para qualquer versão da página:
 * todo "?" tem texto próprio, nenhum número vira NaN, nada rola de lado no
 * celular, e o que a página mostra bate com o que o pipeline gerou.
 *
 * Idiomas: o português mora na raiz e o inglês em /en. O bloco "inglês" no fim
 * roda as mesmas travas no /en e procura português que tenha vazado (acento,
 * palavra, vírgula decimal, US$) em todo texto visível, inclusive nos painéis.
 *
 * Uso: node tests/e2e.mjs [http://localhost:3000]
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const agora = JSON.parse(readFileSync(new URL('../data/web/agora.json', import.meta.url), 'utf8'));
const conteudoTodo = JSON.parse(readFileSync(new URL('../content/conteudo.json', import.meta.url), 'utf8'));
const conteudo = conteudoTodo.pt, conteudoEn = conteudoTodo.en;
const exe = process.env.PW_CHROMIUM || undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-proxy-server'] });
const falhas = [];
const ok = (nome, cond, det = '') => { console.log((cond ? '  ok  ' : '  X   ') + nome + (cond ? '' : `  [${det}]`)); if (!cond) falhas.push(nome); };

async function abrir(url, opts = {}) {
  const page = await browser.newPage({ viewport: { width: opts.w || 1400, height: 900 }, colorScheme: opts.tema || 'light' });
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) erros.push(m.text() + (m.location()?.url ? ' @ ' + m.location().url : '')); });
  page.on('requestfailed', r => { if (!/ERR_ABORTED/.test(r.failure()?.errorText ?? '')) erros.push(`falhou ${r.url()} (${r.failure()?.errorText})`); });
  const resp = await page.goto(BASE + url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(500);
  return { page, resp, erros };
}

// ---------------------------------------------------------------- home
{
  const { page, resp, erros } = await abrir('/');
  ok('home responde 200', resp.status() === 200, String(resp.status()));
  const texto = await page.locator('main').innerText();
  ok('nenhum NaN, undefined ou Infinity na página', !/\bNaN\b|undefined|Infinity/.test(texto), (texto.match(/.{30}(NaN|undefined|Infinity).{30}/) || [''])[0]);
  const t7 = agora.top7[0];
  const pod = await page.locator('[data-chart="agora-top7"]').innerText();
  ok('Agora: o líder de 7 dias é o do agora.json', pod.includes(t7.nome), t7.nome);
  ok('Agora: o share do líder bate', pod.includes(t7.share.toFixed(1).replace('.', ',') + '%'), String(t7.share));
  ok('Agora: a manchete é a gerada por regra', (await page.locator('.manchete h3').innerText()).replace(/\s+/g, ' ').trim() === agora.manchete.titulo);
  ok('Líderes: seis destaques', (await page.locator('[data-lider]').count()) === 6);

  // cada cartão com "?", e cada "?" com conteúdo cadastrado e próprio
  const cartoes = await page.locator('[data-chart]').evaluateAll(els => els.map(e => ({ id: e.getAttribute('data-chart'), temQ: !!e.querySelector('[data-info]') })));
  const semQ = cartoes.filter(c => !c.temQ && c.id !== 'manchete').map(c => c.id);
  ok('todo cartão tem "?"', semQ.length === 0, semQ.join(', '));
  const ids = [...new Set(await page.locator('[data-info]').evaluateAll(els => els.map(e => e.getAttribute('data-info'))))];
  const semTexto = ids.filter(id => !conteudo.graficos[id]);
  ok(`os ${ids.length} "?" têm conteúdo cadastrado`, semTexto.length === 0, semTexto.join(', '));
  const curtos = ids.filter(id => { const g = conteudo.graficos[id]; return g && (g.comoLer + g.perguntaQueResponde + g.oQueNaoMostra).length < 200; });
  ok('todo "?" tem pelo menos 200 caracteres próprios', curtos.length === 0, curtos.join(', '));

  // o painel abre com o título do gráfico e fecha com Esc
  await page.locator('[data-info="vendor"]').first().click();
  const titulo = await page.locator('#painel-t').innerText();
  ok('o "?" abre o painel com o título do próprio gráfico', titulo === conteudo.graficos.vendor.titulo, titulo);
  ok('o painel mostra "o que não mostra"', (await page.locator('.painel').innerText()).includes('o que não mostra'.toUpperCase()) || (await page.locator('.painel .blc.nao').count()) > 0);
  await page.keyboard.press('Escape');
  ok('Esc fecha o painel', (await page.locator('.painel').count()) === 0);

  // seção 09: três abas, três painéis no HTML
  const abas = await page.locator('#s09 [role="tab"]').allInnerTexts();
  ok('seção 09 tem as abas Anthropic, OpenAI e Google', ['Anthropic', 'OpenAI', 'Google'].every(n => abas.some(a => a.includes(n))), abas.join(' | '));
  ok('os três painéis de família estão no HTML', (await page.locator('#s09 [role="tabpanel"]').count()) === 3);
  await page.locator('#s09 [role="tab"]', { hasText: 'OpenAI' }).click();
  const visivel = await page.locator('#s09 [role="tabpanel"]:not([hidden])').innerText();
  ok('clicar em OpenAI mostra a família GPT', /GPT/.test(visivel));

  // recorte: janela e agrupamento mudam a URL e o eixo
  await page.locator('.filtros .chip', { hasText: '13 sem' }).click();
  await page.waitForTimeout(300);
  ok('janela de 13 semanas vai para a URL', page.url().includes('janela=13'));
  await page.locator('.filtros .chip', { hasText: 'Mês' }).click();
  await page.waitForTimeout(300);
  ok('agrupamento mensal vai para a URL', page.url().includes('agrupar=mes'));
  ok('nenhum erro de console na home', erros.length === 0, erros.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- filtro por URL
{
  const { page, erros } = await abrir('/?origin=China');
  const stat = await page.locator('.fstat').innerText();
  ok('filtro vindo na URL é aplicado', /de \d+ modelos/.test(stat), stat);
  const texto = await page.locator('main').innerText();
  ok('com filtro, nenhum NaN/undefined', !/\bNaN\b|undefined|Infinity/.test(texto));
  ok('com filtro, nenhum erro de console', erros.length === 0, erros.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- celular
for (const tema of ['light', 'dark']) {
  const { page, erros } = await abrir('/?janela=13&agrupar=mes', { w: 400, tema });
  const larg = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  ok(`400px ${tema}: sem rolagem horizontal`, larg.sw <= larg.iw + 1, `${larg.sw} > ${larg.iw}`);
  ok(`400px ${tema}: nenhum erro de console`, erros.length === 0, erros.slice(0, 3).join(' | '));
  await page.close();
}

// ---------------------------------------------------------------- página de modelo
{
  const slug = agora.top7[0].slug;
  const { page, resp, erros } = await abrir('/m/' + slug);
  ok('página do líder responde 200', resp.status() === 200, String(resp.status()));
  ok('página do líder tem o nome no h1', (await page.locator('h1').innerText()).includes(agora.top7[0].nome));
  ok('página do líder tem "O que esta página não diz"', (await page.locator('.nao').count()) > 0);
  ok('página do líder sem erro de console', erros.length === 0, erros.slice(0, 3).join(' | '));
  const html = await resp.text();
  ok('comparação renderizada no HTML do servidor', /Proprietário|pesos abertos/i.test(html));
  await page.close();
  const r404 = await abrir('/m/nao/existe');
  ok('slug inexistente dá 404', r404.resp.status() === 404, String(r404.resp.status()));
  await r404.page.close();
  // todo link para modelo na home leva a uma página que existe
  const { page: h } = await abrir('/');
  const links = [...new Set(await h.locator('a[href^="/m/"]').evaluateAll(as => as.map(a => a.getAttribute('href'))))];
  const quebrados = [];
  for (const l of links) { const r = await h.request.get(BASE + l); if (r.status() !== 200) quebrados.push(`${l} ${r.status()}`); }
  ok(`os ${links.length} links para modelo na home abrem`, quebrados.length === 0, quebrados.slice(0, 5).join(', '));
  await h.close();
}

// ---------------------------------------------------------------- botão Voltar
{
  // Regressão de 11/09: a URL voltava e a página do modelo ficava na tela,
  // porque o recorte trocava a URL apagando o history.state do roteador.
  const { page } = await abrir('/?janela=26&agrupar=mes');
  await page.locator('#s03 table a[href^="/m/"]').first().click();
  await page.waitForURL('**/m/**');
  await page.waitForTimeout(500);
  await page.goBack();
  await page.waitForTimeout(1200);
  ok('Voltar do modelo leva de volta à home', (await page.locator('h1').first().innerText()) === 'O que importa em IA hoje');
  ok('Voltar preserva o recorte da URL', page.url().includes('janela=26') && page.url().includes('agrupar=mes'), page.url());
  ok('Voltar restaura a janela escolhida nos filtros', (await page.locator('.filtros .chip', { hasText: '26 sem' }).getAttribute('aria-pressed')) === 'true');
  await page.close();
}

// ---------------------------------------------------------------- sitemap e robots
{
  const { page } = await abrir('/');
  const sm = await page.request.get(BASE + '/sitemap.xml');
  const xml = await sm.text();
  ok('sitemap lista as páginas de modelo', sm.status() === 200 && (xml.match(/\/m\//g) || []).length > 20, `${sm.status()} ${(xml.match(/\/m\//g) || []).length}`);
  const rb = await page.request.get(BASE + '/robots.txt');
  ok('robots aponta o sitemap', rb.status() === 200 && /sitemap/i.test(await rb.text()));
  await page.close();
}

// ---------------------------------------------------------------- inglês
// Português que vazou no /en: acento, palavra comum, vírgula decimal ("12,3"), US$ ou mês.
// Nomes próprios da fonte não têm acento; "τ-bench" e o nome do idioma no seletor ficam fora.
const MARCA_PT = /[ãõçáéíóúâêôà]|\b(não|são|está|também|então|porque|pelo|pela|uma|dos|das|semana|semanas|mês|meses|laboratório|laboratórios|modelos|gráfico|preço|gasto|para|entre|até|desde|sem dado|nenhum)\b|\d,\d{1,2}\b|US\$|\b(fev|abr|mai|ago|set|out|dez) \d/i;
const vazou = (txt) => {
  const limpo = txt.replace(/Português/g, '').replace(/τ-bench[^\n,.]*/g, '');
  const m = limpo.match(new RegExp('.{0,40}(' + MARCA_PT.source + ').{0,40}', 'i'));
  return m ? m[0].replace(/\s+/g, ' ') : null;
};
{
  const { page, resp, erros } = await abrir('/en');
  ok('en: home responde 200', resp.status() === 200, String(resp.status()));
  ok('en: <html lang="en">', (await page.getAttribute('html', 'lang')) === 'en');
  const alt = await page.locator('link[rel="alternate"][hreflang]').evaluateAll(ls => ls.map(l => `${l.getAttribute('hreflang')}=${new URL(l.href).pathname}`));
  ok('en: hreflang aponta pt-BR para / e en para /en', alt.includes('pt-BR=/') && alt.includes('en=/en'), alt.join(' '));
  ok('en: h1 em inglês', (await page.locator('h1').first().innerText()) === 'What matters in AI today');
  const texto = await page.locator('body').innerText();
  ok('en: nenhum NaN, undefined ou Infinity', !/\bNaN\b|undefined|Infinity/.test(texto));
  const t7 = agora.top7[0];
  ok('en: share do líder com ponto decimal', (await page.locator('[data-chart="agora-top7"]').innerText()).includes(t7.share.toFixed(1) + '%'), String(t7.share));
  ok('en: nenhum português visível na home', !vazou(texto), vazou(texto) || '');
  // todos os "?" com o texto em inglês
  const ids = [...new Set(await page.locator('[data-info]').evaluateAll(els => els.map(e => e.getAttribute('data-info'))))];
  const vazados = [];
  for (const id of ids) {
    await page.locator(`[data-info="${id}"]`).first().click();
    const painel = await page.locator('.painel').innerText();
    if (!painel.includes(conteudoEn.graficos[id]?.titulo ?? '§')) vazados.push(`${id}: título`);
    const v = vazou(painel); if (v) vazados.push(`${id}: ${v}`);
    await page.keyboard.press('Escape');
  }
  ok(`en: os ${ids.length} painéis do "?" em inglês`, vazados.length === 0, vazados.slice(0, 4).join(' | '));
  await page.locator('.tbtn', { hasText: 'How to read this page' }).first().click();
  const ref = await page.locator('.painel').innerText();
  ok('en: "How to read this page" sem português', !vazou(ref), vazou(ref) || '');
  await page.keyboard.press('Escape');
  // recorte, agrupamento mensal e filtro em inglês
  await page.locator('.filtros .chip', { hasText: '13 wk' }).click();
  await page.locator('.filtros .chip', { hasText: 'Month' }).click();
  await page.locator('.filtros .chip', { hasText: 'Model filters' }).click();
  await page.waitForTimeout(400);
  const comFiltro = await page.locator('body').innerText();
  ok('en: mensal + 13 semanas sem português nem NaN', !vazou(comFiltro) && !/\bNaN\b/.test(comFiltro), vazou(comFiltro) || 'NaN');
  ok('en: recorte vai para a URL mantendo /en', new URL(page.url()).pathname === '/en' && page.url().includes('janela=13'), page.url());
  // seletor de idioma leva ao mesmo lugar em português, com o recorte
  ok('en: nenhum erro de console', erros.length === 0, erros.slice(0, 3).join(' | '));
  await Promise.all([page.waitForURL(u => !new URL(u).pathname.startsWith('/en'), { timeout: 30000 }), page.locator('.idiomas a[hreflang="pt-BR"]').click()]);
  const dest = new URL(page.url());
  ok('en: seletor leva para / com o recorte', dest.pathname === '/' && dest.search.includes('janela=13') && dest.search.includes('agrupar=mes'), page.url());
  ok('en: seletor abre a página em português', (await page.getAttribute('html', 'lang')) === 'pt-BR');
  await page.close();
}
{
  const { page } = await abrir('/en/?origin=China');
  ok('en: filtro por URL aplicado', /of \d+ models/.test(await page.locator('.fstat').innerText()));
  await page.close();
  for (const tema of ['light', 'dark']) {
    const { page: p, erros } = await abrir('/en?janela=13&agrupar=mes', { w: 400, tema });
    const larg = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(`en 400px ${tema}: sem rolagem horizontal`, larg.sw <= larg.iw + 1, `${larg.sw} > ${larg.iw}`);
    ok(`en 400px ${tema}: nenhum erro de console`, erros.length === 0, erros.slice(0, 3).join(' | '));
    await p.close();
  }
}
{
  const slug = agora.top7[0].slug;
  const { page, resp, erros } = await abrir('/en/m/' + slug);
  ok('en: página do líder responde 200', resp.status() === 200, String(resp.status()));
  ok('en: página do modelo com lang="en"', (await page.getAttribute('html', 'lang')) === 'en');
  const texto = await page.locator('body').innerText();
  ok('en: página do modelo sem português', !vazou(texto), vazou(texto) || '');
  ok('en: página do modelo sem erro de console', erros.length === 0, erros.slice(0, 3).join(' | '));
  const links = [...new Set(await page.locator('main a[href^="/"]').evaluateAll(as => as.map(a => a.getAttribute('href'))))];
  const semPrefixo = links.filter(l => !l.startsWith('/en'));
  ok('en: links internos da página de modelo ficam no /en', semPrefixo.length === 0, semPrefixo.slice(0, 5).join(', '));
  await page.close();
  // um modelo fora do top: página gerada sob demanda, também sem português
  const outro = Object.keys(JSON.parse(readFileSync(new URL('../data/web/modelos.json', import.meta.url), 'utf8')).modelos)[120];
  const o = await abrir('/en/m/' + outro);
  ok('en: modelo gerado sob demanda sem português', o.resp.status() === 200 && !vazou(await o.page.locator('body').innerText()), outro);
  await o.page.close();
  // todo link para modelo na home em inglês abre
  const { page: h } = await abrir('/en');
  const ms = [...new Set(await h.locator('a[href^="/en/m/"]').evaluateAll(as => as.map(a => a.getAttribute('href'))))];
  const quebrados = [];
  for (const l of ms) { const r = await h.request.get(BASE + l); if (r.status() !== 200) quebrados.push(`${l} ${r.status()}`); }
  ok(`en: os ${ms.length} links para modelo abrem`, ms.length > 10 && quebrados.length === 0, quebrados.slice(0, 5).join(', '));
  ok('en: nenhum link para modelo sem o prefixo /en', (await h.locator('a[href^="/m/"]').count()) === 0);
  await h.close();
}
{
  // rotas: 404 nos dois idiomas, /pt redireciona para a raiz, arquivos da raiz não são reescritos
  const r1 = await abrir('/en/m/nao/existe');
  ok('en: slug inexistente dá 404 em inglês', r1.resp.status() === 404 && (await r1.page.locator('h1').innerText()) === 'Model not found');
  await r1.page.close();
  const r2 = await abrir('/qualquer-coisa');
  ok('caminho inexistente dá 404 em português', r2.resp.status() === 404 && (await r2.page.locator('h1').innerText()) === 'Página não encontrada');
  await r2.page.close();
  const r3 = await abrir('/en/anything');
  ok('en: caminho inexistente dá 404 em inglês', r3.resp.status() === 404 && (await r3.page.locator('h1').innerText()) === 'Page not found');
  await r3.page.close();
  const pg = await browser.newPage();
  const red = await pg.request.get(BASE + '/pt/m/' + agora.top7[0].slug, { maxRedirects: 0 });
  ok('/pt/... redireciona para a raiz', [301, 308].includes(red.status()) && red.headers()['location']?.replace(BASE, '') === '/m/' + agora.top7[0].slug, `${red.status()} ${red.headers()['location']}`);
  for (const arq of ['/data.json', '/og.png', '/robots.txt', '/sitemap.xml', '/icon.svg']) {
    const r = await pg.request.get(BASE + arq);
    ok(`${arq} continua servido na raiz`, r.status() === 200, String(r.status()));
  }
  const xml = await (await pg.request.get(BASE + '/sitemap.xml')).text();
  ok('sitemap tem as páginas em inglês com hreflang', (xml.match(/\/en\/m\//g) || []).length > 20 && /hreflang="en"/.test(xml));
  await pg.close();
}

await browser.close();
console.log(`\n${falhas.length ? 'Falharam ' + falhas.length : 'Todas passaram'}.`);
process.exit(falhas.length ? 1 : 0);
