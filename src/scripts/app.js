import { ST, definirJanela, definirGran, definirOrdemBarras, definirTrajetoria,
  definirEixoQualidade, definirModoMapa, definirComparados } from './estado.js';
import { VENDOR_LABEL } from './rotulos.js';
import { css, br, fmtT, fmtNum, fmtP, fmtUSD, fmtCtx, fmtVez, capital,
  fmtDate, ptBR, fD, fPer, monthTicks } from './formato.js';

fetch('./data.json',{cache:'no-cache'}).then(r=>r.json()).then(init).catch(e=>{document.getElementById('tiles').innerHTML='<p style="color:var(--bad)">Não foi possível carregar data.json: '+e.message+'</p>';});
function init(D){
// O eixo do tempo e MUTAVEL: a granularidade (semanal ou mensal) redefine
// quantos pontos existem e o que cada ponto representa. Todos os graficos leem
// W e N, entao trocar a granularidade e trocar estes dois.
ST.W = D.weeks.map(s=>new Date(s+'T00:00:00'));
ST.N = ST.W.length;
// Formatadores e estado vem de modulos. O resto deste arquivo ainda e o
// monolito original, e a entrega 3 continua de onde parou (docs/arquitetura.md).
// ---- range filter
// ---- granularidade e janela --------------------------------------------
// A janela e sempre declarada em SEMANAS, porque semana e a unidade nativa da
// fonte. Ao agrupar por mes, a janela e convertida; assim "26 semanas" continua
// significando o mesmo periodo, com menos pontos.
ST.GRAN='semana'; ST.JANELA='all';
ST.SEMANAS_ISO=D.matriz.semanas.slice();
ST.MAPA_BUCKET=[];                       // indice da semana -> indice do bucket

// A JANELA FAZ PARTE DO DADO, nao de cada grafico ou painel.
//
// Antes, o recorte de tempo era aplicado na hora de desenhar: cada grafico
// chamava idx() e cada painel de leitura precisava lembrar de usar range[0] em
// vez de 0. Isso significa que todo painel novo nasce errado ate alguem lembrar,
// e a pagina vai continuar crescendo. Mesma classe de fragilidade dos nomes de
// laboratorio escritos no codigo.
//
// Agora W, N e SERIES ja saem recortados. Depois desta funcao, indice 0 e o
// inicio da janela e N-1 e o fim, para todo mundo. Nao ha o que lembrar.
function construirEixo(){
  const datas=ST.SEMANAS_ISO.map(s=>new Date(s+'T00:00:00'));
  let eixoTodo, mapaTodo;
  if(ST.GRAN==='semana'){
    eixoTodo=datas; mapaTodo=datas.map((_,i)=>i);
  } else {
    // Cada semana entra no mes do seu primeiro dia (segunda-feira). Semana que
    // atravessa a virada de mes conta inteira no mes em que comecou; e a unica
    // regra que preserva a soma total sem dividir tokens arbitrariamente.
    const chave=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const chaves=datas.map(chave), unicas=[...new Set(chaves)];
    eixoTodo=unicas.map(k=>new Date(k+'-01T00:00:00'));
    mapaTodo=chaves.map(k=>unicas.indexOf(k));
  }
  const nTodo=eixoTodo.length;
  const semTodo=new Array(nTodo).fill(0);
  mapaTodo.forEach(b=>semTodo[b]++);

  const serieTodo = (ST.GRAN==='semana') ? SERIES_SEM
    : SERIES_SEM.map(s=>{ const o=new Array(nTodo).fill(0);
        for(let w=0;w<s.length;w++) o[mapaTodo[w]]+=(s[w]||0);
        return o.map((v,i)=>v/(semTodo[i]||1)); });
  const colMedia = s => { const soma=new Array(nTodo).fill(0), n=new Array(nTodo).fill(0);
    for(let w=0;w<s.length;w++){ const v=s[w]; if(v==null) continue;
      soma[mapaTodo[w]]+=v; n[mapaTodo[w]]++; }
    return soma.map((v,i)=>n[i]? +(v/n[i]).toFixed(2) : null); };
  const churnTodo = (ST.GRAN==='semana') ? CHURN_SEM : colMedia(CHURN_SEM);
  const ageTodo   = (ST.GRAN==='semana') ? AGE_SEM   : colMedia(AGE_SEM);

  // ---- recorte da janela, aplicado uma vez, aqui ----
  const [a,b]=rangeFor(ST.JANELA, nTodo, eixoTodo);
  ST.JANELA_INI=a; ST.JANELA_TOTAL=nTodo;
  ST.W=eixoTodo.slice(a,b+1); ST.N=ST.W.length; ST.NW=ST.N;
  ST.SEMANAS_POR_BUCKET=semTodo.slice(a,b+1);
  ST.MAPA_BUCKET=mapaTodo;
  ST.SERIES=serieTodo.map(s=>s.slice(a,b+1));
  D.churn=churnTodo.slice(a,b+1);
  D.age=ageTodo.slice(a,b+1);
  D.weeks=ST.W.map(d=>d3.timeFormat('%Y-%m-%d')(d));
  ST.range=[0,ST.N-1];
}
// Quantas semanas caem em cada bucket. Mes tem 4 ou 5, e essa diferenca e a
// armadilha da agregacao mensal: um mes de 5 semanas parece 25% maior que um de
// 4 sem nada ter acontecido no mercado. Por isso valores ABSOLUTOS viram media
// semanal dentro do bucket, nao soma. A unidade continua sendo "por semana" nas
// duas granularidades, os meses ficam comparaveis, e os percentuais nao mudam:
// share e razao de somas, e dividir os dois lados pelo mesmo numero nao altera.
// O colapso propriamente dito acontece em construirEixo().
ST.SEMANAS_POR_BUCKET=[];

ST.range=[0,ST.N-1];
ST.JANELA_INI=0; ST.JANELA_TOTAL=ST.N;
function rangeFor(key, total, eixo){
  const fim=total-1;
  if(key==='all') return [0,fim];
  if(key==='ytd'){
    const ano=eixo[fim].getFullYear();
    const i=eixo.findIndex(d=>d.getFullYear()===ano);
    return [i<0?0:i, fim];
  }
  const sem=+key;
  const pontos = ST.GRAN==='semana' ? sem : Math.max(2, Math.round(sem/4.345));
  return [Math.max(0,total-pontos), fim];
}
// Painel de metodologia. O conteudo NAO e duplicado: e clonado da secao 12 na
// primeira abertura, entao existe uma fonte de verdade so. Editar a secao muda
// o painel de graca, e nao ha o risco classico de os dois divergirem.
(()=>{
  const btn=document.getElementById('btn-met'), pan=document.getElementById('painel-met'),
        fun=document.getElementById('painel-fundo'), corpo=document.getElementById('painel-corpo'),
        fechar=document.getElementById('painel-x');
  if(!btn||!pan) return;
  let montado=false, antes=null;
  const monta=()=>{
    if(montado) return; montado=true;
    const sec=document.getElementById('metodologia'); if(!sec) return;
    const intro=sec.querySelector('p');
    if(intro) corpo.appendChild(intro.cloneNode(true));
    sec.querySelectorAll('details').forEach(d=>{
      const c=d.cloneNode(true); c.removeAttribute('open'); corpo.appendChild(c);
    });
    const met=sec.querySelector('p:last-of-type');
    if(met && met!==intro) corpo.appendChild(met.cloneNode(true));
  };
  const abrir=()=>{ monta(); antes=document.activeElement;
    pan.hidden=false; fun.hidden=false; btn.setAttribute('aria-expanded','true');
    document.body.style.overflow='hidden'; fechar.focus(); };
  const sair=()=>{ pan.hidden=true; fun.hidden=true; btn.setAttribute('aria-expanded','false');
    document.body.style.overflow=''; if(antes&&antes.focus) antes.focus(); };
  btn.addEventListener('click',()=>{ if(pan.hidden){ abrir(); abrirMetodologia(); } else sair(); });
  const TIT_PADRAO='Como ler esta página';
  const tituloEl=document.getElementById('painel-met-t');
  const nota=document.getElementById('painel-nota');
  // Chamado pelos "?" de cada grafico. O titulo do painel passa a ser o titulo
  // DO GRAFICO clicado, e nao o nome do indicador: clicar em "Tração contra
  // capacidade" e ler um cabecalho escrito "Share de tokens" faz o leitor achar
  // que abriu a coisa errada.
  const proprio=document.getElementById('painel-grafico');
  const intro=()=>corpo.querySelector(':scope > p');
  window.abrirMetodologia=(tituloGrafico, verbetes, chave)=>{
    if(pan.hidden) abrir();
    const todos=[...corpo.querySelectorAll('details')];
    todos.forEach(d=>{ d.open=false; d.classList.remove('destaque'); d.hidden=false; });
    const ip=intro(); if(ip) ip.hidden=false;
    if(!tituloGrafico || !verbetes || !verbetes.length){
      tituloEl.textContent=TIT_PADRAO; nota.hidden=true; proprio.hidden=true; corpo.scrollTop=0; return;
    }
    const achados=verbetes
      .map(t=>todos.find(d=>d.querySelector('summary').textContent.trim()===t))
      .filter(Boolean);
    tituloEl.textContent=tituloGrafico;
    nota.hidden=false;
    nota.innerHTML='<button type="button" id="painel-todos">Ver todos os indicadores</button>';
    todos.forEach(d=>{ d.hidden = !achados.includes(d); });
    achados.forEach(d=>{ d.open=true; });
    if(ip) ip.hidden=true;

    // O texto especifico deste grafico vem PRIMEIRO. A definicao formal do
    // indicador vem depois, para quem quiser conferir a conta.
    const g=GRAFICO[chave];
    if(g){
      proprio.hidden=false;
      proprio.innerHTML=
        `<div class="pg-b"><span class="k">como ler</span><p>${g.ler}</p></div>`+
        `<div class="pg-b"><span class="k">a pergunta que responde</span><p>${g.perg}</p></div>`+
        `<div class="pg-b nao"><span class="k">o que não mostra</span><p>${g.nao}</p></div>`+
        (achados.length? `<p class="pg-lig">${achados.length===1?'A definição formal do indicador usado aqui:':'As definições formais dos '+achados.length+' indicadores usados aqui:'}</p>` : '');
    } else proprio.hidden=true;

    corpo.scrollTop=0;
    (g? proprio : achados[0]||proprio).scrollIntoView?.({block:'start'});
    document.getElementById('painel-todos')?.addEventListener('click',()=>abrirMetodologia());
  };
  fechar.addEventListener('click',sair);
  fun.addEventListener('click',sair);
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&!pan.hidden) sair(); });
  // foco preso dentro do painel enquanto ele esta aberto
  pan.addEventListener('keydown',e=>{
    if(e.key!=='Tab') return;
    const f=[...pan.querySelectorAll('button,summary,a[href]')].filter(x=>x.offsetParent!==null);
    if(!f.length) return;
    const pri=f[0], ult=f[f.length-1];
    if(e.shiftKey && document.activeElement===pri){ e.preventDefault(); ult.focus(); }
    else if(!e.shiftKey && document.activeElement===ult){ e.preventDefault(); pri.focus(); }
  });
})();

document.querySelectorAll('.chip[data-range]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.chip[data-range]').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true'); ST.JANELA=b.dataset.range; aplicar();
}));
document.querySelectorAll('.chip[data-gran]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.gran===ST.GRAN) return;
  document.querySelectorAll('.chip[data-gran]').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true'); ST.GRAN=b.dataset.gran;
  document.getElementById('gran-nota').hidden = (ST.GRAN!=='mes');
  aplicar();
}));
// O dado ja chega recortado, entao idx() e simplesmente todo o eixo. A funcao
// continua existindo para os graficos nao precisarem mudar.
const idx = () => d3.range(0,ST.N);

// ---- entity colors (fixed, never by rank)
// Cor segue a ENTIDADE, nunca a posicao no ranking: os quatro slots sao fixos e
// escolhidos pelos quatro maiores em volume acumulado. Todo o resto vira Outros,
// em neutro. Um filtro que muda a quantidade de series nao repinta os sobreviventes.
const VENDOR_SLOT = {deepseek:'--s1',openai:'--s2',tencent:'--s3','z-ai':'--s4',Outros:'--s0'};
const VENDOR_HUES = ['deepseek','openai','tencent','z-ai'];
// Dobra as series alem das quatro fixas em "Outros", somando os valores.
function dobrar(series, manter){
  const out={}; manter.forEach(k=>{ if(series[k]) out[k]=series[k].slice(); });
  const n=(series[manter[0]]||Object.values(series)[0]||[]).length;
  const outros=new Array(n).fill(0); let houve=false;
  Object.keys(series).forEach(k=>{ if(manter.includes(k)) return; houve=true;
    series[k].forEach((v,i)=>outros[i]+=(v||0)); });
  if(houve) out['Outros']=outros.map(v=>Math.round(v*100)/100);
  return out;
}
const ORIGIN_SLOT = {'EUA/Canadá':'--s1','China':'--s2','Europa':'--s3','Coreia':'--s4','Outros':'--s0','Não identificado':'--s0'};
const WEIGHTS_SLOT = {'Proprietário':'--s1','Open-weights':'--s3','Não identificado':'--s0'};
const FAM_SLOT = {Haiku:'--s2',Sonnet:'--s3',Opus:'--s1',Fable:'--s4'};
const col = slot => css(slot);

