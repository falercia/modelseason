// Formatacao de numero e data em pt-BR, num lugar so.
//
// Antes cada chamada formatava do seu jeito, e o separador decimal ingles
// vazava para a tela: "0.00T" no eixo do grafico principal, "8.79 semanas" na
// leitura do ciclo de vida, "US$ 0,450" no comparador. O teste de ponta a ponta
// falha se qualquer numero aparecer com ponto decimal.
import { ST } from './estado.js';

const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
// Numero em portugues usa virgula. O separador vazava em fmtT ('0.00T' no eixo
// do grafico principal) e nas medianas do ciclo de vida ('8.79 semanas').
const br = s => String(s).replace('.',',');
const fmtT = v => br(v>=10? d3.format('.0f')(v)+'T' : v>=1? d3.format('.1f')(v)+'T' : d3.format('.2f')(v)+'T');
const fmtNum = (v,c=1) => v==null||!isFinite(v) ? '—' : br((+v).toFixed(c).replace(/,?0+$/,'').replace(/\.$/,'')||'0');
const fmtP = v => d3.format('.1f')(v).replace('.',',')+'%';
// Preco em USD por 1M de tokens. Sem separador de milhar, porque o valor quase
// sempre e menor que 100 e "US$ 1.251" era lido como mil duzentos e cinquenta.
const fmtUSD = v => { if(v==null) return '—';
  // Cortar o zero sobrando ANTES de trocar o ponto pela virgula. Ao contrario,
  // a regex procura um ponto que ja nao existe e "US$ 0,450" passa.
  // Acima de 1 dolar, duas casas sempre: "US$ 1,50" e preco, "US$ 1,5" parece
  // numero solto. Abaixo de 1, tres casas com o zero sobrando cortado.
  const s = v>=100 ? d3.format('.0f')(v)
          : v>=1   ? v.toFixed(2)
          : v.toFixed(3).replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
  return 'US$ '+br(s); };
// Contexto em unidade redonda: "1M" comunica, "1.05M" finge precisao que a
// diferenca entre 1048576 e 1050000 nao tem para quem le.
const fmtCtx = v => { if(!v) return '—';
  if(v>=1e6) return (v/1048576>=0.98 && v/1048576<=1.02 ? '1M' : d3.format('.2~f')(v/1e6).replace('.',',')+'M');
  if(v>=1000) return Math.round(v/1024)+'k';
  return String(v); };
// Multiplicador com uma casa quando ainda importa. Tile e leitura precisam usar
// o MESMO formatador, senao a mesma janela mostra "×2,6" num lugar e "×3" no outro.
const fmtVez = r => (!isFinite(r)||r<=0) ? null : (r>=10? String(Math.round(r)) : r.toFixed(1).replace('.',','));
const capital = s => String(s).split(/[-_]/).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
const fmtDate = d3.timeFormat('%d %b %y');
const ptBR = {Jan:'jan',Feb:'fev',Mar:'mar',Apr:'abr',May:'mai',Jun:'jun',Jul:'jul',Aug:'ago',Sep:'set',Oct:'out',Nov:'nov',Dec:'dez'};
const fD = d => fmtDate(d).replace(/[A-Z][a-z]{2}/, m=>ptBR[m]||m);
// Rotulo do ponto no eixo, conforme a granularidade.
const fPer = d => (typeof ST.GRAN!=='undefined' && ST.GRAN==='mes')
  ? d3.timeFormat('%b %y')(d).replace(/[A-Z][a-z]{2}/, m=>ptBR[m]||m)
  : fD(d);
// O ano so aparecia em janeiro. Numa serie de 20 meses o eixo mostrava dois
// "fev" e dois "abr" sem distincao, e em tela estreita janeiro nem virava
// marca, entao o ano sumia da tela inteira. Agora o ano entra na primeira
// marca e sempre que ele vira, que e quando o leitor precisa dele.
const monthTicks = ticks => { let ant=null; return ticks.map(d=>{
  const m=d3.timeFormat('%b')(d), y=d3.timeFormat('%y')(d);
  const mostra = ant===null || y!==ant; ant=y;
  return (ptBR[m]||m)+(mostra?' '+y:''); }); };

export { css, br, fmtT, fmtNum, fmtP, fmtUSD, fmtCtx, fmtVez, capital, fmtDate, ptBR, fD, fPer, monthTicks };
