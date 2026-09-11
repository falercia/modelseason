'use client';
/**
 * Seção 04: origem, licença e cobrança. Porte dos stackedShare('origin') e
 * ('weights') e do lineChart('free') da v1, com a leitura de read-weights. O
 * cartão de provedores é novo: é a sede de quem SERVE o modelo, uma foto do
 * dia, e por isso não responde à janela nem aos filtros.
 */
import type { Mercado } from '@/lib/tipos';
import type { Recorte, Series } from '@/lib/engine';
import { Cartao, Secao } from '@/components/shell/Cartao';
import { useHistorico } from '@/components/shell/Historico';
import { BarrasH, Legenda, Temporal, TabelaSerie, useOcultos, type ItemSerie } from '@/components/graficos/base';
import { br, fD, fmtP, fmtPP, fPer } from '@/lib/format';
import { ORIGEM_SLOT, PESOS_SLOT } from '@/lib/cores';
import { entre, indiceBase, indiceFim, Leitura, naQuando, P, per, tipSemanas } from './s02-comum';

/**
 * Duas faixas de "resto" dividem o mesmo cinza. A de não identificado sai num
 * tom mais claro do próprio --s0, para as duas não se fundirem: continua sendo
 * o neutro da paleta, não uma quinta cor.
 */
const CINZA_CLARO = 'color-mix(in srgb, var(--s0) 45%, var(--surface))';

/** Ordem de empilhamento: as duas maiores nas bordas, para ler cada uma direto do eixo. */
const ORDEM_ORIGEM = ['China', 'Europa', 'Coreia', 'Outros', 'Não identificado', 'EUA/Canadá'];
const ORDEM_PESOS = ['Open-weights', 'Não identificado', 'Proprietário'];
const ROTULO_PESOS: Record<string, string> = { 'Open-weights': 'Pesos abertos', Proprietário: 'Proprietário', 'Não identificado': 'Não identificado' };

function Empilhada({ R, dados, ordem, slot, rotulo, aria }: {
  R: Recorte; dados: Series; ordem: string[]; slot: (k: string) => string; rotulo: (k: string) => string; aria: string;
}) {
  const { ocultos, alternar } = useOcultos();
  const u = R.N - 1, tot = R.weekly_total_T, gran = R.estado.gran;
  const chaves = [...ordem.filter(k => dados[k]), ...Object.keys(dados).filter(k => !ordem.includes(k))]
    .filter(k => dados[k].some(v => v >= 0.05)); // faixa que nunca chega a 0,05% seria invisível: fica fora do gráfico e da legenda
  const todas: ItemSerie[] = chaves.map(k => ({ key: k, label: rotulo(k), values: dados[k].map((v, i) => (tot[i] > 0 ? v : null)), slot: slot(k) }));
  const vis = todas.filter(s => !ocultos.has(s.key));
  const legenda = todas.slice().sort((x, y) => (dados[y.key][u] ?? 0) - (dados[x.key][u] ?? 0))
    .map(s => ({ key: s.key, label: `${s.label} ${fmtP(dados[s.key][u])}`, slot: s.slot }));
  // Filtro que deixa uma categoria só (origem=China, por exemplo) vira um bloco de 100% que não diz nada.
  if (todas.length <= 1) {
    return <p className="vazio">Todo o recorte está em uma categoria só{todas[0] ? <> ({todas[0].label})</> : null}, então não há o que repartir. Tire o filtro correspondente para ver a divisão.</p>;
  }
  return (
    <>
      <Legenda itens={legenda} ocultos={ocultos} alternar={alternar} />
      <Temporal eixo={R.eixo} gran={gran} modo="empilhada" series={vis.length ? vis : todas} fmt={v => fmtP(v)} fmtEixo={v => v + '%'} ymax={100} altura={250}
        tipExtra={tipSemanas(R)} rotuloAria={`${aria}, de ${fPer(R.eixo[0], gran)} a ${fPer(R.eixo[u], gran)}. No último período: ${legenda.map(l => l.label).join(', ')}.`} />
      <TabelaSerie eixo={R.eixo} gran={gran} fmt={v => fmtP(v)} series={todas.map(s => ({ label: s.label, values: s.values }))} />
    </>
  );
}