// ---- helpers
function card(name){ return document.querySelector(`.card[data-chart="${name}"]`); }
// Estado vazio explicito. Qualquer grafico pode ficar sem dado sob um recorte;
// a resposta certa e dizer isso, nunca lancar excecao e derrubar a pagina inteira.
function vazio(name, msg){
  const c=card(name); if(!c) return true;
  const plot=c.querySelector('.plot');
  plot.innerHTML=`<div style="padding:34px 8px;color:var(--ink-3);font-size:13px">${msg}</div>`;
  const lg=c.querySelector('.legend'); if(lg) lg.innerHTML='';
  const tb=c.querySelector('.tbl'); if(tb) tb.innerHTML='';
  return true;
}
function tip(plot){ let t=plot.querySelector('.tip'); if(!t){t=document.createElement('div');t.className='tip';plot.appendChild(t);} return t; }
function showTip(t, plot, x, y, html){ t.innerHTML=html; t.style.display='block'; const pw=plot.clientWidth; const tw=t.offsetWidth; t.style.left=(x+16+tw>pw? x-16-tw : x+16)+'px'; t.style.top=Math.max(0,y-10)+'px'; }
// Estado de series ocultas, por grafico. A legenda e o controle: clicar liga e
// desliga a serie. Resolve a sobreposicao sem esconder informacao por padrao, e
// permite ao leitor isolar o que ele quer comparar.
const HIDDEN={};
function hid(name){ return (HIDDEN[name] = HIDDEN[name] || new Set()); }
function visiveis(name, keys){ const h=hid(name); const v=keys.filter(k=>!h.has(k)); return v.length?v:keys; }
function legend(el, items, name, redraw){
  if(!el) return;
  const h = name ? hid(name) : null;
  el.innerHTML = items.map(([k,c,label])=>
    `<button type="button" data-k="${String(k).replace(/"/g,'&quot;')}" aria-pressed="${h?!h.has(k):true}">`+
    `<i style="background:${c}"></i><span class="lv">${label||k}</span></button>`).join('')
    + (h && h.size ? `<button type="button" class="all">mostrar tudo</button>` : '')
    + (h && !h.size ? `<span class="hint">clique para isolar séries</span>` : '');
  if(!name || !redraw) return;
  el.querySelectorAll('button[data-k]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.k;
    // Nao deixa esconder tudo: se sobrar so uma visivel, o clique nela reexibe todas.
    const todas=items.map(i=>String(i[0]));
    if(!h.has(k) && todas.filter(x=>!h.has(x)).length<=1){ h.clear(); }
    else if(h.has(k)) h.delete(k); else h.add(k);
    redraw();
  }));
  const all=el.querySelector('.all');
  if(all) all.addEventListener('click',()=>{ h.clear(); redraw(); });
}
function table(el, cols, rows){
  const card=el.closest('.card');
  const tit=card? (card.querySelector('h3')?.textContent||'').trim() : '';
  // Celula que chega como numero cru sai com ponto decimal. Formatar caso a caso
  // garante esquecer uma tabela, entao a conversao mora aqui, no unico lugar por
  // onde toda tabela passa. Tabela nova ja nasce em portugues.
  const cel = v => typeof v==='number' && isFinite(v) ? fmtNum(v,2) : v;
  el.innerHTML = `<table><caption class="vh">${tit}</caption><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${cel(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; }
document.querySelectorAll('.tbtn').forEach(b=>b.addEventListener('click',()=>{const c=b.closest('.card');const on=!c.classList.contains('table-mode');c.classList.toggle('table-mode',on);b.setAttribute('aria-pressed',String(on));b.textContent=on?'Gráfico':'Tabela';}));

function frame(plot, h, m){
  plot.innerHTML='';
  const w=Math.max(320, plot.clientWidth);
  // O grafico e imagem para leitor de tela, e a alternativa textual e a tabela
  // que todo card ja tem. Sem role/aria-label o SVG e lido como um monte de
  // caminhos sem significado.
  const card=plot.closest('.card');
  const tit=card? (card.querySelector('h3')?.textContent||'').trim() : '';
  const sub=card? (card.querySelector('.card-h p')?.textContent||'').trim() : '';
  const svg=d3.select(plot).append('svg')
    .attr('viewBox',`0 0 ${w} ${h}`).attr('width',w).attr('height',h)
    .attr('role','img')
    .attr('aria-label', (tit+(sub?'. '+sub:'')+'. Use o botão Tabela para ver os números.').slice(0,300));
  return {svg,w,h,m};
}
function xScale(f, ii){ return d3.scaleTime().domain([ST.W[ii[0]], ST.W[ii[ii.length-1]]]).range([f.m.l, f.w-f.m.r]); }
function axes(f, x, y, yfmt, ticksY=4){
  const g=f.svg.append('g').attr('class','grid');
  g.selectAll('line').data(y.ticks(ticksY)).join('line').attr('x1',f.m.l).attr('x2',f.w-f.m.r).attr('y1',d=>y(d)).attr('y2',d=>y(d));
  f.svg.append('g').selectAll('text').data(y.ticks(ticksY)).join('text').attr('x',f.m.l-8).attr('y',d=>y(d)+4).attr('text-anchor','end').text(yfmt);
  // Densidade de marcas no eixo x pela LARGURA disponivel, nao so pelo intervalo:
  // em 390px os rotulos mensais colidiam e viravam "novjan 26mar".
  const span=(x.domain()[1]-x.domain()[0])/864e5/7;          // semanas
  const larg=(f.w-f.m.l-f.m.r);
  const cabem=Math.max(3, Math.floor(larg/58));               // ~58px por rotulo
  const meses=Math.max(1, Math.ceil((span/4.35)/cabem));      // de quantos em quantos meses
  // d3.timeMonth.every(n) filtra por mes DO ANO (mes % n), entao na virada de
  // dezembro para janeiro dois rotulos caem colados ("nov" e "jan 26").
  // Contamos a partir do inicio do dominio, que garante espacamento uniforme.
  const todos=d3.timeMonth.range(...x.domain());
  const ticks=todos.filter((_,i)=>i%meses===0);
  const rotulos=monthTicks(ticks);
  f.svg.append('g').selectAll('text').data(ticks).join('text').attr('x',d=>x(d)).attr('y',f.h-f.m.b+18).attr('text-anchor','middle').text((d,i)=>rotulos[i]);
  f.svg.append('line').attr('class','axis').attr('x1',f.m.l).attr('x2',f.w-f.m.r).attr('y1',y(0)).attr('y2',y(0)).attr('stroke',css('--axis'));
}
function crosshair(f, x, ii, onMove){
  const plot=f.svg.node().parentNode; const t=tip(plot);
  const line=f.svg.append('line').attr('y1',f.m.t).attr('y2',f.h-f.m.b).attr('stroke',css('--ink-3')).attr('stroke-width',1).style('display','none');
  const dot=f.svg.append('g').style('display','none');
  f.svg.append('rect').attr('x',f.m.l).attr('y',f.m.t).attr('width',f.w-f.m.l-f.m.r).attr('height',f.h-f.m.t-f.m.b).attr('fill','transparent')
   .on('mousemove',ev=>{ const [mx,my]=d3.pointer(ev); const d0=x.invert(mx); let best=ii[0]; for(const i of ii){ if(Math.abs(ST.W[i]-d0)<Math.abs(ST.W[best]-d0)) best=i; }
      line.style('display',null).attr('x1',x(ST.W[best])).attr('x2',x(ST.W[best])); dot.style('display',null);
      const r=plot.getBoundingClientRect(); const sx=r.width/f.w; showTip(t,plot,x(ST.W[best])*sx,my*sx,onMove(best,dot,x(ST.W[best]))); })
   .on('mouseleave',()=>{line.style('display','none');dot.style('display','none');t.style.display='none';});
}
const tipRow=(c,k,v)=>`<div class="r"><span><i style="background:${c}"></i>${k}</span><b>${v}</b></div>`;

// ---- generic stacked share area
function stackedShare(name, series, slots, labels, opts={}){
  const c=card(name), plot=c.querySelector('.plot'), ii=idx();
  const todas=Object.keys(series);
  if(!todas.length) return vazio(name,'Nenhuma categoria no recorte atual.');
  const keys=visiveis(name, todas);
  const f=frame(plot, 300, {t:12,r:16,b:30,l:44});
  const x=xScale(f,ii), y=d3.scaleLinear().domain([0,100]).range([f.h-f.m.b,f.m.t]);
  const data=ii.map(i=>{const o={i}; keys.forEach(k=>o[k]=series[k][i]); return o;});
  const st=d3.stack().keys(keys)(data);
  axes(f,x,y,v=>v+'%');
  const area=d3.area().x(d=>x(ST.W[d.data.i])).y0(d=>y(d[0])).y1(d=>y(d[1])).curve(d3.curveMonotoneX);
  f.svg.append('g').selectAll('path').data(st).join('path').attr('d',area).attr('fill',d=>col(slots[d.key])).attr('stroke',css('--surface')).attr('stroke-width',1.5).attr('opacity',.92);
  // direct labels at right for segments > 6%
  const last=ii[ii.length-1];
  st.forEach(s=>{const seg=s[s.length-1]; if(seg[1]-seg[0]>7){ f.svg.append('text').attr('class','dl').attr('x',x(ST.W[last])-6).attr('y',y((seg[0]+seg[1])/2)+4).attr('text-anchor','end').attr('fill','#fff').style('fill','#fff').text((labels[s.key]||s.key)+' '+Math.round(series[s.key][last])+'%'); }});
  legend(c.querySelector('.legend'), todas.slice().sort((a,b)=>series[b][last]-series[a][last]).map(k=>[k,col(slots[k]),(labels[k]||k)+' '+fmtP(series[k][last])]), name, ()=>stackedShare(name,series,slots,labels,opts));
  crosshair(f,x,ii,(i)=>`<div class="t">${ST.GRAN==="mes"?"mês de":"semana de"} ${fPer(ST.W[i])}${ST.GRAN==="mes"?` · ${ST.SEMANAS_POR_BUCKET[i]} semanas`:""}</div>`+keys.slice().sort((a,b)=>series[b][i]-series[a][i]).filter(k=>series[k][i]>0.05).map(k=>tipRow(col(slots[k]),labels[k]||k,fmtP(series[k][i]))).join(''));
  table(c.querySelector('.tbl'),[rotPer(),...keys.map(k=>labels[k]||k)], ii.map(i=>[fPer(ST.W[i]),...keys.map(k=>fmtP(series[k][i]))]));
}

// ---- single line/area
function lineChart(name, vals, {fmt=fmtP, color='--s1', area=true, label, ymax, integer=false, h=240, extra=null, colsTab=null}={}){
  if(!vals || !vals.length) return vazio(name,'Sem dado no recorte atual.');
  const c=card(name), plot=c.querySelector('.plot'), ii=idx().filter(i=>vals[i]!=null);
  // Sem nenhum ponto valido, as escalas produzem NaN e o SVG sai quebrado em
  // silencio. Estado vazio explicito e a unica resposta honesta.
  if(!ii.length) return vazio(name,'Sem pontos nesta janela: a série só começa depois do período selecionado.');
  const f=frame(plot, h, {t:14,r:16,b:30,l:44});
  const x=xScale(f,ii), y=d3.scaleLinear().domain([0, ymax||d3.max(ii,i=>vals[i])*1.1]).nice().range([f.h-f.m.b,f.m.t]);
  axes(f,x,y,v=>integer?v:fmt(v),4);
  const cl=col(color);
  if(area) f.svg.append('path').datum(ii).attr('d',d3.area().x(i=>x(ST.W[i])).y0(y(0)).y1(i=>y(vals[i])).curve(d3.curveMonotoneX)).attr('fill',cl).attr('opacity',.12);
  f.svg.append('path').datum(ii).attr('d',d3.line().x(i=>x(ST.W[i])).y(i=>y(vals[i])).curve(d3.curveMonotoneX)).attr('fill','none').attr('stroke',cl).attr('stroke-width',2);
  const last=ii[ii.length-1], first=ii[0];
  f.svg.append('circle').attr('cx',x(ST.W[last])).attr('cy',y(vals[last])).attr('r',4).attr('fill',cl).attr('stroke',css('--surface')).attr('stroke-width',2);
  f.svg.append('text').attr('class','dl').attr('x',x(ST.W[last])-8).attr('y',y(vals[last])-9).attr('text-anchor','end').text((integer?vals[last]:fmt(vals[last])));
  f.svg.append('text').attr('class','dl').attr('x',x(ST.W[first])+6).attr('y',y(vals[first])-9).text((integer?vals[first]:fmt(vals[first])));
  crosshair(f,x,ii,(i,dot)=>{dot.selectAll('*').remove(); dot.append('circle').attr('cx',x(ST.W[i])).attr('cy',y(vals[i])).attr('r',4).attr('fill',cl).attr('stroke',css('--surface')).attr('stroke-width',2); return `<div class="t">${ST.GRAN==="mes"?"mês de":"semana de"} ${fPer(ST.W[i])}${ST.GRAN==="mes"?` · ${ST.SEMANAS_POR_BUCKET[i]} semanas`:""}</div>`+tipRow(cl,label||'',integer?vals[i]:fmt(vals[i]))+(extra?extra(i):'');});
  table(c.querySelector('.tbl'), colsTab? colsTab.cols : [rotPer(),label],
    colsTab? ii.map(colsTab.linha) : ii.map(i=>[fPer(ST.W[i]),integer?vals[i]:fmt(vals[i])]));
}

// ---- multi-line with emphasis
function emphasisLines(name, series, focus, slots, labels){
  const c=card(name), plot=c.querySelector('.plot'), ii=idx();
  const outras=Object.keys(series).filter(k=>k!==focus);
  if(!series[focus] && !outras.length)
    return vazio(name,'Nenhum laboratório no recorte atual.');
  if(!series[focus])
    series={...series, [focus]:new Array(ST.N).fill(0)};
  const last0=ii[ii.length-1];
  // O foco nao ocupa slot de cor: ele veste TINTA, que e enfase, nao identidade.
  // Sobram 4 slots para os 4 maiores concorrentes da ultima semana; o restante
  // e somado em Outros, em neutro, para nao inventar uma quinta cor.
  const conc=Object.keys(series).filter(k=>k!==focus)
    .sort((a,b)=>series[b][last0]-series[a][last0]);
  const nomeados=conc.slice(0,4), resto=conc.slice(4);
  const S={}; S[focus]=series[focus].slice();
  nomeados.forEach(k=>S[k]=series[k].slice());
  if(resto.length){ const n=series[focus].length; const o=new Array(n).fill(0);
    resto.forEach(k=>series[k].forEach((v,x)=>o[x]+=(v||0)));
    S['Outros']=o.map(v=>Math.round(v*100)/100); }
  const SL={}; SL[focus]='ink'; nomeados.forEach((k,x)=>SL[k]='--s'+(x+1)); SL['Outros']='--s0';
  const cor=k=>SL[k]==='ink'?css('--ink'):col(SL[k]);
  const LB=k=>k==='Outros'?('Outros ('+resto.length+' labs)'):(labels[k]||k);

  const todas=Object.keys(S);
  const keys=visiveis(name, todas);
  const f=frame(plot, 320, {t:14,r:104,b:30,l:44});
  const x=xScale(f,ii), y=d3.scaleLinear().domain([0,d3.max(keys,k=>d3.max(ii,i=>S[k][i]))*1.08]).nice().range([f.h-f.m.b,f.m.t]);
  axes(f,x,y,v=>v+'%');
  const line=k=>d3.line().x(i=>x(ST.W[i])).y(i=>y(S[k][i])).curve(d3.curveMonotoneX);
  keys.filter(k=>k!==focus).forEach(k=>f.svg.append('path').datum(ii).attr('d',line(k))
    .attr('fill','none').attr('stroke',cor(k)).attr('stroke-width',1.5).attr('opacity',.75));
  f.svg.append('path').datum(ii).attr('d',line(focus)).attr('fill','none')
    .attr('stroke',cor(focus)).attr('stroke-width',3);

  // rotulo direto em todas as series: sao 6, e cabem sem colidir
  const last=ii[ii.length-1];
  let lab=keys.map(k=>({k,y:y(S[k][last]),v:S[k][last]})).sort((a,b)=>a.y-b.y);
  for(let i=1;i<lab.length;i++){ if(lab[i].y-lab[i-1].y<14) lab[i].y=lab[i-1].y+14; }
  const maxY=f.h-f.m.b-2; if(lab.length&&lab[lab.length-1].y>maxY){ lab[lab.length-1].y=maxY;
    for(let i=lab.length-2;i>=0;i--){ if(lab[i+1].y-lab[i].y<14) lab[i].y=lab[i+1].y-14; } }
  lab.forEach(l=>f.svg.append('text').attr('class','dl').attr('x',x(ST.W[last])+8).attr('y',l.y+4)
    .style('fill',l.k===focus?css('--ink'):css('--ink-3'))
    .style('font-weight',l.k===focus?700:500)
    .text(`${LB(l.k)} ${Math.round(l.v)}%`));

  legend(c.querySelector('.legend'), todas.map(k=>[k,cor(k),LB(k)+' '+fmtP(S[k][last])]), name, ()=>emphasisLines(name,series,focus,slots,labels));
  crosshair(f,x,ii,(i)=>`<div class="t">${ST.GRAN==="mes"?"mês de":"semana de"} ${fPer(ST.W[i])}${ST.GRAN==="mes"?` · ${ST.SEMANAS_POR_BUCKET[i]} semanas`:""}</div>`+keys.slice().sort((a,b)=>S[b][i]-S[a][i]).map(k=>tipRow(cor(k),LB(k),fmtP(S[k][i]))).join(''));
  table(c.querySelector('.tbl'),[rotPer(),...Object.keys(series).map(k=>labels[k]||k)],
    ii.map(i=>[fPer(ST.W[i]),...Object.keys(series).map(k=>fmtP(series[k][i]))]));
}

// ---- stacked absolute area (Anthropic families)
function stackedAbs(name, series, slots){
  const c=card(name), plot=c.querySelector('.plot'), ii=idx();
  const todas=Object.keys(slots).filter(k=>series[k]);
  if(!todas.length) return vazio(name,'Sem volume no recorte atual.');
  const keys=visiveis(name, todas);
  const f=frame(plot, 280, {t:12,r:16,b:30,l:44});
  const data=ii.map(i=>{const o={i}; keys.forEach(k=>o[k]=series[k][i]); return o;});
  const st=d3.stack().keys(keys)(data);
  const x=xScale(f,ii), y=d3.scaleLinear().domain([0,d3.max(st[st.length-1],d=>d[1])*1.08]).nice().range([f.h-f.m.b,f.m.t]);
  axes(f,x,y,fmtT);
  f.svg.append('g').selectAll('path').data(st).join('path').attr('d',d3.area().x(d=>x(ST.W[d.data.i])).y0(d=>y(d[0])).y1(d=>y(d[1])).curve(d3.curveMonotoneX)).attr('fill',d=>col(slots[d.key])).attr('stroke',css('--surface')).attr('stroke-width',1.5).attr('opacity',.92);
  legend(c.querySelector('.legend'), todas.map(k=>[k,col(slots[k]),k]), name, ()=>stackedAbs(name,series,slots));
  crosshair(f,x,ii,(i)=>`<div class="t">${ST.GRAN==="mes"?"mês de":"semana de"} ${fPer(ST.W[i])}${ST.GRAN==="mes"?` · ${ST.SEMANAS_POR_BUCKET[i]} semanas`:""}</div>`+keys.slice().reverse().map(k=>tipRow(col(slots[k]),k,fmtT(series[k][i]))).join('')+tipRow('transparent','Total',fmtT(keys.reduce((s,k)=>s+series[k][i],0))));
  table(c.querySelector('.tbl'),[rotPer(),...keys,'Total'], ii.map(i=>[fD(ST.W[i]),...keys.map(k=>fmtT(series[k][i])),fmtT(keys.reduce((s,k)=>s+series[k][i],0))]));
}

// ---- horizontal bars (Anthropic tenure)
// Ordem padrao por valor, que e o que a barra comunica. A ordem de lancamento
// conta outra historia (a cadencia encurtando) e continua disponivel no toggle.
ST.HBAR_ORDEM='valor';
function hbars(name, rows, {color='--s3'}={}){
  const c=card(name), plot=c.querySelector('.plot');
  rows = rows.slice().sort(ST.HBAR_ORDEM==='valor'
    ? (a,b)=>b.v-a.v || (a.first<b.first?-1:1)
    : (a,b)=>(a.first<b.first?-1:a.first>b.first?1:0) || b.v-a.v);
  const rh=22, f=frame(plot, rows.length*rh+40, {t:8,r:40,b:26,l:150});
  const x=d3.scaleLinear().domain([0,d3.max(rows,r=>r.v)*1.05]).nice().range([f.m.l,f.w-f.m.r]);
  const y=d3.scaleBand().domain(rows.map(r=>r.k)).range([f.m.t,f.h-f.m.b]).paddingInner(.28);
  f.svg.append('g').attr('class','grid').selectAll('line').data(x.ticks(5)).join('line').attr('y1',f.m.t).attr('y2',f.h-f.m.b).attr('x1',d=>x(d)).attr('x2',d=>x(d));
  f.svg.append('g').selectAll('text').data(x.ticks(5)).join('text').attr('x',d=>x(d)).attr('y',f.h-f.m.b+16).attr('text-anchor','middle').text(d=>fmtNum(d,2));
  f.svg.append('g').selectAll('text').data(rows).join('text').attr('x',f.m.l-10).attr('y',r=>y(r.k)+y.bandwidth()/2+4).attr('text-anchor','end').style('fill',css('--ink-2')).text(r=>r.k);
  const cl=col(color);
  f.svg.append('g').selectAll('rect').data(rows).join('rect').attr('x',x(0)).attr('y',r=>y(r.k)).attr('width',r=>Math.max(0,x(r.v)-x(0))).attr('height',y.bandwidth()).attr('fill',cl).attr('rx',3);
  f.svg.append('g').selectAll('text').data(rows).join('text').attr('class','dl').attr('x',r=>x(r.v)+6).attr('y',r=>y(r.k)+y.bandwidth()/2+4).text(r=>fmtNum(r.v,2)+(r.alive?' ●':''));
  const t=tip(plot);
  f.svg.append('g').selectAll('rect.hit').data(rows).join('rect').attr('class','hit').attr('x',f.m.l).attr('y',r=>y(r.k)-3).attr('width',f.w-f.m.l-f.m.r).attr('height',y.bandwidth()+6).attr('fill','transparent')
   .on('mousemove',(ev,r)=>{const [mx,my]=d3.pointer(ev); const sx=plot.getBoundingClientRect().width/f.w; showTip(t,plot,mx*sx,my*sx,`<div class="t">${r.k}</div>${tipRow(cl,'Semanas no top 10',r.v)}${tipRow('transparent','Lançado',r.first)}${tipRow('transparent','Pico de share',fmtP(r.peak))}${r.alive?tipRow('transparent','Status','ainda em alta'):''}`);})
   .on('mouseleave',()=>t.style.display='none');
  table(c.querySelector('.tbl'),['Modelo','Semanas top 10','Lançado','Pico share'], rows.map(r=>[r.k,r.v,r.first,fmtP(r.peak)]));
}

// ---- grouped bars (cohort)
function cohortBars(name, rows){
  const c=card(name), plot=c.querySelector('.plot');
  const f=frame(plot, 260, {t:16,r:16,b:40,l:40});
  const keys=[['ttp','Semanas até o pico','--s1'],['half','Meia-vida após o pico','--s2']];
  const x0=d3.scaleBand().domain(rows.map(r=>r.q)).range([f.m.l,f.w-f.m.r]).paddingInner(.3), x1=d3.scaleBand().domain(keys.map(k=>k[0])).range([0,x0.bandwidth()]).paddingInner(.12);
  const y=d3.scaleLinear().domain([0,d3.max(rows,r=>Math.max(r.ttp,r.half))*1.15]).nice().range([f.h-f.m.b,f.m.t]);
  f.svg.append('g').attr('class','grid').selectAll('line').data(y.ticks(4)).join('line').attr('x1',f.m.l).attr('x2',f.w-f.m.r).attr('y1',d=>y(d)).attr('y2',d=>y(d));
  f.svg.append('g').selectAll('text').data(y.ticks(4)).join('text').attr('x',f.m.l-8).attr('y',d=>y(d)+4).attr('text-anchor','end').text(d=>fmtNum(d,2));
  f.svg.append('g').selectAll('text').data(rows).join('text').attr('x',r=>x0(r.q)+x0.bandwidth()/2).attr('y',f.h-f.m.b+16).attr('text-anchor','middle').text(r=>r.q.replace('2025','25 ').replace('2026','26 '));
  f.svg.append('g').selectAll('text.n').data(rows).join('text').attr('class','n').attr('x',r=>x0(r.q)+x0.bandwidth()/2).attr('y',f.h-f.m.b+30).attr('text-anchor','middle').style('fill',css('--ink-3')).text(r=>'n='+r.n);
  const g=f.svg.append('g').selectAll('g').data(rows).join('g').attr('transform',r=>`translate(${x0(r.q)},0)`);
  g.selectAll('rect').data(r=>keys.map(k=>({k:k[0],c:k[2],v:r[k[0]],q:r.q}))).join('rect').attr('x',d=>x1(d.k)).attr('y',d=>y(d.v)).attr('width',x1.bandwidth()).attr('height',d=>y(0)-y(d.v)).attr('fill',d=>col(d.c)).attr('rx',3);
  g.selectAll('text').data(r=>keys.map(k=>({k:k[0],v:r[k[0]]}))).join('text').attr('class','dl').attr('x',d=>x1(d.k)+x1.bandwidth()/2).attr('y',d=>y(d.v)-5).attr('text-anchor','middle').text(d=>fmtNum(d.v,2));
  f.svg.append('line').attr('x1',f.m.l).attr('x2',f.w-f.m.r).attr('y1',y(0)).attr('y2',y(0)).attr('stroke',css('--axis'));
  legend(c.querySelector('.legend'), keys.map(k=>[k[0],col(k[2]),k[1]]));
  table(c.querySelector('.tbl'),['Trimestre','n','Semanas até pico (mediana)','Meia-vida (mediana)','% ainda em alta'], rows.map(r=>[r.q,r.n,fmtNum(r.ttp),fmtNum(r.half),Math.round(r.alive*100)+'%']));
}

// ---- lifecycle spaghetti (share over time per model)
// ===========================================================================
// Motor de filtros.
//
// A pagina deixa de consumir series pre-agregadas e passa a recalcular tudo a
// partir da matriz modelo x semana. Isso e o que permite perguntar "so modelos
// pagos, de pesos abertos, acima de 128k de contexto" e ver TODOS os graficos
// responderem ao mesmo recorte.
//
// A linha "other" da fonte (volume fora do top 50 diario) nao tem metadado, entao
// ela sai de qualquer recorte filtrado. A pagina avisa quanto do volume ficou de
// fora em vez de fingir que o total continua completo.
// ===========================================================================
const MX=D.matriz; ST.NW=MX.semanas.length;
const DIMI={}; MX.dims.forEach((d,i)=>DIMI[d]=i);
const FILTROS={};                       // {dim: Set(indice do valor)}

// Rotulos e ordem de exibicao dos grupos de filtro. Dimensoes com dezenas de
// valores (vendor) ficam de fora: quem quer isolar um lab usa a legenda.
const GRUPOS=[
  ['cobranca','Cobrança'],
  ['pesos','Licença dos pesos'],
  ['origin','País-sede do lab'],
  ['faixa_preco','Faixa de preço (por 1M tokens)'],
  ['faixa_ctx','Janela de contexto'],
  ['multimodal','Modalidade'],
  ['raciocinio','Raciocínio'],
];
const ORDEM={
  faixa_preco:['Gratuito','Até $0,20','$0,20 a $1','$1 a $5','Acima de $5','Não identificado'],
  faixa_ctx:['Até 32k','33k a 128k','129k a 400k','Acima de 400k','Não identificado'],
  cobranca:['Pago','Endpoint gratuito','Modelo gratuito','Não identificado'],
};

function serie(i){ const a=MX.t0[i], v=MX.v[i], s=new Array(ST.NW).fill(0);
  for(let j=0;j<v.length;j++) s[a+j]=v[j]; return s; }
const SERIES_SEM=MX.modelos.map((_,i)=>serie(i));   // sempre semanal, fonte
ST.SERIES=SERIES_SEM;                              // visao na granularidade atual
// Indicadores de ciclo de vida sao medias, nao somas: guardamos o original
// semanal para nunca colapsar duas vezes ao trocar de granularidade.
const CHURN_SEM=(D.churn||[]).slice();
// As 12 primeiras semanas da serie sao censuradas na idade mediana: nao sabemos
// quando os modelos ja presentes em janeiro de 2025 estrearam de fato. Isso e
// propriedade do DADO, nao do desenho. Enquanto morava no render, com indice
// absoluto (`i<12`), uma janela de 4 semanas apagava a serie inteira e o grafico
// virava NaN. Aplicada aqui, ela sobrevive a qualquer recorte.
const AGE_SEM=(D.age||[]).map((v,i)=>i<12?null:v);

function filtrando(){ return Object.values(FILTROS).some(s=>s && s.size); }
function passa(mod){
  if(!filtrando()) return true;
  if(!mod.m) return false;                       // sem metadado sai de recorte
  for(const d in FILTROS){ const s=FILTROS[d];
    if(s && s.size && !s.has(mod.d[DIMI[d]])) return false; }
  return true;
}
function selecionados(){ return MX.modelos.map((m,i)=>[m,i]).filter(([m])=>passa(m)); }

// Agrega a matriz por uma chave qualquer. peso: 'tok' ou 'usd'.
function agregar(chaveFn, peso='tok'){
  const out={}, tot=new Array(ST.NW).fill(0);
  for(const [m,i] of selecionados()){
    const k=chaveFn(m); if(k==null) continue;
    const s=ST.SERIES[i];
    const fator = peso==='usd'
      ? ((m.p && MX.dic.cobranca[m.d[DIMI.cobranca]]!=='Endpoint gratuito') ? m.p : 0)
      : 1;
    if(peso==='usd' && !fator) continue;
    if(!out[k]) out[k]=new Array(ST.NW).fill(0);
    for(let w=0;w<ST.NW;w++){ const v=s[w]*fator; out[k][w]+=v; tot[w]+=v; }
  }
  return {porChave:out, total:tot};
}
function paraShare(a){ const o={};
  for(const k in a.porChave) o[k]=a.porChave[k].map((v,w)=>a.total[w]? +(100*v/a.total[w]).toFixed(2):0);
  return o; }
const rotulo=(dim,i)=>MX.dic[dim][i];

// Recalcula todas as series que os graficos consomem, a partir do recorte atual.
function recalcular(){
  const sel=selecionados();
  const porTok=agregar(m=>'t');
  const tot=porTok.total;                                   // milhoes de tokens
  D.weekly_total_T=tot.map(v=>+(v/1e6).toFixed(3));

  // A linha "other" da fonte agrega o volume fora do top 50 diario. Ela conta no
  // total, mas nao e um laboratorio nem um modelo: entra como "Outros" nos
  // recortes por lab e fica fora do leaderboard.
  const ehOther=m=>m.s==='other';
  const porVendor=agregar(m=>ehOther(m)?'Outros':rotulo('vendor',m.d[DIMI.vendor]));
  const shV=paraShare(porVendor);
  const ult=ST.NW-1;
  // "Outros" fica fora do ranking: ele e o resto por definicao, e incluir no
  // top 8 fazia a fatia ser contada duas vezes (o teste pegou 10,7pp faltando).
  const rank=Object.keys(shV).filter(k=>k!=='Outros').sort((a,b)=>shV[b][ult]-shV[a][ult]);
  const top8=rank.slice(0,8);
  D.vendor_share={}; top8.forEach(k=>D.vendor_share[k]=shV[k]);
  D.vendor_share['Outros']=tot.map((_,w)=>+Math.max(0,100-top8.reduce((s,k)=>s+shV[k][w],0)).toFixed(2));

  D.origin_share=paraShare(agregar(m=>rotulo('origin',m.d[DIMI.origin])));
  D.weights_share=paraShare(agregar(m=>rotulo('pesos',m.d[DIMI.pesos])));
  const cob=paraShare(agregar(m=>rotulo('cobranca',m.d[DIMI.cobranca])));
  D.free_share=(cob['Endpoint gratuito']||new Array(ST.NW).fill(0));
  D.cobranca_share=cob;

  // concentracao e HHI recalculados sobre os modelos do recorte
  // Concentracao. A linha "other" nao e um modelo, entao sai do ranking, mas
  // CONTINUA no denominador do top 5: a pergunta e "quanto do mercado os 5
  // maiores modelos capturam", nao "quanto dos modelos nomeados". O HHI, por
  // depender de participacoes bem definidas, normaliza so sobre os nomeados.
  const semOther=sel.filter(([m])=>!ehOther(m));
  D.top5=[]; D.hhi=[];
  for(let w=0;w<ST.NW;w++){
    const vs=semOther.map(([,i])=>ST.SERIES[i][w]).filter(v=>v>0).sort((a,b)=>b-a);
    const sNom=vs.reduce((a,b)=>a+b,0);
    const sTot=tot[w];
    D.top5.push(sTot? +(100*vs.slice(0,5).reduce((a,b)=>a+b,0)/sTot).toFixed(2):0);
    D.hhi.push(sNom? Math.round(vs.reduce((a,v)=>a+Math.pow(100*v/sNom,2),0)):0);
  }

  // Composicao do top 5 em cada periodo: sem isso o grafico de concentracao
  // mostra um numero sem dizer de quem ele e.
  D.top5_modelos=[];
  for(let w=0;w<ST.NW;w++){
    const linhas=semOther.map(([m,i])=>({s:m.s, v:ST.SERIES[i][w]})).filter(r=>r.v>0)
      .sort((a,b)=>b.v-a.v).slice(0,5);
    const den=tot[w]||1;
    D.top5_modelos.push(linhas.map(r=>({s:r.s, share:+(100*r.v/den).toFixed(2)})));
  }

  // Anthropic e concorrentes
  D.an_share=shV['anthropic']||new Array(ST.NW).fill(0);
  const comp={}; ['anthropic',...rank.filter(k=>k!=='anthropic').slice(0,8)]
    .forEach(k=>{ if(shV[k]) comp[k]=shV[k]; });
  D.comp_share=comp;

  // leaderboard da ultima semana
  const linhas=sel.filter(([m])=>!ehOther(m)).map(([m,i])=>({model:m.s, T:ST.SERIES[i][ult]/1e6,
      vendor:rotulo('vendor',m.d[DIMI.vendor]), origin:rotulo('origin',m.d[DIMI.origin]),
      weights:rotulo('pesos',m.d[DIMI.pesos])}))
    .filter(r=>r.T>0).sort((a,b)=>b.T-a.T);
  const somaT=linhas.reduce((s,r)=>s+r.T,0)||1;
  linhas.forEach(r=>{ r.share=+(100*r.T/somaT).toFixed(2); r.T=+r.T.toFixed(2); });
  D.boards=D.boards||{}; D.boards.last=linhas.slice(0,15);

  // Coluna "Há 12 sem" tem que usar o MESMO recorte, senao compara a posicao
  // dentro do filtro com a posicao no mercado inteiro, e o numero mente.
  // A janela pode ser mais curta que a distancia pedida. Em vez de silenciosamente
  // comparar com o inicio da janela e continuar dizendo "12 semanas", guardamos a
  // distancia REAL e o rotulo sai dela.
  const doze=Math.max(0, ult-(ST.GRAN==='semana'?12:3));
  D.dist_prev = ult-doze;
  D.boards.prev12=sel.filter(([m])=>!ehOther(m))
    .map(([m,i])=>({model:m.s, T:ST.SERIES[i][doze]}))
    .filter(r=>r.T>0).sort((a,b)=>b.T-a.T).slice(0,15);
  const anoAtras=Math.max(0, ult-(ST.GRAN==='semana'?52:12));
  D.boards.yearago=sel.filter(([m])=>!ehOther(m))
    .map(([m,i])=>({model:m.s, T:ST.SERIES[i][anoAtras]}))
    .filter(r=>r.T>0).sort((a,b)=>b.T-a.T).slice(0,15);

  // volume absoluto por lab, em trilhoes
  D.vendor_abs={}; for(const k in porVendor.porChave)
    D.vendor_abs[k]=porVendor.porChave[k].map(v=>+(v/1e6).toFixed(3));

  // familias e modelos da Anthropic, derivados do slug em vez de pre-agregados
  const FAM=['Haiku','Sonnet','Opus','Fable'];
  const fam={}; FAM.forEach(f=>fam[f]=new Array(ST.NW).fill(0));
  const anModelos={};
  for(const [m,i] of sel){
    if(m.d[DIMI.vendor]!==MX.dic.vendor.indexOf('anthropic')) continue;
    const s=ST.SERIES[i], nome=m.s.toLowerCase();
    const f=FAM.find(x=>nome.includes(x.toLowerCase()));
    if(f) for(let w=0;w<ST.NW;w++) fam[f][w]+=s[w]/1e6;
    anModelos[m.s]=s.map(v=>+(v/1e6).toFixed(3));
  }
  D.an_fam_abs={}; FAM.forEach(f=>{ if(d3.max(fam[f])>0) D.an_fam_abs[f]=fam[f].map(v=>+v.toFixed(3)); });
  D.an_models=anModelos;

  // ---- dinheiro estimado -------------------------------------------------
  // tokens (milhoes) x preco (USD por 1M) = USD. Endpoint gratuito custa zero.
  // A fonte soma prompt e completion sem separar, e os precos diferem, entao
  // isto e ESTIMATIVA: publicamos piso (tudo prompt), teto (tudo completion) e
  // a mistura declarada em D.blend. Todo grafico de dinheiro mostra a banda.
  const iFree=MX.dic.cobranca.indexOf('Endpoint gratuito');
  const bl=D.blend||{prompt:.75,completion:.25};
  const precoDe=m=>{
    if(!m.p || m.d[DIMI.cobranca]===iFree) return null;
    return {mix:m.p, piso:m.pp!=null?m.pp:m.p, teto:m.pc!=null?m.pc:m.p};
  };
  const gastoLab={}, gastoTot=new Array(ST.NW).fill(0);
  const piso=new Array(ST.NW).fill(0), teto=new Array(ST.NW).fill(0);
  for(const [m,i] of sel){
    if(ehOther(m)) continue;
    const pr=precoDe(m); if(!pr) continue;
    const k=rotulo('vendor',m.d[DIMI.vendor]), s=ST.SERIES[i];
    if(!gastoLab[k]) gastoLab[k]=new Array(ST.NW).fill(0);
    for(let w=0;w<ST.NW;w++){
      const u=s[w]*pr.mix; gastoLab[k][w]+=u; gastoTot[w]+=u;
      piso[w]+=s[w]*pr.piso; teto[w]+=s[w]*pr.teto;
    }
  }
  D.spend_total_musd=gastoTot.map(v=>+(v/1e6).toFixed(2));
  D.spend_band={piso:piso.map(v=>+(v/1e6).toFixed(2)), teto:teto.map(v=>+(v/1e6).toFixed(2))};
  const shG={}; for(const k in gastoLab)
    shG[k]=gastoLab[k].map((v,w)=>gastoTot[w]? +(100*v/gastoTot[w]).toFixed(2):0);
  const rankG=Object.keys(shG).sort((a,b)=>shG[b][ult]-shG[a][ult]).slice(0,8);
  D.spend_share={}; rankG.forEach(k=>D.spend_share[k]=shG[k]);
  D.spend_share['Outros']=gastoTot.map((_,w)=>+Math.max(0,100-rankG.reduce((s,k)=>s+shG[k][w],0)).toFixed(2));

  // preco efetivo do mercado: USD por 1M de tokens realmente consumidos
  D.preco_efetivo=gastoTot.map((g,w)=>tot[w]? +(g/tot[w]).toFixed(3):0);

  // volume x dinheiro, ultima semana
  const vd={};
  for(const [m,i] of sel){
    if(ehOther(m)) continue;
    const k=rotulo('vendor',m.d[DIMI.vendor]);
    vd[k]=vd[k]||{tok:0,usd:0};
    vd[k].tok+=ST.SERIES[i][ult];
    const pr=precoDe(m); if(pr) vd[k].usd+=ST.SERIES[i][ult]*pr.mix;
  }
  const somaTok=Object.values(vd).reduce((s,o)=>s+o.tok,0)||1;
  const somaUsd=Object.values(vd).reduce((s,o)=>s+o.usd,0)||1;
  D.volume_vs_dinheiro=Object.entries(vd).filter(([,o])=>o.tok>0)
    .map(([lab,o])=>({lab, share_tokens:+(100*o.tok/somaTok).toFixed(2),
       share_gasto:+(100*o.usd/somaUsd).toFixed(2),
       razao:o.tok? +((o.usd/somaUsd)/(o.tok/somaTok)).toFixed(2):null}))
    .sort((a,b)=>b.share_tokens-a.share_tokens).slice(0,12);

  // ---- qualidade contra adocao -------------------------------------------
  D.qualidade=sel.filter(([m])=>!ehOther(m))
    .map(([m,i])=>({slug:m.s, nome:m.n, aa:m.q, elo:m.e, preco:m.p, ctx:m.c, lanc:m.l,
        T:+(ST.SERIES[i][ult]/1e6).toFixed(3),
        share:+(100*ST.SERIES[i][ult]/(tot[ult]||1)).toFixed(3),
        origin:rotulo('origin',m.d[DIMI.origin]),
        pesos:rotulo('pesos',m.d[DIMI.pesos])}))
    .filter(r=>r.T>0).sort((a,b)=>b.share-a.share);

  // ---- O mapa da temporada ------------------------------------------------
  // Dois eixos compostos, ambos calculados, nenhum subjetivo. A posicao de cada
  // laboratorio e o percentil dele entre os labs presentes, nao um valor
  // absoluto: e um mapa de posicao relativa, como todo quadrante de mercado.
  //
  // O eixo de capacidade tem dois modos porque a cobertura obriga. O indice de
  // inteligencia so existe para 12 dos 19 labs com volume, e a lider de volume
  // do mercado nao tem nenhum modelo testado. Um mapa que deixa a lider de fora
  // nao e um mapa, e um recorte enviesado a favor de quem ja foi avaliado. Por
  // isso o modo padrao usa atributos com cobertura total.
  const HOJE=new Date(MX.semanas[MX.semanas.length-1]+'T00:00:00');
  function perfilLabs(indice){
    const L={};
    for(const [m,i] of sel){
      if(ehOther(m)) continue;
      const k=rotulo('vendor',m.d[DIMI.vendor]);
      const tk=ST.SERIES[i][indice]||0;
      if(!L[k]) L[k]={lab:k, tokens:0, gasto:0, ctx:0, multi:0, rac:0, ampl:0, cad:0, aa:null,
                      origem:{}, modelos:0};
      const o=L[k]; o.modelos++;
      o.tokens+=tk;
      const pr=precoDe(m); if(pr) o.gasto+=tk*pr.mix;
      if(tk>0){
        o.ampl++;
        o.ctx=Math.max(o.ctx, m.c||0);
        if(rotulo('multimodal',m.d[DIMI.multimodal])==='Multimodal') o.multi++;
        if(rotulo('raciocinio',m.d[DIMI.raciocinio])==='Com raciocínio') o.rac++;
        if(m.q!=null) o.aa=Math.max(o.aa??0, m.q);
        const org=rotulo('origin',m.d[DIMI.origin]);
        o.origem[org]=(o.origem[org]||0)+tk;
        if(m.l){ const dias=(HOJE-new Date(m.l+'T00:00:00'))/864e5; if(dias<=180) o.cad++; }
      }
    }
    return Object.values(L).filter(o=>o.tokens>0).map(o=>({
      ...o,
      multi_p: o.ampl? o.multi/o.ampl : 0,
      rac_p:   o.ampl? o.rac/o.ampl : 0,
      origem:  Object.entries(o.origem).sort((a,b)=>b[1]-a[1])[0][0],
    }));
  }
  // Percentil entre os labs presentes, 0 a 100. Percentil e nao valor bruto
  // porque um unico lab com contexto de 2M distorceria toda a escala.
  function percentis(arr, campo){
    const vals=arr.map(o=>o[campo]??0);
    const ord=[...vals].sort((a,b)=>a-b);
    return vals.map(v=>{
      const menores=ord.filter(x=>x<v).length, iguais=ord.filter(x=>x===v).length;
      return 100*(menores+iguais/2)/ord.length;
    });
  }
  const PESOS_PADRAO={tracao:{share:40,gasto:30,cresc:30},
                      cap:{ctx:25,multi:20,rac:20,ampl:20,cad:15}};
  const PESOS = D._pesosMapa || (D._pesosMapa=JSON.parse(JSON.stringify(PESOS_PADRAO)));
  function comporta(perfil, anterior, modo){
    const somaT=perfil.reduce((s,o)=>s+o.tokens,0)||1;
    const somaG=perfil.reduce((s,o)=>s+o.gasto,0)||1;
    const antMap={}; (anterior||[]).forEach(o=>antMap[o.lab]=o);
    const somaTa=(anterior||[]).reduce((s,o)=>s+o.tokens,0)||1;
    perfil.forEach(o=>{
      o.share=100*o.tokens/somaT;
      o.shareG=100*o.gasto/somaG;
      const a=antMap[o.lab];
      o.cresc=o.share-(a? 100*a.tokens/somaTa : 0);
    });
    const P={}; ['share','shareG','cresc','ctx','multi_p','rac_p','ampl','cad'].forEach(c=>P[c]=percentis(perfil,c));
    const wT=PESOS.tracao, sT=wT.share+wT.gasto+wT.cresc||1;
    const wC=PESOS.cap, sC=wC.ctx+wC.multi+wC.rac+wC.ampl+wC.cad||1;
    perfil.forEach((o,i)=>{
      o.pct={share:P.share[i], gasto:P.shareG[i], cresc:P.cresc[i],
             ctx:P.ctx[i], multi:P.multi_p[i], rac:P.rac_p[i], ampl:P.ampl[i], cad:P.cad[i]};
      o.y=(wT.share*P.share[i]+wT.gasto*P.shareG[i]+wT.cresc*P.cresc[i])/sT;
      o.xRec=(wC.ctx*P.ctx[i]+wC.multi*P.multi_p[i]+wC.rac*P.rac_p[i]+wC.ampl*P.ampl[i]+wC.cad*P.cad[i])/sC;
    });
    const comAA=perfil.filter(o=>o.aa!=null);
    const pAA=percentis(comAA,'aa');
    comAA.forEach((o,i)=>o.xAA=pAA[i]);
    perfil.forEach(o=>{ o.x = modo==='indice' ? o.xAA : o.xRec; });
    return perfil;
  }
  const atras=Math.max(0, ult-(ST.GRAN==='semana'?12:3));
  const distMapa=ult-atras;
  const perfilAgora=comporta(perfilLabs(ult), perfilLabs(atras), 'recursos');
  const antesRaw=comporta(perfilLabs(atras), null, 'recursos');
  const antesMap={}; antesRaw.forEach(o=>antesMap[o.lab]={x:o.xRec, xAA:o.xAA, y:o.y});
  D.mapa={ labs:perfilAgora, antes:antesMap, pesos:PESOS, pesos_padrao:PESOS_PADRAO,
           periodos_atras:distMapa,
           com_indice:perfilAgora.filter(o=>o.aa!=null).length, total:perfilAgora.length };

  // ---- o que mudou nas ultimas 4 semanas ---------------------------------
  // "ultimas 4 semanas" tem que significar o mesmo periodo nas duas
  // granularidades: 4 pontos semanais ou 1 ponto mensal.
  const passo4 = ST.GRAN==='semana' ? 4 : 1;
  const ant=Math.max(0, ult-passo4);
  const distMud=ult-ant;
  const topN=(w,n)=>sel.filter(([m])=>!ehOther(m))
    .map(([m,i])=>({s:m.s, v:ST.SERIES[i][w]})).filter(r=>r.v>0)
    .sort((a,b)=>b.v-a.v).slice(0,n).map(r=>r.s);
  const t10a=topN(ant,10), t10b=topN(ult,10);
  const totAnt=sel.reduce((s,[,i])=>s+ST.SERIES[i][ant],0)||1;
  const varia=sel.filter(([m])=>!ehOther(m)).map(([m,i])=>{
      const a=100*ST.SERIES[i][ant]/totAnt, b=100*ST.SERIES[i][ult]/(tot[ult]||1);
      return {s:m.s, de:+a.toFixed(2), para:+b.toFixed(2), delta:+(b-a).toFixed(2),
              origin:rotulo('origin',m.d[DIMI.origin])};
    }).filter(r=>Math.abs(r.delta)>=0.05);
  const estreantes=sel.filter(([m,i])=>{
      const s=ST.SERIES[i]; if(!s[ult]) return false;
      for(let w=0;w<=ant;w++) if(s[w]>0) return false; return true;
    }).map(([m,i])=>({s:m.s, share:+(100*ST.SERIES[i][ult]/(tot[ult]||1)).toFixed(2),
        origin:rotulo('origin',m.d[DIMI.origin]), lanc:m.l}))
      .sort((a,b)=>b.share-a.share);
  D.mudancas={
    semana:D.weeks[ult], comparada:D.weeks[ant], distancia:distMud,
    entraram:t10b.filter(s=>!t10a.includes(s)),
    sairam:t10a.filter(s=>!t10b.includes(s)),
    subiram:varia.slice().sort((a,b)=>b.delta-a.delta).slice(0,6),
    cairam:varia.slice().sort((a,b)=>a.delta-b.delta).slice(0,6),
    estreantes:estreantes.slice(0,8),
    n_estreantes:estreantes.length,
  };

  // ---- Sinais: achados automaticos e extrapolacao condicional -------------
  // Nao e previsao. Achado e um fato ja medido que contraria o padrao dominante;
  // extrapolacao e a taxa observada estendida, com a premissa dita em voz alta.
  // A propria pagina existe para mostrar que essas taxas mudam, entao o numero
  // serve para dimensionar ordem de grandeza, nunca para planejar.
  const inclin=(s,n)=>{                       // minimos quadrados nas ultimas n
    const a=Math.max(0,(s||[]).length-n);
    const v=(s||[]).slice(a).filter(x=>x!=null&&isFinite(x));
    if(v.length<3) return null;
    const xm=(v.length-1)/2, ym=d3.mean(v);
    let num=0, den=0; v.forEach((y,i)=>{ num+=(i-xm)*(y-ym); den+=(i-xm)*(i-xm); });
    return den? num/den : null;
  };
  // Base e horizonte da secao inteira, derivados da janela. Ficavam fixos em 8
  // periodos, entao "tudo", "52", "26" e "13" produziam a mesma leitura: o chip
  // de janela nao fazia nada aqui.
  const LOOK  = Math.max(4, Math.min(26, Math.round(ST.N/3)));
  // E nunca projetar mais do que um quarto do que foi observado. Estender 13
  // semanas a partir de uma janela de 13 semanas e 100% de invencao.
  const HORIZ = Math.max(2, Math.min(ST.GRAN==='semana'?13:3, Math.round(ST.N/4)));
  const achados=[];
  const per1=ST.GRAN==='mes'?'mês':'semana', perN=ST.GRAN==='mes'?'meses':'semanas';
  const jan4=Math.min(4, ult);

  // 1. aceleracao atipica: variacao recente muito acima da propria oscilacao
  if(ult>=6){
    let melhor=null;
    for(const [m,i] of sel){
      if(ehOther(m)) continue;
      const s=ST.SERIES[i]; const sh=s.map((v,w)=>tot[w]? 100*v/tot[w] : 0);
      if(sh[ult]<0.5) continue;
      const d=[]; for(let w=1;w<=ult;w++) d.push(sh[w]-sh[w-1]);
      const dp=d3.deviation(d)||0, recente=sh[ult]-sh[ult-jan4];
      if(dp<=0) continue;
      const z=recente/(dp*Math.sqrt(jan4));
      if(!melhor || z>melhor.z) melhor={s:m.s, z, recente, agora:sh[ult]};
    }
    if(melhor && melhor.z>=2)
      achados.push({t:'Aceleração fora do padrão',
        v:`+${melhor.recente.toFixed(1).replace('.',',')}pp`,
        p:`<span class="mono">${melhor.s}</span> subiu ${melhor.recente.toFixed(1).replace('.',',')} pontos em ${jan4} ${jan4===1?per1:perN}, ${melhor.z.toFixed(1).replace('.',',')} desvios acima da própria oscilação típica. Chegou a ${fmtP(melhor.agora)} do volume.`});
  }

  // 2. contra a corrente do preco: caro e ganhando share
  {
    const precos=sel.filter(([m])=>!ehOther(m)&&m.p).map(([m])=>m.p);
    const medP=precos.length? d3.median(precos) : null;
    if(medP){
      let melhor=null;
      for(const [m,i] of sel){
        if(ehOther(m)||!m.p||m.p<=medP) continue;
        const s=ST.SERIES[i], den0=tot[ult-jan4]||1, den1=tot[ult]||1;
        const d=100*s[ult]/den1 - 100*s[ult-jan4]/den0;
        if(d<=0.2) continue;
        if(!melhor || d>melhor.d) melhor={s:m.s, d, preco:m.p, mult:m.p/medP};
      }
      if(melhor)
        achados.push({t:'Ganhou share sendo mais caro',
          v:`${melhor.mult.toFixed(1).replace('.',',')}× a mediana`,
          p:`<span class="mono">${melhor.s}</span> custa ${fmtUSD(melhor.preco)} por 1M, ${melhor.mult.toFixed(1).replace('.',',')} vezes a mediana do mercado, e mesmo assim ganhou ${melhor.d.toFixed(1).replace('.',',')} pontos de share em ${jan4} ${jan4===1?per1:perN}. Contraria a força dominante do dataset, que é preço.`});
    }
  }

  // 3. sobrevivente: modelo antigo que continua no topo
  {
    const hoje=new Date(MX.semanas[MX.semanas.length-1]+'T00:00:00');
    const t10=sel.filter(([m])=>!ehOther(m)).map(([m,i])=>({m,v:ST.SERIES[i][ult]}))
      .filter(r=>r.v>0).sort((a,b)=>b.v-a.v).slice(0,10);
    const idades=t10.filter(r=>r.m.l).map(r=>(hoje-new Date(r.m.l+'T00:00:00'))/6048e5);
    if(idades.length>=4){
      const med=d3.median(idades);
      const velho=t10.filter(r=>r.m.l)
        .map(r=>({s:r.m.s, sem:(hoje-new Date(r.m.l+'T00:00:00'))/6048e5}))
        .sort((a,b)=>b.sem-a.sem)[0];
      if(velho && velho.sem>=med*2)
        achados.push({t:'Resistindo à temporada',
          v:`${Math.round(velho.sem)} semanas`,
          p:`<span class="mono">${velho.s}</span> foi lançado há ${Math.round(velho.sem)} semanas e continua no top 10, ${(velho.sem/med).toFixed(1).replace('.',',')} vezes a idade mediana do topo. A tese diz que isso é raro, e é exatamente por isso que vale olhar o que ele faz de diferente.`});
    }
  }

  // 4. concentracao invertendo a tendencia
  {
    const curta=inclin(D.hhi, Math.min(LOOK,ST.N)), longa=inclin(D.hhi, ST.N);
    if(curta!=null && longa!=null && Math.sign(curta)!==Math.sign(longa) && Math.abs(curta)>=8)
      achados.push({t: curta>0 ? 'O mercado voltou a concentrar' : 'A concentração voltou a cair',
        v:`HHI ${curta>0?'+':''}${Math.round(curta)}/${per1}`,
        p:`O HHI vinha ${longa<0?'caindo':'subindo'} ao longo da janela e inverteu: nas últimas ${Math.min(LOOK,ST.N)} ${perN} ele ${curta>0?'sobe':'cai'} ${Math.abs(Math.round(curta))} pontos por ${per1}. Reversão de concentração costuma anteceder a chegada de um modelo que domina, ou a saída de um que dominava.`});
  }

  // 5. China e pesos abertos descolando
  {
    const cn=(D.origin_share&&D.origin_share['China'])||[];
    const ow=(D.weights_share&&D.weights_share['Open-weights'])||[];
    if(cn.length===ST.N && ow.length===ST.N && ult>=8){
      const g0=Math.abs(ow[ult-Math.min(12,ult)]-cn[ult-Math.min(12,ult)]);
      const g1=Math.abs(ow[ult]-cn[ult]);
      if(g1-g0>=4)
        achados.push({t:'Pesos abertos descolando da China',
          v:`${g1.toFixed(1).replace('.',',')}pp de distância`,
          p:`As duas curvas costumam andar juntas, porque a maioria dos pesos abertos relevantes é chinesa. A distância entre elas passou de ${g0.toFixed(1).replace('.',',')} para ${g1.toFixed(1).replace('.',',')} pontos. Ou apareceu peso aberto fora da China, ou lab chinês fechando modelo.`});
    }
  }

  // ---- extrapolacao condicional
  // Horizonte fixo de um trimestre, nao "quando cruza o proximo numero redondo".
  // Projetar ate o marco mais proximo produzia sempre "em 2 semanas", que nao diz
  // nada. Treze periodos e o intervalo da propria tese: e nele que a temporada vira.
  const projs=[];
  const proj=(rot, serie, fmt, piso, teto, unidTaxa)=>{
    const s=serie||[]; if(s.length<4) return;
    const m=inclin(s, Math.min(LOOK,ST.N)); const atual=s[s.length-1];
    // "caindo 0,0pp por semana" e uma linha que se contradiz sozinha. O corte
    // e o que o proprio display arredonda, nao um epsilon simbolico.
    const minimo = unidTaxa==='pp' ? 0.05 : 0.005;
    if(m==null || !isFinite(atual) || Math.abs(m)<minimo) return;
    const bruto=atual+m*HORIZ;
    // A reta furando o piso ou o teto nao e defeito do calculo, e a prova de que
    // ela nao se sustenta. Isso vira a informacao, em vez de ser escondido.
    // Nao basta furar dentro do horizonte. Uma reta que chega a US$ 0,01 no
    // ultimo periodo tambem ja se desmentiu, so que sem disparar o teste. A
    // margem de 1,5x pega esse caso: se o limite cai a uma distancia da mesma
    // ordem do horizonte, a reta e o que esta errado, nao o mercado.
    const MARGEM = HORIZ*1.5;
    let rompe=null, n;
    if(piso!=null && m<0 && (n=Math.ceil((piso-atual)/m))<=MARGEM) rompe={lim:fmt(piso), n};
    if(teto!=null && m>0 && (n=Math.ceil((teto-atual)/m))<=MARGEM) rompe={lim:fmt(teto), n};
    // Quando a reta fura o limite, o alvo e artefato do metodo, nao resultado.
    // Publicar "Anthropic 4,5% -> 0,0%" e entregar uma manchete falsa que o
    // aviso embaixo nao desfaz. O que se publica e o rompimento.
    projs.push({rot, atual:fmt(atual), alvo: rompe? null : fmt(bruto),
      n:HORIZ, dir:m>0?'sobe':'cai',
      // Variacao de share e em PONTOS percentuais. Dizer "caindo 1,3% por semana"
      // significa outra coisa (queda relativa), e a metodologia da pagina faz
      // justamente essa distincao.
      taxa: unidTaxa==='pp' ? Math.abs(m).toFixed(1).replace('.',',')+'pp' : fmt(Math.abs(m)),
      rompe});
  };
  proj('Share de laboratórios chineses', (D.origin_share||{})['China'], fmtP, 0, 100, 'pp');
  proj('Share de pesos abertos', (D.weights_share||{})['Open-weights'], fmtP, 0, 100, 'pp');
  proj('Share da Anthropic', D.an_share, fmtP, 0, 100, 'pp');
  proj('Tráfego em endpoints gratuitos', D.free_share, fmtP, 0, 100, 'pp');
  proj('Concentração dos 5 maiores', D.top5, fmtP, 0, 100, 'pp');
  proj('Preço efetivo do mercado', D.preco_efetivo, v=>'US$ '+v.toFixed(2).replace('.',','), 0, null);

  D.sinais={achados, projs, base:Math.min(LOOK,ST.N), horiz:HORIZ, per1, perN};

  // cobertura do recorte, para a barra de status
  const totalGeral=MX.modelos.reduce((s,m,i)=>s+ST.SERIES[i][ult],0);
  return {modelos:sel.length, totalModelos:MX.modelos.length,
          pct: totalGeral? 100*tot[ult]/totalGeral : 0};
}

// ---- interface da barra
function montarFiltros(){
  const body=document.getElementById('fbody');
  body.innerHTML=GRUPOS.map(([dim,rot])=>{
    let vals=MX.dic[dim].map((v,i)=>[v,i]);
    if(ORDEM[dim]) vals.sort((a,b)=>{
      const ia=ORDEM[dim].indexOf(a[0]), ib=ORDEM[dim].indexOf(b[0]);
      return (ia<0?99:ia)-(ib<0?99:ib); });
    return `<div class="fg"><div class="t">${rot}</div><div class="opts">`+
      vals.map(([v,i])=>`<button type="button" data-dim="${dim}" data-i="${i}" aria-pressed="false">${v}</button>`).join('')+
      `</div></div>`;
  }).join('');
  body.querySelectorAll('button[data-dim]').forEach(b=>b.addEventListener('click',()=>{
    const d=b.dataset.dim, i=+b.dataset.i;
    FILTROS[d]=FILTROS[d]||new Set();
    if(FILTROS[d].has(i)) FILTROS[d].delete(i); else FILTROS[d].add(i);
    b.setAttribute('aria-pressed', String(FILTROS[d].has(i)));
    aplicar();
  }));
}
function sincronizarBotoes(){
  document.querySelectorAll('#fbody button[data-dim]').forEach(b=>{
    const s=FILTROS[b.dataset.dim];
    b.setAttribute('aria-pressed', String(!!(s && s.has(+b.dataset.i))));
  });
}
function paraURL(){
  const p=new URLSearchParams();
  for(const d in FILTROS){ const s=FILTROS[d];
    if(s && s.size) p.set(d, [...s].map(i=>MX.dic[d][i]).join('|')); }
  const q=p.toString();
  history.replaceState(null,'', q? location.pathname+'?'+q : location.pathname);
}
function daURL(){
  const p=new URLSearchParams(location.search);
  MX.dims.forEach(d=>{ const v=p.get(d); if(!v) return;
    const s=new Set(); v.split('|').forEach(x=>{ const i=MX.dic[d].indexOf(x); if(i>=0) s.add(i); });
    if(s.size) FILTROS[d]=s; });
}
// O periodo aparece em dezenas de rotulos. Cada um trocado a mao e um que sera
// esquecido na proxima secao, entao a palavra virou elemento marcado com
// data-per e a troca acontece aqui, num lugar so.
const rotPer = () => ST.GRAN==='mes' ? 'Mês' : 'Semana';
function aplicarPeriodo(){
  const adj = ST.GRAN==='mes' ? 'mensal' : 'semanal';
  const sub = ST.GRAN==='mes' ? 'mês' : 'semana';
  const cap = s => s.charAt(0).toUpperCase()+s.slice(1);
  document.querySelectorAll('[data-per]').forEach(el=>{
    const t=el.dataset.per;
    el.textContent = t==='adj'?adj : t==='Adj'?cap(adj) : t==='sub'?sub : cap(sub);
  });
}
function aplicar(){
  construirEixo();
  aplicarPeriodo();
  const info=recalcular();
  const fil=filtrando();
  document.getElementById('fclear').disabled=!fil;
  document.getElementById('fstat').innerHTML = fil
    ? `<b>${info.modelos}</b> de ${info.totalModelos} modelos · <b>${info.pct.toFixed(1)}%</b> do volume ${ST.GRAN==='semana'?'da última semana':'do último mês'}`
    : `${info.totalModelos} modelos, sem recorte`;
  const w=document.getElementById('fwarn');
  if(fil){
    w.hidden=false;
    w.innerHTML=`Com filtro ativo, os percentuais são calculados <b>dentro do recorte</b>, não sobre o mercado inteiro. `+
      `Modelos sem metadado, incluindo a linha <span class="mono">other</span> da fonte, ficam de fora.`;
  } else w.hidden=true;
  paraURL();
  renderStatic(); renderAll();
}

ST.TRAJ_VIEW='forma';

// ---- Trajetoria alinhada no lancamento
// O grafico anterior empilhava 126 series no eixo do calendario e virava novelo.
// Aqui o eixo x e a IDADE do modelo, em semanas desde a estreia, e o y e o share
// como % do proprio pico. Curvas de 2025 e de 2026 passam a ser comparaveis, e o
// que aparece nao e um modelo, e o formato que todos repetem.
function trajectory(name){
  const c=card(name), plot=c.querySelector('.plot'), T=D.trajetoria;
  document.getElementById('traj-sub').textContent =
    ST.TRAJ_VIEW==='forma'
      ? `${T.modelos.length} modelos alinhados na semana de estreia, cada um normalizado pelo próprio pico. A linha grossa é a mediana; a faixa, o intervalo entre o 1º e o 3º quartil.`
      : 'Mediana por trimestre de lançamento, contra a mediana geral em cinza. Mostra se a temporada está encurtando.';

  const E=T.envelope_geral, K=E.mediana.length;
  const yFmt=v=>v+'%';

  if(ST.TRAJ_VIEW==='forma'){
    const f=frame(plot, 360, {t:14,r:16,b:34,l:46});
    const x=d3.scaleLinear().domain([0,K-1]).range([f.m.l, f.w-f.m.r]);
    const y=d3.scaleLinear().domain([0,100]).range([f.h-f.m.b,f.m.t]);

    // eixos com rotulo em semanas
    f.svg.append('g').attr('class','grid').selectAll('line').data(y.ticks(4)).join('line')
      .attr('x1',f.m.l).attr('x2',f.w-f.m.r).attr('y1',y).attr('y2',y);
    f.svg.append('g').attr('class','ax').selectAll('text').data(y.ticks(4)).join('text')
      .attr('x',f.m.l-8).attr('y',d=>y(d)+4).attr('text-anchor','end').text(d=>{const v=yFmt(d); return typeof v==='number'?fmtNum(v,2):br(String(v));});
    f.svg.append('g').attr('class','ax').selectAll('text').data(x.ticks(8)).join('text')
      .attr('x',x).attr('y',f.h-f.m.b+18).attr('text-anchor','middle').text(d=>d===0?'estreia':d+' sem');

    const ln=d3.line().defined(d=>d[1]!=null).x(d=>x(d[0])).y(d=>y(d[1])).curve(d3.curveMonotoneX);
    const ar=d3.area().x((d,i)=>x(i)).y0(d=>y(d[0])).y1(d=>y(d[1])).curve(d3.curveMonotoneX);

    // faixa interquartil
    f.svg.append('path').datum(E.p25.map((v,i)=>[v,E.p75[i]]))
      .attr('d',ar).attr('fill',col('--s1')).attr('opacity',.10);

    // curvas individuais, recessivas, coloridas por origem
    const oslot=m=>ORIGIN_SLOT[m.origin]||'--s0';
    const origens=[...new Set(T.modelos.map(m=>m.origin))];
    const vis=new Set(visiveis('life-origem', origens));
    const mostrados=T.modelos.filter(m=>vis.has(m.origin));
    const t_=tip(plot);
    const paths=f.svg.append('g').selectAll('path').data(mostrados).join('path')
      .attr('d',m=>ln(m.rel.map((v,i)=>[i,v])))
      .attr('fill','none').attr('stroke',m=>col(oslot(m)))
      .attr('stroke-width',1).attr('opacity',.16)
      .style('cursor','pointer')
      .on('mousemove',(ev,m)=>{
        paths.attr('opacity',q=>q===m?1:.06).attr('stroke-width',q=>q===m?2.5:1);
        const [mx,my]=d3.pointer(ev); const sx=plot.getBoundingClientRect().width/f.w;
        showTip(t_,plot,mx*sx,my*sx,
          `<div class="t">${m.model}</div>`+
          tipRow(col(oslot(m)),'Origem',m.origin)+
          tipRow('transparent','Pesos',m.weights)+
          tipRow('transparent','Estreia',m.first)+
          tipRow('transparent','Pico',fmtP(m.peak_share))+
          tipRow('transparent','Semanas até o pico',m.weeks_to_peak)+
          tipRow('transparent','Meia-vida',m.half_life_weeks==null?'ainda não caiu 50%':fmtNum(m.half_life_weeks)+' semanas')+
          tipRow('transparent','Ainda em uso',m.still_alive?'sim':'não'));
      })
      .on('mouseleave',()=>{paths.attr('opacity',.16).attr('stroke-width',1); t_.style.display='none';});

    // mediana por cima
    f.svg.append('path').datum(E.mediana.map((v,i)=>[i,v]))
      .attr('d',ln).attr('fill','none').attr('stroke',css('--ink')).attr('stroke-width',2.5)
      .style('pointer-events','none');

    // rotulos diretos em pontos que importam
    const pico=E.mediana.indexOf(d3.max(E.mediana));
    const meia=E.mediana.findIndex((v,i)=>i>pico && v<=E.mediana[pico]/2);
    [[pico,'pico da mediana'],[meia,'metade do pico']].filter(([i])=>i>0).forEach(([i,txt])=>{
      f.svg.append('circle').attr('cx',x(i)).attr('cy',y(E.mediana[i])).attr('r',4)
        .attr('fill',css('--ink')).attr('stroke',css('--surface')).attr('stroke-width',2).style('pointer-events','none');
      f.svg.append('text').attr('class','dl').attr('x',x(i)+9).attr('y',y(E.mediana[i])-6)
        .style('fill',css('--ink-2')).style('font-weight',600)
        .text(`${txt}: semana ${i}`).style('pointer-events','none');
    });

    legend(c.querySelector('.legend'),
      origens.map(k=>[k,col(ORIGIN_SLOT[k]||'--s0'),k+' ('+T.modelos.filter(m=>m.origin===k).length+')']),
      'life-origem', ()=>trajectory('life'));
    // a mediana nao entra na legenda clicavel: ela e referencia, nao categoria
    c.querySelector('.legend').insertAdjacentHTML('afterbegin',
      `<span style="display:inline-flex;align-items:center;padding:2px 7px"><i style="background:${css('--ink')}"></i>Mediana dos ${T.modelos.length}</span>`);
  } else {
    // small multiples por trimestre de lancamento
    plot.innerHTML='';
    const wrap=document.createElement('div'); wrap.className='sm'; plot.appendChild(wrap);
    T.coortes.forEach(q=>{
      const E2=T.envelope_coorte[q]; if(!E2) return;
      const box=document.createElement('div'); box.className='p';
      box.innerHTML=`<h4>${q} <span class="n">n=${E2.n[0]}</span></h4>`;
      const holder=document.createElement('div'); box.appendChild(holder); wrap.appendChild(box);
      const w=Math.max(150, holder.clientWidth||holder.parentElement.clientWidth), h=132;
      const svg=d3.select(holder).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('width','100%').attr('height',h);
      const m={t:8,r:8,b:18,l:26};
      const x=d3.scaleLinear().domain([0,K-1]).range([m.l,w-m.r]);
      const y=d3.scaleLinear().domain([0,100]).range([h-m.b,m.t]);
      svg.append('g').attr('class','grid').selectAll('line').data([0,50,100]).join('line')
        .attr('x1',m.l).attr('x2',w-m.r).attr('y1',y).attr('y2',y);
      svg.append('g').attr('class','ax').selectAll('text').data([0,50,100]).join('text')
        .attr('x',m.l-5).attr('y',d=>y(d)+3.5).attr('text-anchor','end').style('font-size','9.5px').text(d=>d+'%');
      svg.append('g').attr('class','ax').selectAll('text').data([0,12,24,36]).join('text')
        .attr('x',x).attr('y',h-4).attr('text-anchor','middle').style('font-size','9.5px').text(d=>d);
      const ln=d3.line().x((d,i)=>x(i)).y(d=>y(d)).curve(d3.curveMonotoneX);
      svg.append('path').datum(E.mediana).attr('d',ln).attr('fill','none')
        .attr('stroke',css('--ink-3')).attr('stroke-width',1.5).attr('stroke-dasharray','3 3');
      svg.append('path').datum(E2.mediana).attr('d',ln).attr('fill','none')
        .attr('stroke',col('--s1')).attr('stroke-width',2.5);
    });
    legend(c.querySelector('.legend'),
      [['q',col('--s1'),'Mediana do trimestre'],['g',css('--ink-3'),'Mediana geral']]);
  }

  const L=T.modelos;
  table(c.querySelector('.tbl'),
    ['Modelo','Origem','Pesos','Estreia','Trimestre','Pico share','Sem. até pico','Meia-vida','Ainda em uso'],
    L.map(m=>[m.model,m.origin,m.weights,m.first,m.cohort,fmtP(m.peak_share),m.weeks_to_peak,
              m.half_life_weeks==null?'—':fmtNum(m.half_life_weeks)+' sem',m.still_alive?'sim':'não']));
}

// ---- leaderboard
function board(){
  const c=card('board'), plot=c.querySelector('.plot'); const rows=D.boards.last; const y=D.boards.yearago, p=D.boards.prev12;
  if(!rows || !rows.length){ document.getElementById('board-sub').textContent=''; return vazio('board','Nenhum modelo no recorte atual.'); }
  const max=rows[0].share;
  const pos=(arr,m)=>{const i=arr.findIndex(r=>r.model===m); return i<0?null:i+1;};
  plot.innerHTML=`<table class="board"><thead><tr><th>#</th><th>Modelo</th><th></th><th class="num">Share</th><th class="num">Tokens/sem</th><th class="num">Há 12 sem</th></tr></thead><tbody>${rows.map((r,i)=>{const pp=pos(p,r.model); return `<tr><td class="mono">${i+1}</td><td><span class="m">${r.model}</span><span class="pill">${r.origin}</span><span class="pill">${r.weights}</span></td><td style="width:22%"><div class="bar" style="width:${(r.share/max*100).toFixed(1)}%;background:${col(ORIGIN_SLOT[r.origin]||'--s0')}"></div></td><td class="num">${fmtP(r.share)}</td><td class="num mono">${fmtT(r.T)}</td><td class="num mono" style="color:var(--ink-3)">${pp?'#'+pp:'fora do top 15'}</td></tr>`;}).join('')}</tbody></table>`;
  document.getElementById('board-sub').textContent=`Semana de ${fD(new Date(D.last_week+'T00:00:00'))}; cor da barra = origem do lab`;
}

