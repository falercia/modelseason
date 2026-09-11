/**
 * Testes de ponta a ponta da v2, contra o site rodando (`next start`).
 * Herdam as travas da v1 que valem para qualquer versão da página:
 * todo "?" tem texto próprio, nenhum número vira NaN, nada rola de lado no
 * celular, e o que a página mostra bate com o que o pipeline gerou.
 *
 * Uso: node tests/e2e.mjs [http://localhost:3000]
 */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
const agora = JSON.parse(readFileSync(new URL('../data/web/agora.json', import.meta.url), 'utf8'));
const conteudo = JSON.parse(readFileSync(new URL('../content/conteudo.json', import.meta.url), 'utf8'));
const exe = process.env.PW_CHROMIUM || undefined;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-proxy-server'] });
const falhas = [];
const ok = (nome, cond, det = '') => { console.log((cond ? '  ok  ' : '  X   ') + nome + (cond ? '' : `  [${det}]`)); if (!cond) falhas.push(nome); };

async function abrir(url, opts = {}) {
  const page = await browser.newPage({ viewport: { width: opts.w || 1400, height: 900 }, colorScheme: opts.tema || 'light' });
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) erros.push(m.text()); });
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

await browser.close();
console.log(`\n${falhas.length ? 'Falharam ' + falhas.length : 'Todas passaram'}.`);
process.exit(falhas.length ? 1 : 0);