const slotOrigem = (k: string) => (k === 'Não identificado' ? CINZA_CLARO : ORIGEM_SLOT[k] ?? '--s0');
const slotPesos = (k: string) => PESOS_SLOT[k] ?? '--s0';

/** "de 12,0% para 61,0%" */
const dePara = (s: number[], b: number, u: number) => <>de <b>{fmtP(s[b])}</b> para <b>{fmtP(s[u])}</b></>;

function LeituraOrigem({ R, b }: { R: Recorte; b: number }) {
  const u = indiceFim(R.weekly_total_T), o = R.origin_share;
  // Uma origem só na janela inteira: o próprio gráfico já diz isso no lugar da área.
  if (Object.keys(o).filter(k => o[k].some(v => v >= 0.05)).length <= 1) return null;
  const presentes = Object.keys(o).filter(k => o[k][u] > 0);
  if (presentes.length <= 1) {
    return <Leitura R={R}><p>Todo o recorte vem de uma origem só{presentes[0] ? <> ({presentes[0]})</> : null}, então não há o que repartir aqui. Tire o filtro de origem para ver a divisão.</p></Leitura>;
  }
  const cn = o['China'], us = o['EUA/Canadá'];
  const outras = Object.keys(o).filter(k => k !== 'China' && k !== 'EUA/Canadá' && k !== 'Não identificado')
    .map(k => ({ k, d: o[k][u] - o[k][b], v: o[k][u] })).sort((x, y) => y.v - x.v)[0];
  return (
    <Leitura R={R}>
      <p>
        {cn && <>Laboratórios chineses foram {dePara(cn, b, u)} do volume</>}
        {cn && us && '; '}
        {us && <>{cn ? 'e' : 'Laboratórios de'} EUA e Canadá, {dePara(us, b, u)}</>}, {entre(R, b, u)}.
        {cn && us && <> Hoje a diferença entre os dois é de <b>{br(Math.abs(cn[u] - us[u]).toFixed(1))} pontos</b>, a favor {cn[u] >= us[u] ? 'da China' : 'de EUA e Canadá'}.</>}
      </p>
      {outras && outras.v >= 0.5 && <P>Fora dos dois polos, a maior fatia é de {outras.k === 'Outros' ? 'outras origens' : outras.k}, com {fmtP(outras.v)} ({fmtPP(outras.d)} na janela).</P>}
      <P>Esta é a sede de quem <b>treinou</b> o modelo. Onde fica quem o serve está no cartão de provedores, mais abaixo.</P>
    </Leitura>
  );
}

function LeituraPesos({ R, b }: { R: Recorte; b: number }) {
  if (Object.keys(R.weights_share).filter(k => R.weights_share[k].some(v => v >= 0.05)).length <= 1) return null;
  const u = indiceFim(R.weekly_total_T), ow = R.weights_share['Open-weights'], pr = R.weights_share['Proprietário'], ni = R.weights_share['Não identificado'];
  const cn = R.origin_share['China'];
  // Com filtro de origem ou de licença, uma das duas curvas vira constante e a comparação perde sentido.
  const comparavel = !R.estado.filtros.origin?.length && !R.estado.filtros.pesos?.length && ow && cn;
  const g0 = comparavel ? Math.abs(ow[b] - cn[b]) : 0, g1 = comparavel ? Math.abs(ow[u] - cn[u]) : 0;
  return (
    <Leitura R={R}>
      <p>
        {ow ? <>Pesos abertos foram {dePara(ow, b, u)} do volume</> : <>Nenhum modelo de pesos abertos no recorte</>}
        {pr ? <>; proprietários, {dePara(pr, b, u)}</> : null}.
        {ni && ni[u] >= 1 && <> <b>{fmtP(ni[u])}</b> do último período não tem licença identificada, e ignorar essa faixa inflaria as outras duas.</>}
      </p>
      {comparavel && (
        <P>
          No fim da janela, pesos abertos e laboratórios chineses estão a <b>{br(g1.toFixed(1))} pontos</b> um do outro ({fmtP(ow[u])} contra {fmtP(cn[u])}); no início, a distância era de {br(g0.toFixed(1))}.
          {' '}{g1 <= 8
            ? (g0 - g1 >= 4 ? 'As curvas convergiram ao longo da janela e hoje andam quase juntas' : 'As duas curvas andam quase juntas')
              + ', porque a maioria dos pesos abertos relevantes é chinesa: é o mesmo fenômeno visto de dois ângulos, não duas tendências independentes.'
            : g1 - g0 >= 4
              ? 'As curvas descolaram: ou apareceu peso aberto relevante fora da China, ou laboratório chinês passou a fechar modelo.'
              : g0 - g1 >= 4
                ? 'As curvas estão se aproximando, mas a distância ainda é grande demais para tratar uma como a outra.'
                : 'A distância é grande e estável, então as duas medidas não são intercambiáveis neste recorte.'}
        </P>
      )}
    </Leitura>
  );
}