// ---- tiles
// Tiles do topo.
//
// Sob recorte, a primeira semana pode ter volume proximo de zero, e ai qualquer
// razao vira lixo ("×66716 desde 06 jan 25 (0.00T)"). Entao a base de comparacao
// nao e a primeira semana da serie, e a primeira semana em que o recorte teve
// volume relevante. Sem base valida, o tile mostra a estreia em vez de inventar
// um multiplicador.
function tiles(){
  // W e SERIES ja vem recortados pela janela: 0 e o inicio dela, N-1 o fim.
  const ini=0, last=ST.N-1;
  const tot=D.weekly_total_T, an=D.an_share||[];
  const cn=(D.origin_share&&D.origin_share['China'])||[];
  const ow=(D.weights_share&&D.weights_share['Open-weights'])||[];
  const t5=D.top5, fil=filtrando();

  // Base de comparacao: a primeira semana com volume que o proprio display
  // consegue mostrar. O corte anterior era 1% do volume atual, agressivo demais:
  // a serie cresceu 231x, entao a primeira semana real (0,5T) caia fora e o tile
  // passava a dizer "desde 03 mar 25" numa serie que comeca em 06 jan 25.
  const baseIdx=(()=>{ for(let i=ini;i<=last;i++) if((tot[i]||0)>=0.005) return i; return -1; })();
  const estreia=(()=>{ for(let i=ini;i<=last;i++) if((tot[i]||0)>0) return i; return -1; })();
  const cmp=(serie,fmt)=>{
    if(baseIdx<0) return estreia>=0? `estreia em ${fD(ST.W[estreia])}` : 'sem volume no recorte';
    const v=serie[baseIdx];
    return (v==null||!isFinite(v))? `desde ${fD(ST.W[baseIdx])}` : `era ${fmt(v)} em ${fD(ST.W[baseIdx])}`;
  };
  const cresc=(()=>{
    if(baseIdx<0 || !tot[baseIdx]) return null;
    const r=tot[last]/tot[baseIdx];
    // O multiplicador ja vai no selo ao lado do valor; repetir aqui era redundante.
    return isFinite(r)&&r>=1.05? `desde ${fD(ST.W[baseIdx])} (${fmtT(tot[baseIdx])})` : null;
  })();

  const janela=s=>(s||[]).slice(ini,last+1);
  const anJ=janela(an);
  const anPeak=anJ.length? ini+anJ.indexOf(d3.max(anJ)) : -1;
  const semAn=!anJ.length || d3.max(anJ)===0;
  const hhiTxt=(D.hhi[baseIdx>=0?baseIdx:0]!=null)
    ? ` · HHI ${D.hhi[baseIdx>=0?baseIdx:0]}→${D.hhi[last]}` : '';

  // O valor grande e sempre a ultima semana, que esta em toda janela. Trocar a
  // janela mexia so na linha de apoio, entao batia o olho e parecia travado.
  // A variacao DENTRO da janela e o que muda, e agora ela aparece ao lado.
  const delta=(serie,unid)=>{
    if(baseIdx<0) return '';
    const a=serie[baseIdx], b=serie[last];
    if(a==null||b==null||!isFinite(a)||!isFinite(b)) return '';
    const d=b-a;
    // Sem verde e vermelho aqui. Pintar "share de labs chineses subindo" de verde
    // e emitir juizo de valor, e a pagina nao torce por lado nenhum. A seta diz a
    // direcao, o leitor decide se aquilo e bom para ele.
    if(unid==='pp' && Math.abs(d)<0.05) return '<span class="dl">estável na janela</span>';
    if(unid==='x'){ const r=a>0? b/a : null; return (r&&isFinite(r)&&Math.abs(r-1)>=0.05)
      ? `<span class="dl">${r>1?'↑':'↓'} ${r>1?'×':'÷'}${fmtVez(r>1?r:1/r)} na janela</span>` : ''; }
    return `<span class="dl">${d>0?'↑':'↓'} ${br(Math.abs(d).toFixed(1))}pp na janela</span>`;
  };
  const items=[
    ['Tokens por semana', fmtT(tot[last])+delta(tot,'x'),
      cresc || (estreia>=0?`estreia em ${fD(ST.W[estreia])}`:'sem volume'), 'up'],
    ['Share de labs chineses', fmtP(cn[last]||0)+delta(cn,'pp'), cmp(cn,fmtP), 'up'],
    ['Share open-weights', fmtP(ow[last]||0)+delta(ow,'pp'), cmp(ow,fmtP), 'up'],
    ['Share da Anthropic', semAn?'—':fmtP(an[last])+delta(an,'pp'),
      semAn? (fil?'sem volume no recorte':'sem volume')
           : `pico de ${fmtP(an[anPeak])} em ${fD(ST.W[anPeak])}`, 'down'],
    ['Top 5 modelos', fmtP(t5[last])+delta(t5,'pp'),
      (baseIdx>=0? `do volume; era ${fmtP(t5[baseIdx])}`:'do volume')+hhiTxt, 'down'],
  ];
  document.getElementById('tiles').innerHTML=items.map(([k,v,d,cls])=>
    `<div class="tile"><div class="k">${k}</div><div><div class="v">${v}</div><div class="d ${cls}">${d}</div></div></div>`).join('');
}

