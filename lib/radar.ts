/**
 * Frases do Radar. O pipeline (pipeline/news.py) entrega cada evento como tipo,
 * números e chaves; aqui a frase é montada em cada idioma. Sem JSX: a mesma
 * função serve à página e ao feed RSS.
 *
 * Toda frase diz só o que o dado mostra. Causa não é inventada.
 */
import type { Idioma } from './idioma';
import type { AssuntoPauta, EdicaoRadar, EventoRadar } from './tipos';

export interface FraseRadar {
  /** Rótulo curto do tipo: "Preço", "Price". */
  rotulo: string;
  titulo: string;
  texto: string;
  /** O que o histórico de tráfego diz sobre o modelo ou o laboratório. */
  cruzamento: string | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

const ROTULO: Record<EventoRadar['tipo'], { pt: string; en: string }> = {
  novo: { pt: 'Catálogo', en: 'Catalog' },
  removido: { pt: 'Saiu do catálogo', en: 'Removed' },
  preco: { pt: 'Preço', en: 'Price' },
  desativacao: { pt: 'Desativação', en: 'Deprecation' },
  raciocinio: { pt: 'Raciocínio', en: 'Reasoning' },
  contexto: { pt: 'Contexto', en: 'Context' },
  alias: { pt: 'Apelido', en: 'Alias' },
  estreia: { pt: 'Tráfego', en: 'Traffic' },
  lider: { pt: 'Liderança', en: 'Leadership' },
  top10: { pt: 'Top 10', en: 'Top 10' },
  alta: { pt: 'Tráfego', en: 'Traffic' },
};

/**
 * Preço por 1M de tokens com casas fixas por faixa, para os dois lados de uma
 * variação lerem igual (as casas saem do menor valor do par): US$ 0,12 → US$ 0,24; US$ 0,084 → US$ 0,111.
 */
function preco(I: Idioma, v: number | null, ref?: number | null): string {
  if (v == null) return '—';
  const m = ref != null ? Math.min(v, ref) : v;
  const casas = m >= 0.1 ? 2 : m >= 0.01 ? 3 : 4;
  return (I.pt ? 'US$ ' : '$') + I.f.dec(v.toFixed(casas));
}

/** "13 set" / "Sep 13": o ano já está na edição. */
const diaCurto = (I: Idioma, d: string) => I.f.marcaDia(I.f.dataDe(d.slice(0, 10)));

/** Dias entre duas datas AAAA-MM-DD. */
const diasEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function cruzamento(ev: EventoRadar, I: Idioma): string | null {
  const { t, f } = I;
  const partes: string[] = [];
  const m = ev.cruzamento?.modelo;
  if (m && ev.tipo !== 'estreia' && ev.tipo !== 'lider' && ev.tipo !== 'top10' && ev.tipo !== 'alta') {
    if (num(m.share_7d) && m.rank_7d) {
      partes.push(t({ pt: `O modelo tem ${f.fmtP(m.share_7d, 2)} do tráfego dos últimos 7 dias, em ${f.ord(m.rank_7d)} lugar.`,
        en: `The model has ${f.fmtP(m.share_7d, 2)} of traffic over the last 7 days, ranked ${f.ord(m.rank_7d)}.` }));
    } else if (num(m.pico_share)) {
      partes.push(t({ pt: `Sem volume nos últimos 7 dias. O pico semanal foi de ${f.fmtP(m.pico_share, 2)}.`,
        en: `No volume over the last 7 days. Its weekly peak was ${f.fmtP(m.pico_share, 2)}.` }));
    }
  }
  const L = ev.cruzamento?.laboratorio;
  const lab = I.nomeLab(ev.lab);
  if (L && num(L.share_tokens) != null && num(L.share_gasto) != null && ev.tipo !== 'lider') {
    partes.push(t({ pt: `${lab} tem ${f.fmtP(L.share_tokens)} dos tokens e ${f.fmtP(L.share_gasto)} do gasto estimado da semana.`,
      en: `${lab} has ${f.fmtP(L.share_tokens)} of tokens and ${f.fmtP(L.share_gasto)} of estimated spend this week.` }));
  }
  if (L?.lider && (ev.tipo === 'novo' || ev.tipo === 'removido' || ev.tipo === 'desativacao' || ev.tipo === 'preco' || ev.tipo === 'estreia')) {
    const ld = L.lider;
    const precoNovo = num(ev.dados.preco_misto) ?? (ev.tipo === 'preco' ? num(ev.dados.para) : null);
    const razao = precoNovo && ld.preco_misto ? precoNovo / ld.preco_misto : null;
    const vez = razao ? f.fmtVez(razao >= 1 ? razao : 1 / razao) : null;
    const comp = vez && razao && Math.abs(razao - 1) >= 0.1
      ? t({ pt: razao > 1 ? `, e este custa ${vez} vezes mais` : `, e este custa ${vez} vezes menos`,
          en: razao > 1 ? `, and this one costs ${vez} times more` : `, and this one costs ${vez} times less` })
      : '';
    partes.push(t({
      pt: `O modelo mais usado do laboratório é o ${ld.nome}, com ${f.fmtP(ld.share_7d, 2)}${ld.preco_misto != null ? ` a ${preco(I, ld.preco_misto)} por 1M` : ''}${comp}.`,
      en: `The lab's most used model is ${ld.nome}, with ${f.fmtP(ld.share_7d, 2)}${ld.preco_misto != null ? ` at ${preco(I, ld.preco_misto)} per 1M` : ''}${comp}.`,
    }));
  }
  return partes.length ? partes.join(' ') : null;
}

export function frase(ev: EventoRadar, dia: string, I: Idioma): FraseRadar {
  const { t, f } = I;
  const d = ev.dados, n = ev.nome, lab = I.nomeLab(ev.lab);
  const rotulo = t(ROTULO[ev.tipo]);
  let titulo = n, texto = '';
  switch (ev.tipo) {
    case 'novo': {
      const partes: string[] = [lab];
      if (num(d.preco_entrada) != null && num(d.preco_saida) != null)
        partes.push(t({ pt: `${preco(I, num(d.preco_entrada))} de entrada e ${preco(I, num(d.preco_saida))} de saída por 1M de tokens`,
          en: `${preco(I, num(d.preco_entrada))} input and ${preco(I, num(d.preco_saida))} output per 1M tokens` }));
      if (num(d.contexto)) partes.push(t({ pt: `contexto de ${f.fmtCtx(num(d.contexto))}`, en: `${f.fmtCtx(num(d.contexto))} context` }));
      if (d.raciocinio_obrigatorio === true) partes.push(t({ pt: 'raciocínio obrigatório', en: 'mandatory reasoning' }));
      else if (d.raciocinio === true) partes.push(t({ pt: 'raciocínio opcional', en: 'optional reasoning' }));
      if (d.pesos_abertos === true) partes.push(t({ pt: 'pesos abertos', en: 'open weights' }));
      titulo = t({ pt: `${n} entrou no catálogo`, en: `${n} is now in the catalog` });
      texto = f.lista(partes) + '.';
      const exp = str(d.expira);
      if (exp) texto += ' ' + t({ pt: `Já tem desativação marcada para ${f.fD(exp)}.`, en: `It already has a deprecation date of ${f.fD(exp)}.` });
      texto += ' ' + t({ pt: 'Ainda sem volume de tráfego medido.', en: 'No traffic volume measured yet.' });
      break;
    }
    case 'removido':
      titulo = t({ pt: `${n} saiu do catálogo`, en: `${n} was removed from the catalog` });
      texto = t({ pt: `Listado pela última vez em ${f.fD(str(d.visto_em) ?? dia)}. Quem chama este identificador precisa migrar.`,
        en: `Last listed on ${f.fD(str(d.visto_em) ?? dia)}. Anyone calling this identifier needs to migrate.` });
      break;
    case 'preco': {
      const v = num(d.variacao_pct) ?? 0, sobe = v > 0;
      const pct = f.dec(Math.abs(v).toFixed(0)) + '%';
      const par = (a: string, b: string) => [preco(I, num(d[a]), num(d[b])), preco(I, num(d[b]), num(d[a]))];
      const [de, para] = par('de', 'para'), [ed, ep] = par('entrada_de', 'entrada_para'), [sd, sp] = par('saida_de', 'saida_para');
      titulo = t({ pt: `${n} ficou ${pct} mais ${sobe ? 'caro' : 'barato'}`, en: `${n} got ${pct} ${sobe ? 'more expensive' : 'cheaper'}` });
      texto = t({
        pt: `De ${de} para ${para} por 1M de tokens no preço misto. Entrada ${ed} → ${ep}, saída ${sd} → ${sp}. Valor novo desde ${diaCurto(I, str(d.desde) ?? dia)}.`,
        en: `From ${de} to ${para} per 1M tokens, blended. Input ${ed} → ${ep}, output ${sd} → ${sp}. New price since ${diaCurto(I, str(d.desde) ?? dia)}.`,
      });
      break;
    }
    case 'desativacao': {
      const data = str(d.data) ?? dia, faltam = diasEntre(dia, data), ant = str(d.anterior);
      titulo = t({ pt: `${n} tem desativação marcada para ${f.fD(data)}`, en: `${n} is set to be deprecated on ${f.fD(data)}` });
      texto = (faltam > 0
        ? t({ pt: `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'}.`, en: `${faltam} ${faltam === 1 ? 'day' : 'days'} left.` })
        : '')
        + (ant ? ' ' + t({ pt: `A data anterior era ${f.fD(ant)}.`, en: `The previous date was ${f.fD(ant)}.` })
          : ' ' + t({ pt: 'É o primeiro aviso no catálogo.', en: 'It is the first notice in the catalog.' }));
      texto = texto.trim();
      break;
    }
    case 'raciocinio':
      if (d.obrigatorio === true) {
        titulo = t({ pt: `${n} passou a exigir raciocínio`, en: `${n} now requires reasoning` });
        texto = t({ pt: 'O raciocínio não pode mais ser desligado neste modelo, o que aumenta os tokens de saída de cada chamada.',
          en: 'Reasoning can no longer be turned off for this model, which increases output tokens on every call.' });
      } else {
        titulo = t({ pt: `${n} deixou de exigir raciocínio`, en: `${n} no longer requires reasoning` });
        texto = t({ pt: 'Agora é possível desligar o raciocínio neste modelo e pagar menos tokens de saída.',
          en: 'Reasoning can now be turned off for this model, cutting output tokens.' });
      }
      break;
    case 'contexto':
      titulo = t({ pt: `${n} mudou a janela de contexto`, en: `${n} changed its context window` });
      texto = t({ pt: `De ${f.fmtCtx(num(d.de))} para ${f.fmtCtx(num(d.para))} tokens.`, en: `From ${f.fmtCtx(num(d.de))} to ${f.fmtCtx(num(d.para))} tokens.` });
      break;
    case 'alias': {
      const alvo = str(d.alvo_nome) ?? str(d.alvo_slug) ?? '—', ant = str(d.anterior);
      titulo = t({ pt: `${n} agora aponta para ${alvo}`, en: `${n} now points to ${alvo}` });
      texto = ant
        ? t({ pt: `Antes apontava para ${ant}. Quem usa o apelido passou a receber outro modelo sem mudar uma linha de código.`,
            en: `It used to point to ${ant}. Anyone using the alias now gets a different model without changing a line of code.` })
        : t({ pt: 'Apelido novo. Quem usa o apelido recebe sempre a versão mais recente, com as mudanças de preço e de comportamento que vierem junto.',
            en: 'A new alias. Anyone using it always gets the latest version, along with whatever price and behavior changes come with it.' });
      break;
    }
    case 'estreia': {
      const dc = num(d.dias_desde_catalogo);
      titulo = t({ pt: `${n} estreou no tráfego`, en: `${n} debuted in traffic` });
      texto = t({
        pt: `Primeiro volume registrado em ${f.fD(str(d.primeiro_dia) ?? dia)}${dc != null && dc >= 0 ? `, ${dc} ${dc === 1 ? 'dia' : 'dias'} depois de entrar no catálogo` : ''}, com ${f.fmtP(num(d.share_7d), 2)} do tráfego dos últimos 7 dias.`,
        en: `First volume recorded on ${f.fD(str(d.primeiro_dia) ?? dia)}${dc != null && dc >= 0 ? `, ${dc} ${dc === 1 ? 'day' : 'days'} after entering the catalog` : ''}, with ${f.fmtP(num(d.share_7d), 2)} of traffic over the last 7 days.`,
      });
      break;
    }
    case 'lider': {
      const sa = num(d.anterior_share);
      titulo = t({ pt: `${n} assumiu a liderança do tráfego`, en: `${n} took the lead in traffic` });
      texto = t({
        pt: `${f.fmtP(num(d.share))} do tráfego dos últimos 7 dias. O líder anterior era ${str(d.anterior_nome)}${sa != null ? `, hoje com ${f.fmtP(sa)}` : ''}.`,
        en: `${f.fmtP(num(d.share))} of traffic over the last 7 days. The previous leader was ${str(d.anterior_nome)}${sa != null ? `, now at ${f.fmtP(sa)}` : ''}.`,
      });
      break;
    }
    case 'top10':
      titulo = t({ pt: `${n} entrou no top 10`, en: `${n} entered the top 10` });
      texto = t({ pt: `${f.ord(num(d.posicao) ?? 0)} lugar, com ${f.fmtP(num(d.share))} do tráfego dos últimos 7 dias.`,
        en: `Ranked ${f.ord(num(d.posicao) ?? 0)}, with ${f.fmtP(num(d.share))} of traffic over the last 7 days.` });
      break;
    case 'alta':
      titulo = t({ pt: `${n} ganhou ${f.dec((num(d.delta_pp) ?? 0).toFixed(1))} pontos de share`, en: `${n} gained ${f.dec((num(d.delta_pp) ?? 0).toFixed(1))} points of share` });
      texto = t({ pt: `De ${f.fmtP(num(d.de))} para ${f.fmtP(num(d.para))} entre as duas últimas janelas de 7 dias.`,
        en: `From ${f.fmtP(num(d.de))} to ${f.fmtP(num(d.para))} between the last two 7-day windows.` });
      break;
  }
  return { rotulo, titulo, texto, cruzamento: cruzamento(ev, I) };
}

const CATEGORIA: Record<string, { pt: string; en: string }> = {
  lancamento: { pt: 'Lançamento', en: 'Launch' },
  preco: { pt: 'Preço', en: 'Pricing' },
  regulacao: { pt: 'Regulação', en: 'Regulation' },
  seguranca: { pt: 'Segurança', en: 'Safety' },
  mercado: { pt: 'Mercado', en: 'Market' },
  capacidade: { pt: 'Capacidade', en: 'Capability' },
  infraestrutura: { pt: 'Infraestrutura', en: 'Infrastructure' },
};

/** Dia de publicação no fuso de Brasília ('AAAA-MM-DD'), a partir do horário UTC da fonte. */
export function diaPublicacao(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Texto de um assunto da pauta no idioma, com o cruzamento dos laboratórios citados. */
export function textoAssunto(a: AssuntoPauta, I: Idioma): FraseRadar {
  const { t, f } = I;
  const x = a[I.lang];
  const partes = (a.cruzamento ?? []).map(c => {
    const lab = I.nomeLab(c.lab);
    const base = num(c.share_tokens) != null && num(c.share_gasto) != null
      ? t({ pt: `${lab} tem ${f.fmtP(c.share_tokens)} dos tokens e ${f.fmtP(c.share_gasto)} do gasto estimado da semana`,
          en: `${lab} has ${f.fmtP(c.share_tokens)} of tokens and ${f.fmtP(c.share_gasto)} of estimated spend this week` })
      : null;
    const lider = c.lider
      ? t({ pt: `o modelo mais usado é o ${c.lider.nome}, com ${f.fmtP(c.lider.share_7d, 2)}`,
          en: `its most used model is ${c.lider.nome}, with ${f.fmtP(c.lider.share_7d, 2)}` })
      : null;
    const s = [base, lider].filter(Boolean).join(t({ pt: ', e ', en: ', and ' }));
    return s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : null;
  }).filter((s): s is string => !!s);
  return {
    rotulo: t(CATEGORIA[a.categoria] ?? { pt: 'Pauta', en: 'News' }),
    titulo: x.titulo, texto: x.resumo,
    cruzamento: partes.length ? partes.join(' ') : null,
  };
}

/** Título da edição: o assunto principal da pauta, senão o evento principal, senão o aviso de dia sem mudança. */
export function tituloEdicao(ed: EdicaoRadar, I: Idioma): string {
  const a = ed.assuntos?.[0];
  if (a) return a[I.lang].titulo;
  const ev = ed.eventos[0];
  return ev ? frase(ev, ed.dia, I).titulo : I.t({ pt: 'Nenhuma mudança relevante', en: 'No relevant changes' });
}

/** Quantidade de itens da edição: assuntos da pauta e eventos do dado. */
export const totalItens = (ed: EdicaoRadar) => (ed.assuntos?.length ?? 0) + ed.eventos.length;