function LeituraFree({ R, b }: { R: Recorte; b: number }) {
  const u = indiceFim(R.weekly_total_T), fr = R.free_share;
  let pico = b; for (let i = b; i <= u; i++) if (fr[i] > fr[pico]) pico = i;
  return (
    <Leitura R={R}>
      <p>
        Tráfego em endpoints gratuitos foi {dePara(fr, b, u)} do volume na janela
        {pico !== u ? <>, com pico de <b>{fmtP(fr[pico])}</b> {naQuando(R, pico)}</> : <>, e o último período é o pico</>}.
      </p>
      <P>Volume gratuito infla adoção sem indicar disposição a pagar. Todo share desta página inclui essa demanda subsidiada, que ainda não foi testada contra preço.</P>
    </Leitura>
  );
}

// ------------------------------------------------------------ provedores

/** Nome em português do código de país ISO da fonte. Código desconhecido aparece como veio. */
const PAIS: Record<string, string> = {
  US: 'Estados Unidos', CA: 'Canadá', CN: 'China', HK: 'Hong Kong', TW: 'Taiwan', SG: 'Singapura', JP: 'Japão', KR: 'Coreia do Sul',
  IN: 'Índia', ID: 'Indonésia', IL: 'Israel', AE: 'Emirados Árabes', AU: 'Austrália', BR: 'Brasil',
  GB: 'Reino Unido', UK: 'Reino Unido', IE: 'Irlanda', FR: 'França', DE: 'Alemanha', NL: 'Países Baixos', BE: 'Bélgica', LU: 'Luxemburgo',
  ES: 'Espanha', PT: 'Portugal', IT: 'Itália', CH: 'Suíça', AT: 'Áustria', SE: 'Suécia', NO: 'Noruega', DK: 'Dinamarca', FI: 'Finlândia',
  PL: 'Polônia', CZ: 'Tchéquia', EE: 'Estônia', LT: 'Lituânia', LV: 'Letônia', RO: 'Romênia', UA: 'Ucrânia',
};
const EUROPA = new Set(['GB', 'UK', 'IE', 'FR', 'DE', 'NL', 'BE', 'LU', 'ES', 'PT', 'IT', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'EE', 'LT', 'LV', 'RO', 'UA']);
/** Mesma cor por região do gráfico de origem: o país é a entidade, então a cor o acompanha. */
const slotPais = (p: string) => (p === 'US' || p === 'CA' ? ORIGEM_SLOT['EUA/Canadá'] : p === 'CN' || p === 'HK' ? ORIGEM_SLOT['China']
  : EUROPA.has(p) ? ORIGEM_SLOT['Europa'] : p === 'KR' ? ORIGEM_SLOT['Coreia'] : '--s0');
const NAO_INFORMADO = 'Não informado';