function readings(){
  // W e SERIES ja vem recortados pela janela: 0 e o inicio dela, N-1 o fim.
  // Painel novo escrito com [0] e [N-1] ja nasce correto, sem precisar lembrar.
  const ini=0, last=ST.N-1, nPer=ST.N;
  const jan=s=>(s||[]).slice(ini,last+1);
  const S=(o,k)=>Array.isArray(o&&o[k])?o[k]:new Array(ST.N).fill(0);   // acesso seguro
  const num=v=>Number.isFinite(v)?v:0;
  const vez=(a,b)=>(b>0&&Number.isFinite(a/b))?fmtVez(a/b):null;
  const set=(id,html)=>{const el=document.getElementById(id); if(el) el.innerHTML=html;};
  const LAB=k=>VENDOR_LABEL[k]||capital(k);
  const fil=filtrando();
  const nota=fil?`<p><span class="flag">recorte</span>Os números abaixo consideram apenas os modelos do filtro ativo.</p>`:'';

  const tot=D.weekly_total_T, an=D.an_share, ab=S(D.vendor_abs,'anthropic');
  const vs=D.vendor_share||{};
  const ord=Object.keys(vs).filter(k=>k!=='Outros').sort((a,b)=>num(vs[b][last])-num(vs[a][last]));
  const b=(D.boards&&D.boards.last)||[];

  // 01 volume
  const cresc=vez(tot[last],tot[ini]);
  const st=b.find(r=>r.vendor==='stealth');
  set('read-volume',`<h4>Leitura</h4>${nota}<p>O volume semanal foi de <b>${fmtT(tot[ini])}</b> para <b>${fmtT(tot[last])}</b>`+
    (cresc?`: ×${cresc} em ${nPer} ${ST.GRAN==='mes'?'meses':'semanas'}`:'')+`. A curva não é linear: os degraus coincidem com a chegada de modelos baratos e de endpoints gratuitos.</p>`+
    (st?`<p><span class="flag">caveat</span>A última semana traz <b>${fmtP(st.share)}</b> em <span class="mono">${st.model}</span>, um modelo anônimo em teste. Tráfego assim é transitório e infla o topo.</p>`:'')+
    `<p>Comparar volumes absolutos entre o início e o fim da série exige normalização: qualquer share do começo vale muito menos em tokens.</p>`);

  // 02 concentracao
  const h0=D.hhi[ini], h1=D.hhi[last];
  const faixa=v=>v>=2500?'altamente concentrado':v>=1500?'moderadamente concentrado':'não concentrado';
  set('read-conc',`<h4>Leitura</h4>${nota}<p>Os 5 maiores modelos foram de <b>${fmtP(D.top5[ini])}</b> para <b>${fmtP(D.top5[last])}</b> do volume. O HHI, na base modelo, foi de <b>${h0}</b> para <b>${h1}</b>`+
    (faixa(h0)!==faixa(h1)?`: saiu de "${faixa(h0)}" para "${faixa(h1)}" na escala antitruste convencional`:`, o que o mantém como "${faixa(h1)}" na escala antitruste convencional`)+`.</p>`+
    `<p>Implicação para roteamento: existem substitutos próximos em cada faixa de preço. Ficar preso a um modelo específico é uma decisão, não uma inevitabilidade.</p>`);

  // 03 labs
  const novos=ord.filter(k=>num(vs[k][ini])<0.5 && num(vs[k][last])>=1);
  const somaNovos=novos.reduce((s,k)=>s+num(vs[k][last]),0);
  const lider0=ord.slice().sort((a,b2)=>num(vs[b2][ini])-num(vs[a][ini]))[0];
  set('read-vendor',`<h4>Leitura</h4>${nota}`+
    (lider0?`<p>No início da janela (${fD(ST.W[ini])}), o maior era <b>${LAB(lider0)}</b>, com ${fmtP(vs[lider0][ini])}.</p>`:'')+
    (ord.length?`<p>Na última, o líder é <b>${LAB(ord[0])} (${fmtP(vs[ord[0]][last])})</b>`+
      (ord[1]?`, seguido de ${LAB(ord[1])} (${fmtP(vs[ord[1]][last])})`:'')+
      (ord[2]?` e ${LAB(ord[2])} (${fmtP(vs[ord[2]][last])})`:'')+`.</p>`:'')+
    (novos.length?`<p>${novos.length===1?'Um laboratório que':'Laboratórios que'} não tinha${novos.length===1?'':'m'} share relevante no início da janela: ${novos.slice(0,5).map(LAB).join(', ')}. Hoje soma${novos.length===1?'':'m'} <b>${fmtP(somaNovos)}</b>.</p>`:'')+
    `<p>Liderança em share, neste dataset, tem durado de dois a três trimestres.</p>`);

  // 04 leaderboard
  const t10=b.slice(0,10);
  const cn=t10.filter(r=>r.origin==='China').length, ow=t10.filter(r=>r.weights==='Open-weights').length;
  const usProp=t10.filter(r=>r.origin==='EUA/Canadá'&&r.weights==='Proprietário').length;
  const iAn=b.findIndex(r=>r.vendor==='anthropic');
  const anTop=Object.entries(D.an_models||{}).sort((x,y)=>num(y[1][last])-num(x[1][last]))[0];
  set('read-board',`<h4>Leitura</h4>${nota}`+
    (t10.length?`<p>Dos ${t10.length} mais usados na última semana, <b>${cn}</b> ${cn===1?'é de laboratório chinês':'são de laboratórios chineses'} e <b>${ow}</b> ${ow===1?'é':'são'} de pesos abertos. Proprietários americanos: <b>${usProp}</b>.</p>`:'<p>Nenhum modelo no recorte atual.</p>')+
    `<p>`+(iAn>=0
      ? `O modelo Anthropic mais usado (<span class="mono">${b[iAn].model}</span>) está em #${iAn+1}.`
      : (anTop&&num(anTop[1][last])>0
          ? `Nenhum modelo Anthropic aparece neste top; o mais usado dela é <span class="mono">${anTop[0]}</span>, com ${fmtT(anTop[1][last])}.`
          : `Nenhum modelo Anthropic aparece neste recorte.`))+
    ` A métrica aqui é tokens, não receita nem qualidade: modelos de fronteira aparecem com share menor e uso de maior valor.</p>`);

  // 05 pesos e origem
  const ow2=S(D.weights_share,'Open-weights'), cn2=S(D.origin_share,'China'), fr=D.free_share||new Array(ST.N).fill(0);
  set('read-weights',`<h4>Leitura</h4>${nota}<p>Pesos abertos foram de <b>${fmtP(ow2[ini])}</b> para <b>${fmtP(ow2[last])}</b> do volume; laboratórios chineses, de <b>${fmtP(cn2[ini])}</b> para <b>${fmtP(cn2[last])}</b>. As duas curvas andam quase juntas porque a maioria dos pesos abertos relevantes hoje é chinesa. São o mesmo fenômeno visto de dois ângulos, não duas tendências independentes.</p>`+
    `<p>Tráfego em endpoints gratuitos chegou a <b>${fmtP(d3.max(jan(fr))||0)}</b> e está em <b>${fmtP(fr[last])}</b>. Parte relevante do crescimento é demanda subsidiada, que ainda não foi testada contra preço.</p>`+
    `<p><span class="flag">implicação</span>Para quem opera inferência própria, o deslocamento para pesos abertos abre a opção de self-hosting, mas o custo de manter avaliação contínua cresce com a rotatividade da seção 05.</p>`);

  // 06 Anthropic
  const anJ=jan(an); const peak=anJ.length? ini+anJ.indexOf(d3.max(anJ)) : ini;
  const cAn=vez(ab[last],ab[ini]), cTot=vez(tot[last],tot[ini]);
  const trio=['anthropic','openai','google'].reduce((s,k)=>s+num((D.comp_share&&D.comp_share[k]||[])[last]),0);
  set('read-anshare',`<h4>Leitura</h4>${nota}<p>Share da Anthropic: <b>${fmtP(an[ini])}</b> em ${fD(ST.W[ini])}, pico de <b>${fmtP(an[peak])}</b> em ${fD(ST.W[peak])}, <b>${fmtP(an[last])}</b> em ${fD(ST.W[last])}. Em tokens absolutos a história é outra: de ${fmtT(ab[ini])} para <b>${fmtT(ab[last])}</b> por semana`+
    (cAn?` (×${cAn})`:'')+`.</p>`+
    (cAn&&cTot?`<p>Ou seja, a Anthropic cresceu ${cAn}× enquanto o mercado cresceu ${cTot}×. O share caiu porque o denominador explodiu com tráfego barato e gratuito, não porque o uso encolheu. Ler share sem ler o absoluto produz a conclusão oposta da correta.</p>`:'')+
    (trio>0?`<p>Os três maiores laboratórios americanos proprietários somam <b>${fmtP(trio)}</b> hoje.</p>`:''));

  // 07 familias Anthropic
  const fam=D.an_fam_abs||{}; const chaves=Object.keys(fam);
  const famTot=chaves.reduce((s,k)=>s+num(fam[k][last]),0);
  const mix=chaves.map(k=>[k,num(fam[k][last])]).sort((x,y)=>y[1]-x[1])
    .filter(([,v])=>v>0).map(([k,v])=>`${k} <b>${fmtP(100*v/famTot)}</b>`).join(', ');
  const ten=(D.life||[]).filter(m=>m.vendor==='anthropic'&&m.weeks_in_top10>0)
    .sort((x,y)=>x.first<y.first?-1:1)
    .map(m=>`${m.model.replace('anthropic/claude-','').replace(/-20\d{6}$/,'')} ${m.weeks_in_top10} sem`);
  set('read-anfam',`<h4>Leitura</h4>${nota}`+
    (famTot>0?`<p>Mix Anthropic na semana de ${fD(ST.W[ST.N-1])}: ${mix}. Haiku é residual no OpenRouter; não generalize para cargas enterprise via API direta ou Bedrock, onde o roteamento por custo tem outro perfil.</p>`:`<p>Sem volume Anthropic no recorte atual.</p>`)+
    (ten.length?`<p>Permanência no top 10: ${ten.join(', ')}. A cadência de lançamento acelerou e cada geração dura menos no topo, canibalizada pela seguinte. Para quem calibra prompts e avaliações por modelo, a janela útil de cada versão encurtou.</p>`:''));

  // 09 dinheiro
  const g=D.spend_total_musd||[], lo=D.spend_band.piso, hi=D.spend_band.teto, pe=D.preco_efetivo||[];
  const bl=D.blend||{prompt:.75};
  const fmtU=v=>'US$ '+(v>=1000?(v/1000).toFixed(1).replace('.',',')+'B':Math.round(v)+'M');
  const vd=(D.volume_vs_dinheiro||[]).filter(r=>r.razao!=null&&r.share_tokens>=1);
  const caro=vd.slice().sort((a,b)=>b.razao-a.razao)[0];
  const barato=vd.slice().sort((a,b)=>a.razao-b.razao)[0];
  set('read-spend',`<h4>Leitura</h4>${nota}<p>A preço de tabela, o tráfego da última semana equivale a <b>${fmtU(g[last])}</b>, dentro de uma faixa de ${fmtU(lo[last])} a ${fmtU(hi[last])}. A largura da faixa não é imprecisão do cálculo: a fonte soma prompt e completion sem separar, e completion custa várias vezes mais.</p>`+
    `<p>O preço efetivo do mercado está em <b>US$ ${br(d3.format('.2f')(pe[last]||0))}</b> por milhão de tokens`+
    (pe[0]?`, contra US$ ${br(d3.format('.2f')(pe[0]))} no início da série`:'')+`. Queda aqui pode significar duas coisas diferentes: os modelos ficaram mais baratos, ou a demanda migrou para os baratos. É a segunda que domina neste dataset.</p>`+
    `<p><span class="flag">método</span>Gasto é estimativa a preço de tabela, com mistura de ${Math.round(bl.prompt*100)}% prompt. Não considera desconto, cache, batch nem contrato. Endpoint gratuito conta como zero.</p>`);

  set('read-vsmoney',`<h4>Leitura</h4>${nota}`+
    (caro&&barato&&caro.lab!==barato.lab
      ? `<p><b>${LAB(caro.lab)}</b> tem <b>${fmtP(caro.share_tokens)}</b> dos tokens e <b>${fmtP(caro.share_gasto)}</b> do dinheiro: razão de <b>${caro.razao.toFixed(2).replace('.',',')}×</b>. No outro extremo, <b>${LAB(barato.lab)}</b> tem ${fmtP(barato.share_tokens)} dos tokens e ${fmtP(barato.share_gasto)} do dinheiro, razão de ${barato.razao.toFixed(2).replace('.',',')}×.</p>`
      : '')+
    `<p>É a divergência mais importante do dataset e a que quase nenhuma análise pública mostra. "Laboratórios chineses dominam" é verdade em tokens e falso em receita. Toda conversa sobre share de modelos usa a métrica que favorece quem cobra menos.</p>`+
    `<p><span class="flag">implicação</span>Se você compara fornecedores por share de tokens, está comparando volume de tráfego barato. Para decisão de contrato, a razão dinheiro/volume diz mais: ela aproxima o posicionamento de preço de cada laboratório dentro do mix real de uso.</p>`);

  // 10 qualidade
  const qs=(D.qualidade||[]).filter(r=>r.aa!=null&&r.share>0);
  const comAA=qs.length, totQ=(D.qualidade||[]).filter(r=>r.share>0).length;
  const medAA=comAA?d3.median(qs,r=>r.aa):null, medSh=comAA?d3.median(qs,r=>r.share):null;
  const subusado=comAA?qs.filter(r=>r.aa>medAA&&r.share<medSh).sort((a,b)=>b.aa-a.aa)[0]:null;
  const sobreusado=comAA?qs.filter(r=>r.aa<medAA&&r.share>medSh).sort((a,b)=>b.share-a.share)[0]:null;
  set('read-quality',`<h4>Leitura</h4>${nota}`+
    (comAA?`<p>Dos ${totQ} modelos com volume nesta semana, <b>${comAA}</b> têm índice de inteligência publicado. A mediana do índice é <b>${medAA.toFixed(1).replace('.',',')}</b> e a de share é ${fmtP(medSh)}.</p>`:'<p>Nenhum modelo do recorte tem índice de inteligência publicado.</p>')+
    (subusado?`<p>O caso mais claro de qualidade sem adoção é <span class="mono">${subusado.slug}</span>: índice ${fmtNum(subusado.aa,1)}, share de apenas ${fmtP(subusado.share)}.</p>`:'')+
    (sobreusado?`<p>E o inverso, adoção sem índice alto: <span class="mono">${sobreusado.slug}</span>, índice ${fmtNum(sobreusado.aa,1)} e share de ${fmtP(sobreusado.share)}.</p>`:'')+
    `<p>Os dois eixos medem coisas diferentes e nenhum dos dois está errado. Benchmark diz o que o modelo consegue fazer; share diz o que as pessoas escolheram pagar para rodar. Quando divergem, normalmente a diferença é preço, latência ou disponibilidade de endpoint, não capacidade.</p>`+
    `<p><span class="flag">fonte</span>Índice de inteligência produzido pela Artificial Analysis e distribuído pela API do OpenRouter.</p>`);

  // 12 o mapa
  const MP=D.mapa;
  if(MP && MP.labs.length){
    const modo=(typeof ST.MAPA_MODO!=='undefined')?ST.MAPA_MODO:'recursos';
    const com=MP.labs.map(o=>({...o,x:modo==='indice'?o.xAA:o.xRec})).filter(o=>o.x!=null);
    const q=(o)=>o.y>=50 ? (o.x>=50?'Líderes':'Desafiantes') : (o.x>=50?'Promessas':'Nichados');
    const grupos={'Líderes':[],'Desafiantes':[],'Promessas':[],'Nichados':[]};
    com.forEach(o=>grupos[q(o)].push(o));
    const lista=k=>grupos[k].sort((a,b)=>b.tokens-a.tokens).map(o=>LAB(o.lab)).join(', ')||'nenhum';
    const maior=(k)=>{const a=MP.antes; return com.filter(o=>a[o.lab]).map(o=>({o,d:o.y-a[o.lab].y}))
      .sort((p,r)=>k==='sobe'? r.d-p.d : p.d-r.d)[0];};
    const sobe=maior('sobe'), desce=maior('desce');
    const per=MP.periodos_atras, unid=per===1?(ST.GRAN==='semana'?'semana':'mês'):(ST.GRAN==='semana'?'semanas':'meses');
    set('read-mapa',`<h4>Leitura</h4>${nota}`+
      `<p><b>Líderes</b> (tração e capacidade acima da mediana): ${lista('Líderes')}.</p>`+
      `<p><b>Desafiantes</b>, muito uso com capacidade declarada abaixo da mediana: ${lista('Desafiantes')}. É o quadrante que a tese prevê: tração construída sobre preço e disponibilidade, não sobre recurso técnico de fronteira.</p>`+
      `<p><b>Promessas</b>, capacidade alta e tração baixa: ${lista('Promessas')}. <b>Nichados</b>: ${lista('Nichados')}.</p>`+
      (sobe&&Math.abs(sobe.d)>=3?`<p>Maior avanço em tração ${per===1?'no último':'nos últimos'} ${per} ${unid}: <b>${LAB(sobe.o.lab)}</b>, ${sobe.d>=0?'+':''}${Math.round(sobe.d)} pontos de percentil.`+
        (desce&&desce.d<=-3?` Maior recuo: <b>${LAB(desce.o.lab)}</b>, ${Math.round(desce.d)}.`:'')+`</p>`:'')+
      `<p><span class="flag">método</span>Os dois eixos são percentis entre os laboratórios presentes, não valores absolutos: é um mapa de posição relativa. Os pesos de cada componente são editoriais e estão abertos para ajuste logo abaixo do gráfico. Nenhum número aqui é julgamento de analista, todos saem do mesmo pipeline que gera o resto da página.</p>`+
      (modo==='indice'&&MP.com_indice<MP.total
        ? `<p><span class="flag">cobertura</span>${MP.total-MP.com_indice} de ${MP.total} laboratórios não têm nenhum modelo com índice publicado e ficam fora deste modo, incluindo alguns com volume relevante. O modo "Recursos" coloca todos no mapa.</p>`
        : ''));
  } else { set('read-mapa',`<h4>Leitura</h4>${nota}<p>Nenhum laboratório com volume no recorte atual.</p>`); }

  // 11 o que mudou
  const M=D.mudancas||{};
  const sub=(M.subiram||[])[0], cai=(M.cairam||[])[0];
  set('read-mudou',`<h4>Leitura</h4>${nota}<p>Comparando a última semana completa com a de quatro semanas antes: <b>${(M.entraram||[]).length}</b> ${(M.entraram||[]).length===1?'modelo entrou':'modelos entraram'} no top 10 e <b>${(M.sairam||[]).length}</b> ${(M.sairam||[]).length===1?'saiu':'saíram'}. <b>${M.n_estreantes||0}</b> ${M.n_estreantes===1?'modelo estreou':'modelos estrearam'} no ranking.</p>`+
    (sub?`<p>Maior alta: <span class="mono">${sub.s}</span>, ${sub.delta>=0?'+':''}${sub.delta.toFixed(2).replace('.',',')}pp, de ${fmtP(sub.de)} para ${fmtP(sub.para)}.</p>`:'')+
    (cai?`<p>Maior queda: <span class="mono">${cai.s}</span>, ${cai.delta.toFixed(2).replace('.',',')}pp, de ${fmtP(cai.de)} para ${fmtP(cai.para)}.</p>`:'')+
    `<p><span class="flag">tese</span>Esta seção é a razão de a página ser diária. Um retrato histórico muda pouco de um dia para o outro; a rotatividade do topo, não. Quatro semanas é o intervalo em que a temporada vira.</p>`);

  // 08 ciclo de vida (nao depende do recorte: e sobre o historico dos modelos)
  const ch=jan(D.churn).filter(v=>v!=null);
  const idade=d3.median(jan(D.age).filter(v=>v!=null));
  const ttp=d3.median(D.life.map(m=>m.weeks_to_peak));
  const half=d3.median(D.life.filter(m=>m.half_life_weeks!=null).map(m=>m.half_life_weeks));
  // Falar de "os 10 mais usados" sem dizer quais deixa o numero inauditavel.
  const top10=(D.boards&&D.boards.last||[]).slice(0,10);
  const nomes=top10.length
    ? `<p>Os 10 desta semana, em ordem de volume: ${top10.map(r=>`<span class="mono">${r.model}</span>`).join(', ')}.</p>`
    : '';
  set('read-cohort',`<h4>Leitura</h4><p>A cada 4 semanas, em mediana <b>${d3.median(ch)}</b> dos 10 modelos mais usados são novos no top 10. A idade mediana do top 10 gira em torno de <b>${fmtNum(idade)} semanas</b> desde a estreia.</p>`+nomes+
    `<p>Modelos que atingiram ≥ 2% do volume levam em mediana <b>${fmtNum(ttp)} semanas</b> até o pico e perdem metade do share <b>${fmtNum(half)} semanas</b> depois dele.</p>`+
    `<p><span class="flag">tese</span>Nenhum modelo sustenta liderança por mais de dois trimestres neste dataset. O ativo durável é o método de avaliação e troca, não a escolha do modelo.</p>`+
    `<p class="mono" style="font-size:11.5px;color:var(--ink-3)">Esta seção descreve o histórico completo dos modelos e não responde aos filtros.</p>`);
}

// ===========================================================================
// Seção 06: dinheiro
// ===========================================================================
// Gasto e ESTIMATIVA, nao medicao: a fonte soma prompt e completion sem separar
// e os precos diferem. Por isso a banda piso-teto e desenhada junto com a linha.
// Grafico de dinheiro sem a banda seria precisao falsa.
function spendChart(name){
  const c=card(name), plot=c.querySelector('.plot'), ii=idx();
  const v=D.spend_total_musd, lo=D.spend_band.piso, hi=D.spend_band.teto;
  if(!v || !d3.max(v)) return vazio(name,'Sem gasto estimável no recorte atual: os modelos selecionados não têm preço no catálogo.');
  const bl=D.blend||{prompt:.75};
  document.getElementById('spend-sub').textContent=
    `Milhões de dólares por semana, a preço de tabela. A faixa vai de "tudo prompt" a "tudo completion"; a linha usa ${Math.round(bl.prompt*100)}% prompt.`;
  const f=frame(plot, 260, {t:14,r:16,b:30,l:52});
  const x=xScale(f,ii), y=d3.scaleLinear().domain([0,d3.max(ii,i=>hi[i])*1.06]).nice().range([f.h-f.m.b,f.m.t]);
  const fmtU=n=>'US$ '+br(n>=1000? d3.format('.1f')(n/1000)+'B' : d3.format('.0f')(n)+'M');
  axes(f,x,y,fmtU,4);
  f.svg.append('path').datum(ii).attr('fill',col('--s3')).attr('opacity',.16)
    .attr('d',d3.area().x(i=>x(ST.W[i])).y0(i=>y(lo[i])).y1(i=>y(hi[i])).curve(d3.curveMonotoneX));
  f.svg.append('path').datum(ii).attr('fill','none').attr('stroke',col('--s3')).attr('stroke-width',2)
    .attr('d',d3.line().x(i=>x(ST.W[i])).y(i=>y(v[i])).curve(d3.curveMonotoneX));
  const last=ii[ii.length-1];
  f.svg.append('circle').attr('cx',x(ST.W[last])).attr('cy',y(v[last])).attr('r',4)
    .attr('fill',col('--s3')).attr('stroke',css('--surface')).attr('stroke-width',2);
  f.svg.append('text').attr('class','dl').attr('x',x(ST.W[last])-4).attr('y',y(v[last])-10)
    .attr('text-anchor','end').style('fill',css('--ink')).style('font-weight',700).text(fmtU(v[last]));
  legend(c.querySelector('.legend'),[['e',col('--s3'),'Estimativa'],['b',css('--ink-3'),'Faixa piso a teto']]);
  crosshair(f,x,ii,(i)=>`<div class="t">${ST.GRAN==="mes"?"mês de":"semana de"} ${fPer(ST.W[i])}${ST.GRAN==="mes"?` · ${ST.SEMANAS_POR_BUCKET[i]} semanas`:""}</div>`+
    tipRow(col('--s3'),'Estimativa',fmtU(v[i]))+
    tipRow('transparent','Piso (tudo prompt)',fmtU(lo[i]))+
    tipRow('transparent','Teto (tudo completion)',fmtU(hi[i]))+
    tipRow('transparent','Preço efetivo',`US$ ${br(d3.format('.2f')(D.preco_efetivo[i]))} / 1M tokens`));
  table(c.querySelector('.tbl'),[rotPer(),'Estimativa','Piso','Teto','US$/1M tokens'],
    ii.map(i=>[fPer(ST.W[i]),fmtU(v[i]),fmtU(lo[i]),fmtU(hi[i]),br(d3.format('.2f')(D.preco_efetivo[i]))]));
}