function ProvedoresSede({ M }: { M: Mercado }) {
  const P0 = M.provedores, Z = M.zdr;
  const dia = P0?.dia ?? Z?.dia;
  const sub = dia ? `Foto de ${fD(dia)}. Não responde à janela nem aos filtros` : 'Foto do dia. Não responde à janela nem aos filtros';
  if (!P0 && !Z) {
    return <Cartao id="provedores-sede" subtitulo={sub} novo><p className="vazio">A coleta de provedores ainda não chegou a esta publicação. O cartão aparece quando o pipeline gravar a primeira foto.</p></Cartao>;
  }
  let barras: { key: string; rot: string; v: number; slot: string; extra: string }[] = [];
  let naoInf = 0, us = 0;
  if (P0) {
    const pct = (n: number) => '· ' + fmtP((100 * n) / (P0.total || 1), 0);
    naoInf = P0.por_sede.find(x => x.pais === NAO_INFORMADO)?.n ?? 0;
    us = P0.por_sede.find(x => x.pais === 'US')?.n ?? 0;
    const paises = P0.por_sede.filter(x => x.pais !== NAO_INFORMADO).sort((a, b) => b.n - a.n || a.pais.localeCompare(b.pais));
    // Até seis países com nome. Um empate que atravessaria o corte vai inteiro para "outros",
    // em vez de a ordem alfabética decidir quem aparece.
    let corte = Math.min(6, paises.length);
    if (corte < paises.length && paises[corte - 1].n === paises[corte].n) {
      const n = paises[corte - 1].n; while (corte > 0 && paises[corte - 1].n === n) corte--;
    }
    const top = paises.slice(0, corte), resto = paises.slice(corte);
    barras = top.map(x => ({ key: x.pais, rot: PAIS[x.pais] ?? x.pais, v: x.n, slot: slotPais(x.pais), extra: pct(x.n) }));
    const nResto = resto.reduce((s, x) => s + x.n, 0);
    if (nResto) barras.push({ key: '_resto', rot: `Outros ${resto.length} ${resto.length === 1 ? 'país' : 'países'}`, v: nResto, slot: '--s0', extra: pct(nResto) });
    if (naoInf) barras.push({ key: '_ni', rot: 'Sede não informada', v: naoInf, slot: CINZA_CLARO, extra: pct(naoInf) });
  }
  const mesmoDia = P0 && Z && P0.dia === Z.dia && Z.provedores <= P0.total;
  const Num = ({ v, rot }: { v: number; rot: string }) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>{v.toLocaleString('pt-BR')}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.35 }}>{rot}</div>
    </div>
  );
  return (
    <Cartao id="provedores-sede" subtitulo={sub} novo>
      {P0 ? (
        <>
          <p className="cap" style={{ marginBottom: 8 }}>{P0.total} provedores de inferência listados, por país-sede declarado</p>
          <BarrasH linhas={barras} fmt={v => String(v)} larguraRotulo={140}
            rotuloAria={`Provedores de inferência por país-sede em ${fD(P0.dia)}: ${barras.map(b => `${b.rot} ${b.v}`).join(', ')}, de ${P0.total} no total.`} />
        </>
      ) : <p className="vazio">Sem a lista de provedores nesta publicação.</p>}
      <div style={{ borderTop: '1px solid var(--grid)', marginTop: 12, paddingTop: 10 }}>
        <p style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Retenção zero de dados (ZDR)</p>
        {Z ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <Num v={Z.endpoints} rot="endpoints com retenção zero" />
            <Num v={Z.modelos} rot="modelos com ao menos um desses endpoints" />
            <Num v={Z.provedores} rot={mesmoDia ? `de ${P0!.total} provedores oferecem a opção` : 'provedores oferecem a opção'} />
          </div>
        ) : <p className="vazio">Sem a lista de endpoints com retenção zero nesta publicação.</p>}
      </div>
      <Leitura R={null}>
        <p>
          Isto é a sede de quem <b>serve</b> o modelo, o provedor de inferência que recebe a requisição. É outra coisa que o gráfico de origem, que mostra a sede de quem <b>treinou</b>: um modelo chinês servido por provedor americano conta como China lá e como Estados Unidos aqui.
        </p>
        {P0 && (
          <P>
            {us > 0 && <><b>{us}</b> dos {P0.total} provedores ({fmtP((100 * us) / P0.total, 0)}) declaram sede nos Estados Unidos. </>}
            {naoInf > 0 && <><b>{naoInf}</b> não {naoInf === 1 ? 'declara' : 'declaram'} sede nenhuma, e para quem tem restrição de jurisdição esse é o grupo que exige verificação caso a caso.</>}
          </P>
        )}
        {Z && mesmoDia && (
          <P>Retenção zero é uma política por endpoint, não por modelo: {Z.provedores} dos {P0!.total} provedores a oferecem em pelo menos um endpoint, e o mesmo modelo pode ter endpoint com e sem ela.</P>
        )}
      </Leitura>
    </Cartao>
  );
}