// Volume x dinheiro: duas barras por lab, no MESMO eixo percentual. Nunca dois
// eixos: a comparacao so vale porque as duas medidas estao na mesma escala.
function vsMoney(name){
  const c=card(name), plot=c.querySelector('.plot');
  const rows=(D.volume_vs_dinheiro||[]).filter(r=>r.share_tokens>=0.5).slice(0,10);
  if(!rows.length) return vazio(name,'Sem laboratórios com preço no recorte atual.');
  const h=Math.max(200, rows.length*38+40);
  const f=frame(plot, h, {t:8,r:120,b:26,l:96});
  const max=d3.max(rows,r=>Math.max(r.share_tokens,r.share_gasto))*1.12;
  const x=d3.scaleLinear().domain([0,max]).range([f.m.l,f.w-f.m.r]);
  const y=d3.scaleBand().domain(rows.map(r=>r.lab)).range([f.m.t,f.h-f.m.b]).paddingInner(.35);
  f.svg.append('g').attr('class','grid').selectAll('line').data(x.ticks(5)).join('line')
    .attr('x1',x).attr('x2',x).attr('y1',f.m.t).attr('y2',f.h-f.m.b);
  f.svg.append('g').attr('class','ax').selectAll('text').data(x.ticks(5)).join('text')
    .attr('x',x).attr('y',f.h-f.m.b+16).attr('text-anchor','middle').text(d=>d+'%');
  f.svg.append('g').attr('class','ax').selectAll('text.l').data(rows).join('text')
    .attr('x',f.m.l-8).attr('y',r=>y(r.lab)+y.bandwidth()/2+4).attr('text-anchor','end')
    .style('fill',css('--ink-2')).text(r=>VENDOR_LABEL[r.lab]||capital(r.lab));
  const bh=y.bandwidth()/2-1;
  const t_=tip(plot);
  rows.forEach(r=>{
    [[r.share_tokens,'--s1',0],[r.share_gasto,'--s2',bh+2]].forEach(([v,slot,dy])=>{
      f.svg.append('rect').attr('x',f.m.l).attr('y',y(r.lab)+dy).attr('width',Math.max(2,x(v)-f.m.l))
        .attr('height',bh).attr('rx',3).attr('fill',col(slot));
    });
    const razao=r.razao;
    f.svg.append('text').attr('class','dl').attr('x',f.w-f.m.r+8).attr('y',y(r.lab)+y.bandwidth()/2+4)
      .style('fill',razao>=1.3?css('--ink'):css('--ink-3')).style('font-weight',razao>=1.3?700:500)
      .text(razao==null?'—':`${br(razao.toFixed(2))}×`);
    f.svg.append('rect').attr('x',f.m.l).attr('y',y(r.lab)-3).attr('width',f.w-f.m.l-f.m.r)
      .attr('height',y.bandwidth()+6).attr('fill','transparent')
      .on('mousemove',ev=>{const [mx,my]=d3.pointer(ev); const sx=plot.getBoundingClientRect().width/f.w;
        showTip(t_,plot,mx*sx,my*sx,`<div class="t">${VENDOR_LABEL[r.lab]||capital(r.lab)}</div>`+
          tipRow(col('--s1'),'Share de tokens',fmtP(r.share_tokens))+
          tipRow(col('--s2'),'Share do gasto',fmtP(r.share_gasto))+
          tipRow('transparent','Razão dinheiro/volume',razao==null?'—':razao.toFixed(2)));})
      .on('mouseleave',()=>t_.style.display='none');
  });
  f.svg.append('text').attr('class','ax').attr('x',f.w-f.m.r+8).attr('y',f.m.t-2)
    .style('fill',css('--ink-3')).text('dinheiro/volume');
  legend(c.querySelector('.legend'),[['t',col('--s1'),'Share de tokens'],['g',col('--s2'),'Share do gasto estimado']]);
  table(c.querySelector('.tbl'),['Laboratório','Share de tokens','Share do gasto','Razão'],
    rows.map(r=>[VENDOR_LABEL[r.lab]||capital(r.lab),fmtP(r.share_tokens),fmtP(r.share_gasto),r.razao==null?'—':br(r.razao.toFixed(2))]));
}

// ===========================================================================
// Seção 07: qualidade contra adoção
// ===========================================================================
ST.QX='aa';
function quality(name){
  const c=card(name), plot=c.querySelector('.plot');
  const campo=ST.QX==='aa'?'aa':'preco';
  const pts=(D.qualidade||[]).filter(r=>r[campo]!=null && r.share>0);
  const cobertura=(D.qualidade||[]).filter(r=>r.share>0);
  const base = ST.QX==='aa'
    ? 'Índice de Inteligência da Artificial Analysis, exposto pela API do OpenRouter.'
    : 'Preço misto por 1M de tokens contra adoção.';
  const atributo = ST.QX==='aa' ? 'o índice' : 'preço';
  // Frase condicional ao que existe no recorte. "0 de 0 modelos têm o índice"
  // e a mesma classe de bug que os paineis de leitura tinham: texto que assume
  // um fato que o filtro pode remover.
  document.getElementById('qual-sub').textContent =
    cobertura.length===0 ? `${base} Nenhum modelo com volume no recorte atual.`
    : pts.length===0     ? `${base} Nenhum dos ${cobertura.length} modelos do recorte tem ${atributo} publicado.`
    : `${base} ${pts.length} de ${cobertura.length} modelos da última semana têm ${atributo}.`;
  if(pts.length<4) return vazio(name, pts.length
    ? `Apenas ${pts.length} ${pts.length===1?'modelo tem':'modelos têm'} esse atributo no recorte atual: poucos pontos para um gráfico de dispersão. A tabela abaixo continua disponível.`
    : 'Nenhum modelo do recorte atual tem esse atributo publicado.');

  const f=frame(plot, 400, {t:34,r:24,b:40,l:54});
  const xd=d3.extent(pts,r=>r[campo]);
  const x = ST.QX==='preco'
    ? d3.scaleLog().domain([Math.max(0.01,xd[0]*.8), xd[1]*1.2]).range([f.m.l,f.w-f.m.r])
    : d3.scaleLinear().domain([xd[0]-2, xd[1]+2]).range([f.m.l,f.w-f.m.r]);
  const y=d3.scaleLinear().domain([0, d3.max(pts,r=>r.share)*1.1]).nice().range([f.h-f.m.b,f.m.t]);
  const r=d3.scaleSqrt().domain([0,d3.max(pts,p=>p.T)]).range([3,20]);

  f.svg.append('g').attr('class','grid').selectAll('line').data(y.ticks(4)).join('line')
    .attr('x1',f.m.l).attr('x2',f.w-f.m.r).attr('y1',y).attr('y2',y);
  f.svg.append('g').attr('class','ax').selectAll('text').data(y.ticks(4)).join('text')
    .attr('x',f.m.l-8).attr('y',d=>y(d)+4).attr('text-anchor','end').text(d=>fmtNum(d,2)+'%');
  // Escala log com `ticks(5)` devolve dezenas de marcas e os rotulos viram
  // "$0,03$0,04$0,05". Geramos a serie 1-2-5 por decada e descartamos tudo que
  // ficaria a menos de 46px do rotulo anterior.
  let xt;
  if(ST.QX==='preco'){
    const [lo,hi]=x.domain(); const cand=[];
    for(let e=-3;e<=3;e++) for(const m of [1,2,5]){ const v=m*Math.pow(10,e); if(v>=lo&&v<=hi) cand.push(v); }
    xt=[]; let ultimo=-1e9;
    cand.forEach(v=>{ if(x(v)-ultimo>=46){ xt.push(v); ultimo=x(v); } });
  } else xt=x.ticks(6);
  const rotX=d=>ST.QX!=='preco' ? fmtNum(d,2)
    : '$'+(d>=1 ? br(d3.format('~f')(d)) : d.toFixed(d<0.1?3:2).replace(/0+$/,'').replace(/\.$/,'').replace('.',','));
  f.svg.append('g').attr('class','ax').selectAll('text').data(xt).join('text')
    .attr('x',x).attr('y',f.h-f.m.b+18).attr('text-anchor','middle').text(rotX);
  // marca de grade vertical ajuda a ler a escala log, que nao e intuitiva
  f.svg.append('g').attr('class','grid').selectAll('line').data(xt).join('line')
    .attr('x1',x).attr('x2',x).attr('y1',f.m.t).attr('y2',f.h-f.m.b).attr('opacity',.55);
  f.svg.append('text').attr('class','ax').attr('x',(f.m.l+f.w-f.m.r)/2).attr('y',f.h-4)
    .attr('text-anchor','middle').style('fill',css('--ink-3'))
    .text(ST.QX==='aa'?'Índice de Inteligência →':'US$ por 1M de tokens (escala log) →');

  // linhas de mediana: dividem o plano em quadrantes de leitura
  const mx=d3.median(pts,p=>p[campo]), my=d3.median(pts,p=>p.share);
  [[x(mx),f.m.t,x(mx),f.h-f.m.b],[f.m.l,y(my),f.w-f.m.r,y(my)]].forEach(([a,b,cc,dd])=>
    f.svg.append('line').attr('x1',a).attr('y1',b).attr('x2',cc).attr('y2',dd)
      .attr('stroke',css('--axis')).attr('stroke-dasharray','4 4').attr('opacity',.7));
  const quad=(tx,ty,txt,anchor)=>f.svg.append('text').attr('class','ax').attr('x',tx).attr('y',ty)
    .attr('text-anchor',anchor).style('fill',css('--ink-3')).style('font-size','10.5px').text(txt);
  if(ST.QX==='aa'){
    quad(f.m.l+4, f.m.t-16, 'índice abaixo da mediana, muito usado','start');
    quad(f.w-f.m.r-4, f.m.t-16, 'índice acima da mediana, muito usado','end');
  } else {
    quad(f.m.l+4, f.m.t-16, 'mais barato que a mediana, muito usado','start');
    quad(f.w-f.m.r-4, f.m.t-16, 'mais caro que a mediana, muito usado','end');
  }


  const t_=tip(plot);
  const oslot=p=>ORIGIN_SLOT[p.origin]||'--s0';
  const g=f.svg.append('g').selectAll('circle').data(pts.slice().sort((a,b)=>b.T-a.T)).join('circle')
    .attr('cx',p=>x(p[campo])).attr('cy',p=>y(p.share)).attr('r',p=>r(p.T))
    .attr('fill',p=>col(oslot(p))).attr('opacity',.62)
    .attr('stroke',css('--surface')).attr('stroke-width',2)
    .on('mousemove',(ev,p)=>{const [mx2,my2]=d3.pointer(ev); const sx=plot.getBoundingClientRect().width/f.w;
      showTip(t_,plot,mx2*sx,my2*sx,`<div class="t">${p.slug}</div>`+
        tipRow(col(oslot(p)),'Origem',p.origin)+
        tipRow('transparent','Share',fmtP(p.share))+
        tipRow('transparent','Tokens/semana',fmtT(p.T))+
        (p.aa!=null?tipRow('transparent','Inteligência',fmtNum(p.aa,2)):'')+
        (p.elo!=null?tipRow('transparent','Elo (arena de modelos)',Math.round(p.elo)):'')+
        (p.preco!=null?tipRow('transparent','Preço /1M',fmtUSD(p.preco)):'')+
        (p.ctx?tipRow('transparent','Contexto',fmtCtx(p.ctx)):'')+
        (p.lanc?tipRow('transparent','Lançamento',p.lanc):''));})
    .on('mouseleave',()=>t_.style.display='none');

  // rotulo direto so nos 4 maiores: mais que isso vira sopa de texto
  // Rotulo curto, mas mantendo a data quando dois modelos do mesmo nome estao
  // no grafico: "deepseek-v4-flash" duas vezes nao identifica nada.
  const curto=s=>s.split('/')[1].replace(/-20\d{6}$/,'');
  const maiores=pts.slice().sort((a,b)=>b.share-a.share).slice(0,5);
  const conta={}; pts.forEach(p=>{const k=curto(p.slug); conta[k]=(conta[k]||0)+1;});
  const postos=[];
  maiores.forEach(p=>{
    const base=curto(p.slug);
    const dt=(p.slug.match(/-20(\d{6})$/)||[])[1];
    const rot=((conta[base]>1&&dt)? `${base} ${dt.slice(2,4)}/${dt.slice(4,6)}` : base).slice(0,26);
    const larg=rot.length*5.6;
    let px=x(p[campo]), py=y(p.share)-r(p.T)-7, anchor='middle';
    // empurra para cima enquanto colidir com um rotulo ja colocado
    let voltas=0;
    while(postos.some(q=>Math.abs(q.x-px)<(q.larg+larg)/2 && Math.abs(q.y-py)<13) && voltas++<6) py-=13;
    // e mantem dentro da area util
    if(px-larg/2<f.m.l){ px=f.m.l; anchor='start'; }
    if(px+larg/2>f.w-f.m.r){ px=f.w-f.m.r; anchor='end'; }
    if(py<f.m.t+9) py=f.m.t+9;
    postos.push({x:px,y:py,larg});
    f.svg.append('text').attr('class','dl').attr('x',px).attr('y',py)
      .attr('text-anchor',anchor).style('fill',css('--ink-2')).text(rot);
  });

  legend(c.querySelector('.legend'),
    [...new Set(pts.map(p=>p.origin))].map(o=>[o,col(ORIGIN_SLOT[o]||'--s0'),o])
      .concat([['t',css('--ink-3'),'tamanho da bolha: tokens na semana']]));
  table(c.querySelector('.tbl'),['Modelo','Origem','Share','Tokens/sem','Inteligência','Elo','US$/1M','Contexto','Lançamento'],
    pts.slice().sort((a,b)=>b.share-a.share).map(p=>[p.slug,p.origin,fmtP(p.share),fmtT(p.T),
      p.aa??'—',p.elo?Math.round(p.elo):'—',fmtUSD(p.preco),fmtCtx(p.ctx),p.lanc||'—']));
}

// ===========================================================================
// Seção 08: o que mudou
// ===========================================================================
function mudou(name){
  const c=card(name), plot=c.querySelector('.plot'), M=D.mudancas;
  if(!M) return vazio(name,'Sem dados de variação.');
  document.getElementById('mudou-sub').textContent=
    `Semana de ${fD(new Date(M.semana+'T00:00:00'))} contra a de ${fD(new Date(M.comparada+'T00:00:00'))}`;
  // Rotulo do grupo e conteudo estavam na mesma familia e no mesmo peso, e o
  // olho nao separava um do outro. Agora o grupo tem regua colorida e contagem
  // propria; o item e monoespacado com o numero alinhado a direita.
  const bloco=(titulo,cor,itens,total)=>
    `<div class="mgrupo" style="--mc:${cor}">`+
    `<div class="mtit"><span class="mrot">${titulo}</span><span class="mn">${total??itens.length}</span></div>`+
    (itens.length
      ? `<ul class="mlista">`+itens.map(([nome,val])=>
          `<li><span class="mono">${nome}</span>${val?`<b>${val}</b>`:''}</li>`).join('')+`</ul>`
      : `<div class="mvazio">nenhum</div>`)+`</div>`;
  plot.innerHTML =
    bloco('Entraram no top 10', css('--good'), M.entraram.map(s=>[s,'']))+
    bloco('Saíram do top 10', css('--bad'), M.sairam.map(s=>[s,'']))+
    bloco('Estrearam no ranking', css('--accent'),
          M.estreantes.map(e=>[e.s, fmtP(e.share)]), M.n_estreantes)+
    (M.n_estreantes>M.estreantes.length
      ? `<div class="mvazio">mostrando os ${M.estreantes.length} maiores, de ${M.n_estreantes}</div>` : '');
}

function varia(name){
  const c=card(name), plot=c.querySelector('.plot'), M=D.mudancas;
  if(!M) return vazio(name,'Sem dados de variação.');
  const sub=document.getElementById('varia-sub');
  if(sub) sub.textContent=`Diferença em pontos percentuais nos últimos ${M.distancia||0} `+
    ((M.distancia||0)===1?(ST.GRAN==='mes'?'mês':'semana'):(ST.GRAN==='mes'?'meses':'semanas'));
  const rows=[...M.subiram, ...M.cairam.slice().reverse()]
    .filter((r,i,a)=>a.findIndex(z=>z.s===r.s)===i);
  if(!rows.length) return vazio(name,'Nenhuma variação relevante no recorte atual.');
  const h=Math.max(200, rows.length*26+46);
  const f=frame(plot, h, {t:10,r:56,b:26,l:8});
  const m=d3.max(rows,r=>Math.abs(r.delta))*1.15;
  const x=d3.scaleLinear().domain([-m,m]).range([f.m.l+130, f.w-f.m.r]);
  const y=d3.scaleBand().domain(rows.map(r=>r.s)).range([f.m.t,f.h-f.m.b]).paddingInner(.3);
  const zero=x(0);
  f.svg.append('line').attr('x1',zero).attr('x2',zero).attr('y1',f.m.t).attr('y2',f.h-f.m.b)
    .attr('stroke',css('--axis'));
  f.svg.append('g').attr('class','ax').selectAll('text').data(x.ticks(5)).join('text')
    .attr('x',x).attr('y',f.h-f.m.b+16).attr('text-anchor','middle')
    .text(d=>(d>0?'+':'')+br(d3.format('.1f')(d))+'pp');
  rows.forEach(r=>{
    const sobe=r.delta>=0;
    f.svg.append('rect').attr('x',sobe?zero:x(r.delta)).attr('y',y(r.s))
      .attr('width',Math.max(2,Math.abs(x(r.delta)-zero))).attr('height',y.bandwidth()).attr('rx',3)
      .attr('fill',sobe?col('--s3'):col('--s2'));
    f.svg.append('text').attr('class','ax').attr('x',f.m.l).attr('y',y(r.s)+y.bandwidth()/2+4)
      .style('fill',css('--ink-2')).style('font-family','"DM Mono",monospace').style('font-size','11px')
      .text(r.s.replace(/-20\d{6}$/,'').slice(0,30));
    f.svg.append('text').attr('class','dl').attr('x',sobe?x(r.delta)+6:x(r.delta)-6)
      .attr('y',y(r.s)+y.bandwidth()/2+4).attr('text-anchor',sobe?'start':'end')
      .style('fill',css('--ink-2')).text((sobe?'+':'')+r.delta.toFixed(1).replace('.',',')+'pp');
  });
  table(c.querySelector('.tbl'),['Modelo','Share há 4 semanas','Share agora','Variação'],
    rows.map(r=>[r.s,fmtP(r.de),fmtP(r.para),(r.delta>=0?'+':'')+r.delta.toFixed(2).replace('.',',')+'pp']));
}

// ===========================================================================
// Seção 09: comparador
// ===========================================================================
ST.CMP=[null,null];
function comparador(){
  const c=card('comparar'), plot=c.querySelector('.plot');
  const cand=(D.qualidade||[]).slice(0,80);
  if(cand.length<2) return vazio('comparar','Poucos modelos no recorte atual para comparar.');
  if(!ST.CMP[0]||!cand.find(r=>r.slug===ST.CMP[0])) ST.CMP[0]=cand[0].slug;
  if(!ST.CMP[1]||!cand.find(r=>r.slug===ST.CMP[1])) ST.CMP[1]=(cand[1]||cand[0]).slug;

  // Campo de busca em vez de select: com 80 modelos, rolar uma lista suspensa e
  // pior do que digitar tres letras. datalist e nativo, acessivel e funciona sem
  // biblioteca. Ordem alfabetica, porque a busca ja resolve encontrar o maior.
  const sel=document.getElementById('cmp-sel');
  const alfab=cand.slice().sort((a,b)=>a.slug.localeCompare(b.slug));
  // O datalist nativo so casa PREFIXO do valor. Como todo slug comeca pelo lab
  // ("anthropic/", "openai/"), digitar "sonnet" nao trazia nada e o campo
  // parecia quebrado. Esta lista e propria: casa em qualquer posicao, aceita
  // varias palavras soltas, navega por teclado e mostra o share de cada um.
  const campo=(id,val,rot)=>
    `<div class="cbx"><label for="${id}">${rot}</label>`+
    `<input id="${id}" value="${val}" role="combobox" aria-expanded="false" aria-autocomplete="list" `+
    `aria-controls="${id}-lista" autocomplete="off" spellcheck="false" `+
    `placeholder="digite para buscar, ex.: sonnet"><ul id="${id}-lista" class="cbx-lista" role="listbox" hidden></ul></div>`;
  sel.innerHTML=campo('cmpA',ST.CMP[0],'Modelo A')+campo('cmpB',ST.CMP[1],'Modelo B');

  ['cmpA','cmpB'].forEach((id,k)=>{
    const inp=sel.querySelector('#'+id), lista=sel.querySelector('#'+id+'-lista');
    let foco=-1, atuais=[];
    const filtrar=q=>{
      const termos=q.toLowerCase().split(/\s+/).filter(Boolean);
      const base=termos.length? alfab.filter(r=>termos.every(t=>r.slug.toLowerCase().includes(t))) : alfab;
      return base.slice(0,60);
    };
    const pintar=()=>{
      lista.innerHTML=atuais.map((r,i)=>
        `<li role="option" id="${id}-o${i}" aria-selected="${i===foco}" class="${i===foco?'on':''}" data-slug="${r.slug}">`+
        `<span class="mono">${r.slug}</span><span class="sh">${fmtP(r.share)}</span></li>`).join('')
        || `<li class="vazio">nenhum modelo com esse termo</li>`;
      if(foco>=0) lista.children[foco]?.scrollIntoView({block:'nearest'});
    };
    const abrirL=q=>{ atuais=filtrar(q==null?'':q); foco=-1; pintar();
      lista.hidden=false; inp.setAttribute('aria-expanded','true'); };
    const fecharL=()=>{ lista.hidden=true; inp.setAttribute('aria-expanded','false'); inp.removeAttribute('aria-activedescendant'); };
    const escolher=slug=>{ if(!slug) return; inp.value=slug; fecharL();
      if(slug!==ST.CMP[k]){ ST.CMP[k]=slug; comparador(); } };

    inp.addEventListener('focus',()=>abrirL(''));
    inp.addEventListener('input',()=>abrirL(inp.value));
    inp.addEventListener('keydown',e=>{
      if(e.key==='ArrowDown'||e.key==='ArrowUp'){
        e.preventDefault(); if(lista.hidden) return abrirL(inp.value);
        foco=Math.max(0,Math.min(atuais.length-1, foco+(e.key==='ArrowDown'?1:-1)));
        inp.setAttribute('aria-activedescendant',`${id}-o${foco}`); pintar();
      } else if(e.key==='Enter'){
        e.preventDefault();
        escolher(foco>=0? atuais[foco]?.slug : (atuais[0]?.slug));
      } else if(e.key==='Escape'){ fecharL(); inp.value=ST.CMP[k]; }
    });
    // mousedown, nao click: o blur do input dispararia antes do click
    lista.addEventListener('mousedown',e=>{
      const li=e.target.closest('li[data-slug]'); if(!li) return;
      e.preventDefault(); escolher(li.dataset.slug);
    });
    inp.addEventListener('blur',()=>setTimeout(()=>{ fecharL();
      if(!cand.some(r=>r.slug===inp.value)) inp.value=ST.CMP[k]; },120));
  });

  const iA=MX.modelos.findIndex(m=>m.s===ST.CMP[0]), iB=MX.modelos.findIndex(m=>m.s===ST.CMP[1]);
  const A=cand.find(r=>r.slug===ST.CMP[0]), B=cand.find(r=>r.slug===ST.CMP[1]);
  const sA=ST.SERIES[iA], sB=ST.SERIES[iB];
  const totS=D.weekly_total_T.map(v=>v*1e6);
  const shA=sA.map((v,w)=>totS[w]?100*v/totS[w]:0), shB=sB.map((v,w)=>totS[w]?100*v/totS[w]:0);
  const picoA=d3.max(shA), picoB=d3.max(shB);

  const linha=(rot,a,b,melhor)=>{
    const marca=(v,ehMelhor)=>`<b${ehMelhor?' class="cmp-win"':''}>${v}</b>`;
    // So destaca vencedor quando a diferenca e visivel no proprio texto. Marcar
    // 1048576 como melhor que 1050000, ambos exibidos como "1M", seria ruido.
    let ma=false,mb=false;
    if(a.n!=null&&b.n!=null&&a.t!==b.t){
      if(melhor==='maior'){ ma=a.n>b.n; mb=b.n>a.n; }
      if(melhor==='menor'){ ma=a.n<b.n; mb=b.n<a.n; }
    }
    return `<div class="cmp-row"><span class="lbl">${rot}</span>${marca(a.t,ma)}${marca(b.t,mb)}</div>`;
  };
  const nn=v=>v==null?{t:'—',n:null}:{t:fmtNum(v,2),n:v};
  document.getElementById('cmp-grid').innerHTML=
    `<div class="cmp-row"><span class="lbl">Modelo</span><b class="mono">${A.slug}</b><b class="mono">${B.slug}</b></div>`+
    linha('Share atual',{t:fmtP(A.share),n:A.share},{t:fmtP(B.share),n:B.share},'maior')+
    linha('Tokens por semana',{t:fmtT(A.T),n:A.T},{t:fmtT(B.T),n:B.T},'maior')+
    linha('Pico de share',{t:fmtP(picoA),n:picoA},{t:fmtP(picoB),n:picoB},'maior')+
    linha('Preço por 1M',{t:fmtUSD(A.preco),n:A.preco},{t:fmtUSD(B.preco),n:B.preco},'menor')+
    linha('Índice de inteligência',nn(A.aa),nn(B.aa),'maior')+
    linha('Elo (arena de modelos)',nn(A.elo?Math.round(A.elo):null),nn(B.elo?Math.round(B.elo):null),'maior')+
    linha('Janela de contexto',{t:fmtCtx(A.ctx),n:A.ctx},{t:fmtCtx(B.ctx),n:B.ctx},'maior')+
    `<div class="cmp-row"><span class="lbl">Origem</span><b>${A.origin}</b><b>${B.origin}</b></div>`+
    `<div class="cmp-row"><span class="lbl">Pesos</span><b>${A.pesos}</b><b>${B.pesos}</b></div>`+
    `<div class="cmp-row"><span class="lbl">Lançamento</span><b>${A.lanc||'—'}</b><b>${B.lanc||'—'}</b></div>`;

  const ii=idx(), f=frame(plot, 240, {t:14,r:16,b:30,l:44});
  const x=xScale(f,ii), y=d3.scaleLinear().domain([0,Math.max(picoA,picoB)*1.12||1]).nice().range([f.h-f.m.b,f.m.t]);
  axes(f,x,y,v=>v+'%');
  [[shA,'--s1',A.slug],[shB,'--s2',B.slug]].forEach(([s,slot])=>
    f.svg.append('path').datum(ii).attr('fill','none').attr('stroke',col(slot)).attr('stroke-width',2.2)
      .attr('d',d3.line().x(i=>x(ST.W[i])).y(i=>y(s[i])).curve(d3.curveMonotoneX)));
  legend(c.querySelector('.legend'),[[A.slug,col('--s1'),A.slug],[B.slug,col('--s2'),B.slug]]);
  crosshair(f,x,ii,(i)=>`<div class="t">${ST.GRAN==="mes"?"mês de":"semana de"} ${fPer(ST.W[i])}${ST.GRAN==="mes"?` · ${ST.SEMANAS_POR_BUCKET[i]} semanas`:""}</div>`+
    tipRow(col('--s1'),A.slug,fmtP(shA[i]))+tipRow(col('--s2'),B.slug,fmtP(shB[i])));
}

// ===========================================================================
// Seção 10: O mapa da temporada
// ===========================================================================
ST.MAPA_MODO='recursos';
const ROT_PESO={share:'Share de tokens',gasto:'Share do gasto',cresc:'Crescimento de share',
                ctx:'Janela de contexto',multi:'Multimodalidade',rac:'Suporte a raciocínio',
                ampl:'Amplitude do catálogo',cad:'Cadência de lançamento'};