export default function S04({ M }: { M: Mercado }) {
  const { R } = useHistorico();
  const b = indiceBase(R.weekly_total_T);
  const gran = R.estado.gran, u = R.N - 1;
  const semVolume = b < 0;
  const vazio = <p className="vazio">Nenhum volume no recorte atual.</p>;
  const maxFree = Math.max(0, ...R.free_share);
  const adj = per(R).adj;
  return (
    <Secao id="s04" n="04" titulo="Origem, licença e cobrança"
      sub="De onde vem o modelo, se os pesos são abertos, quanto do tráfego é gratuito e onde ficam os provedores que servem a inferência.">
      <div className="grid2">
        <Cartao id="origin" subtitulo={`% do volume ${adj} por país-sede do laboratório que treinou o modelo`}>
          {semVolume ? vazio : (
            <>
              <Empilhada R={R} dados={R.origin_share} ordem={ORDEM_ORIGEM} slot={slotOrigem} rotulo={k => k} aria="Área empilhada do share de tokens por origem do laboratório" />
              <LeituraOrigem R={R} b={b} />
            </>
          )}
        </Cartao>
        <Cartao id="weights" subtitulo={`% do volume ${adj} em modelos de pesos abertos, proprietários e não identificados`}>
          {semVolume ? vazio : (
            <>
              <Empilhada R={R} dados={R.weights_share} ordem={ORDEM_PESOS} slot={slotPesos} rotulo={k => ROTULO_PESOS[k] ?? k} aria="Área empilhada do share de tokens por licença dos pesos" />
              <LeituraPesos R={R} b={b} />
            </>
          )}
        </Cartao>
      </div>
      <div className="grid2" style={{ marginTop: 14 }}>
        <Cartao id="free">
          {semVolume ? vazio : maxFree <= 0 ? <p className="vazio">Nenhum tráfego em endpoint gratuito no recorte atual.{R.estado.filtros.cobranca?.length ? ' Com o filtro de cobrança sem “Endpoint gratuito”, esta curva fica vazia por definição.' : ''}</p> : (
            <>
              <Temporal eixo={R.eixo} gran={gran} modo="area" fmt={v => fmtP(v)} fmtEixo={v => v + '%'} altura={230}
                series={[{ key: 'free', label: 'Share em endpoint gratuito', values: R.free_share.map((v, i) => (R.weekly_total_T[i] > 0 ? v : null)), slot: '--s3', destaque: true }]}
                tipExtra={tipSemanas(R)}
                rotuloAria={`Share do volume em endpoints gratuitos, de ${fmtP(R.free_share[b])} em ${fPer(R.eixo[b], gran)} a ${fmtP(R.free_share[u])} em ${fPer(R.eixo[u], gran)}.`} />
              <TabelaSerie eixo={R.eixo} gran={gran} fmt={v => fmtP(v)} series={[{ label: 'Share gratuito', values: R.free_share }]} />
              <LeituraFree R={R} b={b} />
            </>
          )}
        </Cartao>
        <ProvedoresSede M={M} />
      </div>
    </Secao>
  );
}