function mapa(name){
  const c=card(name), plot=c.querySelector('.plot'), M=D.mapa;
  if(!M || !M.labs.length) return vazio(name,'Nenhum laboratório com volume no recorte atual.');
  const modo=ST.MAPA_MODO;
  let labs=M.labs.map(o=>({...o, x: modo==='indice'? o.xAA : o.xRec}));
  const semX=labs.filter(o=>o.x==null);
  labs=labs.filter(o=>o.x!=null);
  const per=M.periodos_atras, unid=per===1?(ST.GRAN==='semana'?'semana':'mês'):(ST.GRAN==='semana'?'semanas':'meses');

  document.getElementById('mapa-sub').innerHTML = modo==='recursos'
    ? `Posição relativa entre os <b>${M.total}</b> laboratórios com volume. Vertical: tração, do share de tokens, do gasto e do crescimento. Horizontal: capacidade declarada, da janela de contexto, multimodalidade, raciocínio, amplitude do catálogo e cadência de lançamento. O rastro mostra onde cada um estava ${per} ${unid} atrás.`
    : `Vertical: tração. Horizontal: melhor Índice de Inteligência do catálogo do laboratório. <b>${M.com_indice} de ${M.total}</b> laboratórios têm ao menos um modelo com índice publicado; os demais ficam fora deste modo.`;

  if(labs.length<3) return vazio(name, modo==='indice'
    ? 'Menos de três laboratórios do recorte têm modelo com índice publicado.'
    : 'Poucos laboratórios no recorte atual.');

  const f=frame(plot, 460, {t:22,r:26,b:44,l:52});
  const x=d3.scaleLinear().domain([0,100]).range([f.m.l,f.w-f.m.r]);
  const y=d3.scaleLinear().domain([0,100]).range([f.h-f.m.b,f.m.t]);
  const r=d3.scaleSqrt().domain([0,d3.max(labs,o=>o.tokens)]).range([5,26]);

  // grade e eixos em percentil
  [0,25,50,75,100].forEach(v=>{
    f.svg.append('line').attr('class','grid').attr('x1',f.m.l).attr('x2',f.w-f.m.r).attr('y1',y(v)).attr('y2',y(v));
    f.svg.append('text').attr('class','ax').attr('x',f.m.l-8).attr('y',y(v)+4).attr('text-anchor','end').text(v);
    f.svg.append('text').attr('class','ax').attr('x',x(v)).attr('y',f.h-f.m.b+18).attr('text-anchor','middle').text(v);
  });
  // linhas do quadrante na mediana, que em percentil e sempre 50
  [[x(50),f.m.t,x(50),f.h-f.m.b],[f.m.l,y(50),f.w-f.m.r,y(50)]].forEach(([a,b,cc,d])=>
    f.svg.append('line').attr('x1',a).attr('y1',b).attr('x2',cc).attr('y2',d)
      .attr('stroke',css('--axis')).attr('stroke-width',1.5));

  const quad=(px,py,txt,anchor)=>f.svg.append('text').attr('class','ax').attr('x',px).attr('y',py)
    .attr('text-anchor',anchor).style('fill',css('--ink-3')).style('font-size','11px')
    .style('letter-spacing','.05em').style('text-transform','uppercase').text(txt);
  quad(f.w-f.m.r-6, f.m.t+13, 'Líderes', 'end');
  quad(f.m.l+6,     f.m.t+13, 'Desafiantes', 'start');
  quad(f.w-f.m.r-6, f.h-f.m.b-8, 'Promessas', 'end');
  quad(f.m.l+6,     f.h-f.m.b-8, 'Nichados', 'start');
  f.svg.append('text').attr('class','ax').attr('x',(f.m.l+f.w-f.m.r)/2).attr('y',f.h-6)
    .attr('text-anchor','middle').style('fill',css('--ink-3'))
    .text(modo==='indice' ? 'percentil do Índice de Inteligência →' : 'percentil de capacidade declarada →');
  f.svg.append('text').attr('class','ax').attr('transform',`rotate(-90) translate(${-(f.m.t+f.h-f.m.b)/2}, 14)`)
    .attr('text-anchor','middle').style('fill',css('--ink-3')).text('percentil de tração →');

  // Rastro apenas dos oito maiores. Percentil de lab minusculo oscila muito por
  // ruido, e vinte linhas tracejadas cruzando o plano escondem o que importa.
  const comRastro=new Set(labs.slice().sort((a,b)=>b.tokens-a.tokens).slice(0,8).map(o=>o.lab));
  labs.filter(o=>comRastro.has(o.lab)).forEach(o=>{
    const a=M.antes[o.lab]; if(!a) return;
    const ax=modo==='indice'? a.xAA : a.x; if(ax==null) return;
    if(Math.abs(ax-o.x)<3 && Math.abs(a.y-o.y)<3) return;
    // A linha para na borda da bolha, senao parece que atravessa o marcador.
    const dx=x(o.x)-x(ax), dy=y(o.y)-y(a.y), d=Math.hypot(dx,dy)||1, rr=r(o.tokens)+2;
    f.svg.append('line').attr('x1',x(ax)).attr('y1',y(a.y))
      .attr('x2',x(o.x)-dx/d*rr).attr('y2',y(o.y)-dy/d*rr)
      .attr('stroke',col(ORIGIN_SLOT[o.origem]||'--s0')).attr('stroke-width',1.4)
      .attr('opacity',.5).attr('stroke-dasharray','3 3').attr('stroke-linecap','round');
    f.svg.append('circle').attr('cx',x(ax)).attr('cy',y(a.y)).attr('r',3)
      .attr('fill','none').attr('stroke',col(ORIGIN_SLOT[o.origem]||'--s0'))
      .attr('stroke-width',1.4).attr('opacity',.55);
  });

  const t_=tip(plot);
  const pc=v=>Math.round(v)+'º';
  f.svg.append('g').selectAll('circle.b').data(labs.slice().sort((a,b)=>b.tokens-a.tokens)).join('circle')
    .attr('class','b').attr('cx',o=>x(o.x)).attr('cy',o=>y(o.y)).attr('r',o=>r(o.tokens))
    .attr('fill',o=>col(ORIGIN_SLOT[o.origem]||'--s0')).attr('opacity',.48)
    .attr('stroke',o=>col(ORIGIN_SLOT[o.origem]||'--s0')).attr('stroke-width',1.6)
    .style('cursor','pointer')
    .on('mouseover',function(){ d3.select(this).attr('opacity',.85).raise(); })
    .on('mouseout',function(){ d3.select(this).attr('opacity',.48); })
    .on('mousemove',(ev,o)=>{const [mx,my]=d3.pointer(ev); const sx=plot.getBoundingClientRect().width/f.w;
      const comp = modo==='indice'
        ? tipRow('transparent','Melhor Índice de Inteligência', fmtNum(o.aa,2))
        : ['ctx','multi','rac','ampl','cad'].map(k=>tipRow('transparent',ROT_PESO[k],pc(o.pct[k]))).join('');
      showTip(t_,plot,mx*sx,my*sx,
        `<div class="t">${VENDOR_LABEL[o.lab]||capital(o.lab)}</div>`+
        tipRow(col(ORIGIN_SLOT[o.origem]||'--s0'),'Origem',o.origem)+
        tipRow('transparent','Tração (percentil)',pc(o.y))+
        tipRow('transparent','Capacidade (percentil)',pc(o.x))+
        `<div class="r" style="opacity:.7;margin-top:4px"><span>decomposição</span><b></b></div>`+
        tipRow('transparent',ROT_PESO.share,pc(o.pct.share))+
        tipRow('transparent',ROT_PESO.gasto,pc(o.pct.gasto))+
        tipRow('transparent',ROT_PESO.cresc,pc(o.pct.cresc))+comp+
        `<div class="r" style="opacity:.7;margin-top:4px"><span>valores</span><b></b></div>`+
        tipRow('transparent','Share de tokens',fmtP(o.share))+
        tipRow('transparent','Share do gasto',fmtP(o.shareG))+
        tipRow('transparent','Modelos com volume',o.ampl));})
    .on('mouseleave',()=>t_.style.display='none');

  // rotulo em todos: 19 laboratorios cabem com desvio vertical simples
  const usados=[];
  labs.slice().sort((a,b)=>b.tokens-a.tokens).forEach(o=>{
    let py=y(o.y)-r(o.tokens)-7;
    while(usados.some(u=>Math.abs(u.x-x(o.x))<62 && Math.abs(u.y-py)<12)) py-=12;
    usados.push({x:x(o.x), y:py});
    f.svg.append('text').attr('class','dl').attr('x',x(o.x)).attr('y',py).attr('text-anchor','middle')
      .style('fill',css('--ink-2')).text(VENDOR_LABEL[o.lab]||capital(o.lab));
  });

  legend(c.querySelector('.legend'),
    [...new Set(labs.map(o=>o.origem))].map(o=>[o,col(ORIGIN_SLOT[o]||'--s0'),o])
      .concat([['r',css('--ink-3'),`rastro: posição ${per} ${unid} atrás (8 maiores)`]])
      .concat(semX.length? [['x',css('--ink-3'),`${semX.length} sem índice, fora deste modo`]] : []));

  montarPesos();
  table(c.querySelector('.tbl'),
    ['Laboratório','Origem','Tração','Capacidade','Share tokens','Share gasto','Cresc. (pp)','Modelos','Contexto','Índice'],
    labs.slice().sort((a,b)=>b.y-a.y).map(o=>[VENDOR_LABEL[o.lab]||capital(o.lab),o.origem,
      pc(o.y),pc(o.x),fmtP(o.share),fmtP(o.shareG),
      (o.cresc>=0?'+':'')+o.cresc.toFixed(2).replace('.',','),o.ampl,fmtCtx(o.ctx),o.aa??'—']));
}

// Pesos ajustaveis. O mapa combina componentes, e a escolha dos pesos e
// editorial. Deixar o leitor mexer transforma "confie em mim" em "veja voce
// mesmo", que e a diferenca entre uma ferramenta e uma consultoria.
function montarPesos(){
  const el=document.getElementById('pesos-body'); if(!el) return;
  const P=D.mapa.pesos;
  const linha=(g,k)=>`<label><span>${ROT_PESO[k]}</span>`+
    `<input type="range" min="0" max="50" step="5" value="${P[g][k]}" data-g="${g}" data-k="${k}" `+
    `aria-label="Peso de ${ROT_PESO[k]}"><b>${P[g][k]}</b></label>`;
  el.innerHTML=`<div class="g">Eixo vertical, tração</div>`+
    Object.keys(P.tracao).map(k=>linha('tracao',k)).join('')+
    `<div class="g">Eixo horizontal, capacidade declarada</div>`+
    Object.keys(P.cap).map(k=>linha('cap',k)).join('')+
    `<button class="reset" type="button">restaurar padrão</button>`;
  el.querySelectorAll('input[type=range]').forEach(inp=>inp.addEventListener('input',()=>{
    P[inp.dataset.g][inp.dataset.k]=+inp.value;
    inp.nextElementSibling.textContent=inp.value;
    recalcular(); mapa('mapa'); readings();
  }));
  el.querySelector('.reset').addEventListener('click',()=>{
    D._pesosMapa=JSON.parse(JSON.stringify(D.mapa.pesos_padrao));
    recalcular(); mapa('mapa'); readings();
  });
}

// Cada gráfico aponta para a entrada correspondente em "Como ler cada indicador".
// O texto vive num lugar só: duplicar a definição no card garante divergência
// assim que uma das duas for editada.

// Conteudo dos graficos: texto e indicadores vem de src/content, validados por
// schema no build. Nenhum texto de interface mora mais neste arquivo, entao
// revisar os 23 e ler 23 arquivos, e nao cacar dentro de 2.800 linhas.
const CONTEUDO = (() => {
  try { return JSON.parse(document.getElementById('conteudo-graficos').textContent); }
  catch { return {}; }
})();
const GRAFICO = CONTEUDO;
const EXPLICA = Object.fromEntries(Object.entries(CONTEUDO).map(([k, v]) => [k, v.indicadores]));
function acharVerbete(titulo){
  return [...document.querySelectorAll('#metodologia details')]
    .find(d=>d.querySelector('summary').textContent.trim()===titulo);
}
function montarExplicacoes(){
  document.querySelectorAll('.card[data-chart]').forEach(c=>{
    const alvos=EXPLICA[c.dataset.chart]; if(!alvos||!alvos.length) return;
    const h=c.querySelector('.card-h h3'); if(!h || h.querySelector('.expl')) return;
    const primeiro=acharVerbete(alvos[0]); if(!primeiro) return;
    // Pegar so os nos de texto perdia o <span data-per>, e o titulo virava
    // "Gasto  estimado". Clonar e tirar o proprio botao preserva tudo.
    const clone=h.cloneNode(true); clone.querySelector('.expl')?.remove();
    const titulo=clone.textContent.replace(/\s+/g,' ').trim();
    const resumo=(primeiro.querySelector('.body p')?.textContent||'').replace(/^o que é/i,'').trim();
    const b=document.createElement('button');
    b.type='button'; b.className='expl'; b.textContent='?';
    b.title=`Como ler "${titulo}": ${resumo.slice(0,200)}`;
    b.setAttribute('aria-label',`Como ler o gráfico ${titulo}. Abrir a explicação.`);
    // Rolar o leitor ate o fim da pagina para ler dois paragrafos e perder o
    // lugar. O painel abre por cima, com o nome deste grafico no topo.
    b.addEventListener('click',()=>{ abrirMetodologia(titulo, alvos, c.dataset.chart); });
    h.appendChild(b);
  });
}
// ===========================================================================
// Seção 11: sinais
// ===========================================================================
function sinais(name){
  const c=card(name), plot=c.querySelector('.plot'), S=D.sinais;
  const sub=document.getElementById('sinais-sub');
  if(!S || !S.achados.length){
    if(sub) sub.textContent='Nada fora do padrão nesta janela.';
    return vazio(name,'Nenhum achado nesta janela. Isso também é informação: o mercado está se movendo dentro do padrão dele.');
  }
  if(sub) sub.textContent=`${S.achados.length} ${S.achados.length===1?'padrão quebrado':'padrões quebrados'} nesta janela, detectados por regra, não por curadoria.`;
  plot.innerHTML=`<div class="sin">`+S.achados.map(a=>
    `<div class="s"><div class="rot">${a.t}</div><div class="val">${a.v}</div><div class="txt">${a.p}</div></div>`
  ).join('')+`</div>`;
}

function projecao(name){
  const c=card(name), plot=c.querySelector('.plot'), S=D.sinais;
  const sub=document.getElementById('proj-sub');
  if(sub) sub.textContent=S? `Reta ajustada às últimas ${S.base} ${S.base===1?S.per1:S.perN}, estendida por mais ${S.horiz} ${S.horiz===1?S.per1:S.perN}.` : '';
  if(!S || !S.projs.length)
    return vazio(name,'Nenhuma série com movimento consistente o bastante nesta janela para projetar.');
  plot.innerHTML=`<div class="prj">`+S.projs.map(p=>
    `<div class="l"><span class="nome">${p.rot}</span>`+
    (p.rompe
      ? `<span class="agora">${p.atual} <span class="seta">→</span> <b class="rompe">${p.rompe.lim} em ${p.rompe.n} ${p.rompe.n===1?S.per1:S.perN}</b></span>`
      : `<span class="agora">${p.atual} <span class="seta">→</span> <b>${p.alvo}</b></span>`)+
    `<span class="quando">${p.dir==='sobe'?'subindo':'caindo'} ${p.taxa} por ${S.per1}</span></div>`
  ).join('')+`</div>`+
  (S.projs.some(p=>p.rompe)
    ? `<div class="nota-prj">Em <span class="rompe">vermelho</span>, as séries cuja reta bate no piso ou no teto antes do fim do horizonte. Não é previsão de que vão zerar ou saturar, é a prova de que a taxa atual não se mantém por tanto tempo.</div>`
    : '')+
  `<div class="aviso"><b>Isto não é previsão.</b> É a taxa observada nas últimas ${S.base} ${S.perN} estendida em linha reta. `+
  `A tese desta página é justamente que essas taxas mudam: nenhum modelo sustentou liderança por mais de dois trimestres aqui. `+
  `Serve para dimensionar ordem de grandeza e provocar a pergunta certa, não para planejar.</div>`;
}

function renderAll(){
  stackedShare('vendor', dobrar(D.vendor_share, VENDOR_HUES), VENDOR_SLOT, VENDOR_LABEL);
  stackedShare('origin', D.origin_share, ORIGIN_SLOT, {});
  stackedShare('weights', D.weights_share, WEIGHTS_SLOT, {});
  lineChart('volume', D.weekly_total_T, {fmt:fmtT, color:'--s1', label:'Tokens/semana'});
  lineChart('conc', D.top5, {fmt:fmtP, color:'--s1', label:'Share dos 5 maiores', ymax:100,
    extra:(i)=>{
      const m=(D.top5_modelos&&D.top5_modelos[i])||[];
      if(!m.length) return '';
      return `<div class="r" style="opacity:.7;margin-top:5px"><span>quais são</span><b></b></div>`+
        m.map((r,k)=>tipRow('transparent',`${k+1}. ${r.s}`,fmtP(r.share))).join('');
    },
    colsTab:{cols:[rotPer(),'Share dos 5 maiores','1º','2º','3º','4º','5º'],
      linha:(i)=>{ const m=(D.top5_modelos&&D.top5_modelos[i])||[];
        return [fPer(ST.W[i]),fmtP(D.top5[i]),...[0,1,2,3,4].map(k=>m[k]?`${m[k].s} (${fmtP(m[k].share)})`:'—')]; }}});
  lineChart('free', D.free_share, {fmt:fmtP, color:'--s3', label:'Share :free'});
  emphasisLines('anshare', D.comp_share, 'anthropic', {...VENDOR_SLOT,'x-ai':'--s0'}, VENDOR_LABEL);
  stackedAbs('anfam', D.an_fam_abs, FAM_SLOT);
  lineChart('churn', D.churn, {fmt:v=>v, color:'--s2', label:'Novos no top 10 (vs. 4 sem antes)', integer:true, ymax:10, area:false});
  lineChart('age', D.age, {fmt:v=>fmtNum(v)+' sem', color:'--s4', label:'Idade mediana (semanas)', area:false});
  trajectory('life');
  spendChart('spend'); vsMoney('vsmoney'); quality('quality');
  mudou('mudou'); varia('varia'); mapa('mapa'); comparador();
  sinais('sinais'); projecao('projecao');
  montarExplicacoes();
}
function renderStatic(){
  tiles(); readings(); board();
  const an=D.life.filter(m=>m.vendor==='anthropic' && !/beta|thinking/.test(m.model) && m.weeks_in_top10>0).sort((a,b)=>a.first<b.first?-1:1);
  hbars('antenure', an.map(m=>({k:m.model.replace('anthropic/','').replace(/-20\d{6}$/,''), v:m.weeks_in_top10, first:m.first, peak:m.peak_share, alive:m.still_alive})));
  const byQ=d3.rollups(D.life, v=>({n:v.length, ttp:d3.median(v,m=>m.weeks_to_peak), half:d3.median(v.filter(m=>m.half_life_weeks!=null),m=>m.half_life_weeks)||0, alive:d3.mean(v,m=>m.still_alive?1:0)}), m=>{const d=new Date(m.first); return d.getFullYear()+'Q'+(Math.floor(d.getMonth()/3)+1);}).sort((a,b)=>a[0]<b[0]?-1:1);
  cohortBars('cohort', byQ.map(([q,o])=>({q,...o})));
  const fBR=d=>d.split('-').reverse().join('/');
  document.getElementById('m-range').textContent=`${fBR(D.daily_first)} a ${fBR(D.daily_last)}`;
  document.getElementById('m-asof').textContent=fBR(D.as_of);
  document.getElementById('attrib-asof').textContent=D.as_of;
  document.getElementById('m-weeks').textContent=ST.N; document.getElementById('m-models').textContent=D.n_models;
}
// attach per-model series to lifecycle entries (built from weekly model shares embedded in D.life_series)
D.life.forEach(m=>{ m.series=D.life_series[m.model]; });
// Ponto de inspecao publico. Os testes automatizados comparam o que a pagina
// calcula com o que o pipeline calculou; qualquer leitor pode auditar o mesmo.
window.MS={ get D(){return D}, MX, FILTROS, filtrando, recalcular, aplicar,
            agregar, selecionados, versao:D.as_of,
            get gran(){return ST.GRAN}, get janela(){return ST.JANELA},
            get semanasPorBucket(){return ST.SEMANAS_POR_BUCKET} };
montarFiltros(); daURL(); sincronizarBotoes(); aplicar();

document.getElementById('ftoggle').addEventListener('click',()=>{
  const bar=document.getElementById('fbar'), b=document.getElementById('ftoggle');
  const abrir=bar.dataset.open!=='true';
  bar.dataset.open=String(abrir);
  b.setAttribute('aria-expanded',String(abrir));
  b.textContent=abrir?'ocultar filtros ▴':'mostrar filtros ▾';
});
document.getElementById('fclear').addEventListener('click',()=>{
  Object.keys(FILTROS).forEach(k=>delete FILTROS[k]);
  sincronizarBotoes(); aplicar();
});
// filtro vindo na URL abre a barra sozinho, para o leitor ver o recorte aplicado
if(filtrando()) document.getElementById('ftoggle').click();
document.querySelectorAll('.views button[data-view]').forEach(b=>b.addEventListener('click',()=>{
  b.parentElement.querySelectorAll('button').forEach(o=>o.setAttribute('aria-pressed', String(o===b)));
  ST.TRAJ_VIEW=b.dataset.view; trajectory('life');
}));
document.querySelectorAll('.views button[data-hbar]').forEach(b=>b.addEventListener('click',()=>{
  b.parentElement.querySelectorAll('button').forEach(o=>o.setAttribute('aria-pressed', String(o===b)));
  ST.HBAR_ORDEM=b.dataset.hbar; renderStatic();
  const s=document.getElementById('ten-sub');
  if(s) s.textContent = ST.HBAR_ORDEM==='valor'
    ? 'Permanência entre os 10 mais usados, do maior para o menor'
    : 'Permanência entre os 10 mais usados, por ordem de estreia no ranking. Não é a data de lançamento: modelos que já existiam quando a série começa aparecem todos na primeira semana';
}));
document.querySelectorAll('.views button[data-mapa]').forEach(b=>b.addEventListener('click',()=>{
  b.parentElement.querySelectorAll('button').forEach(o=>o.setAttribute('aria-pressed', String(o===b)));
  ST.MAPA_MODO=b.dataset.mapa; mapa('mapa'); readings();
}));
document.querySelectorAll('.views button[data-qx]').forEach(b=>b.addEventListener('click',()=>{
  b.parentElement.querySelectorAll('button').forEach(o=>o.setAttribute('aria-pressed', String(o===b)));
  ST.QX=b.dataset.qx; quality('quality'); readings();
}));
let rt; window.addEventListener('resize',()=>{clearTimeout(rt); rt=setTimeout(renderAll,150);});
const mq=matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change',()=>{renderStatic();renderAll();});
}
