"""Movimentos dos laboratorios: o que cada um publicou nas proprias notas de versao.

A pauta conta o que saiu na imprensa; os movimentos contam o que o laboratorio
registrou no proprio changelog: modelo novo, preco, desativacao, recurso de API.
Dez laboratorios, escolhidos pelo trafego (decisao de 24/10/2026): os tres pagos
dos EUA (Anthropic, OpenAI, Google) e os sete chineses de maior volume em 90 dias,
com Moonshot e Qwen por nome. A lista e revista a cada trimestre.

Quem escreve e so a pauta (pipeline/pauta.py), segunda, quarta e sexta: coleta
olhando LOOKBACK_DIAS para tras, tira o que ja foi publicado ou ignorado em pauta
anterior (ou no registro inicial) e manda o resto para a IA, que decide o que e
relevante e escreve titulo, versao simples e versao tecnica em portugues e ingles.
Um escritor por arquivo: nenhum PR de pauta conflita com os commits diarios do bot,
e pauta perdida nao perde movimento, porque a proxima olha 14 dias para tras.

Sem rede neste modulo: quem chama passa get(url) -> texto.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INICIAL = ROOT / "data" / "movimentos" / "inicial.json"

LOOKBACK_DIAS = 14     # pauta perdida nao perde movimento: a seguinte ainda alcanca
MAX_POR_LAB_IA = 12    # itens por laboratorio enviados a IA, do mais novo para o mais velho
MAX_IA = 80            # teto do pedido
MAX_POR_LAB = 3        # movimentos publicados por laboratorio numa edicao
TEXTO_MAX = 900        # caracteres do trecho guardado e enviado a IA

TIPOS = {"modelo": 5, "preco": 4, "desativacao": 4, "api": 3, "app": 2, "outro": 0}

# Ordem de exibicao: grupo, depois a ordem desta lista dentro do grupo quando o dado empata.
LABS = {
    "anthropic": {"nome": "Anthropic", "grupo": "eua"},
    "openai": {"nome": "OpenAI", "grupo": "eua"},
    "google": {"nome": "Google", "grupo": "eua"},
    "deepseek": {"nome": "DeepSeek", "grupo": "china"},
    "z-ai": {"nome": "Z.ai (GLM)", "grupo": "china"},
    "tencent": {"nome": "Tencent", "grupo": "china"},
    "xiaomi": {"nome": "Xiaomi", "grupo": "china"},
    "minimax": {"nome": "MiniMax", "grupo": "china"},
    "moonshotai": {"nome": "Moonshot AI", "grupo": "china"},
    "qwen": {"nome": "Qwen", "grupo": "china"},
}

# Organizacoes no Hugging Face: pesos abertos aparecem la antes de qualquer blog, e para
# Tencent e Xiaomi e a unica fonte oficial legivel por robo.
ORGS_HF = {
    "deepseek-ai": "deepseek", "zai-org": "z-ai", "tencent": "tencent", "XiaomiMiMo": "xiaomi",
    "MiniMaxAI": "minimax", "moonshotai": "moonshotai", "Qwen": "qwen", "google": "google", "openai": "openai",
}
DERIVADO = re.compile(r"(gguf|awq|gptq|fp8|fp4|int4|int8|nvfp4|mlx|bnb|eagle|mtp|draft|onnx|-4bit|-8bit)", re.I)

MESES = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}
_MES = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?"


# ------------------------------------------------------------------ datas e texto

def data_de(txt):
    """'October 22, 2026', 'Oct. 19, 2026', '2026-08-26', '2026.10.13' -> 'AAAA-MM-DD';
    'September 2026', 'Apr. 2026', 'October, 2026' -> 'AAAA-MM'. Texto longo nao e cabecalho de data."""
    s = re.sub(r"\s+", " ", txt or "").strip().strip("*# ").strip()
    if not s or len(s) > 32:
        return None
    m = re.fullmatch(_MES + r" (\d{1,2}),? (20\d\d)", s, re.I)
    if m:
        return f"{int(m.group(3)):04d}-{MESES[m.group(1)[:3].lower()]:02d}-{int(m.group(2)):02d}"
    m = re.fullmatch(r"(20\d\d)[-./](\d{1,2})[-./](\d{1,2})", s)
    if m:
        return f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    m = re.fullmatch(_MES + r",? (20\d\d)", s, re.I)
    if m:
        return f"{int(m.group(2)):04d}-{MESES[m.group(1)[:3].lower()]:02d}"
    return None


def recente(data, desde):
    """data 'AAAA-MM-DD' ou 'AAAA-MM' contra o dia 'AAAA-MM-DD' de corte. Mes inteiro vale se for o mes do corte ou depois."""
    if not data:
        return False
    return data >= desde if len(data) == 10 else data >= desde[:7]


def limpar_md(txt, n=TEXTO_MAX):
    t = html.unescape(txt or "")
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", t)                  # imagem
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)                # link: fica o texto
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"(?m)^\s{0,3}(?:[*-]|>|#{1,6})\s?", " ", t)       # marcador de lista, citacao, cabecalho
    t = t.replace("**", "").replace("__", "").replace("`", "").replace("\\*", "")
    t = "".join(c for c in t if unicodedata.category(c) != "So")  # emoji de titulo
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def limpar_html(txt, n=TEXTO_MAX):
    t = re.sub(r"<script.*?</script>|<style.*?</style>|<svg.*?</svg>", " ", txt or "", flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    return limpar_md(t, n)


def dominio(url):
    m = re.match(r"https?://([^/]+)", url or "")
    h = (m.group(1) if m else "").lower()
    return h[4:] if h.startswith("www.") else h


def primeiro_link(txt, dominios, base=""):
    """Primeiro link do bloco que aponta para o proprio laboratorio (markdown ou href)."""
    for u in re.findall(r"\]\((https?://[^)\s]+)\)|href=\"([^\"]+)\"", txt or ""):
        u = next(x for x in u if x)
        if u.startswith("/"):
            u = base + u
        d = dominio(u)
        if any(d == x or d.endswith("." + x) for x in dominios):
            return re.sub(r"\.md(#|$)", r"\1", u)
    return None


def mov_id(lab, fonte, data, texto):
    """Identidade estavel: laboratorio, fonte, data e o comeco do texto sem pontuacao.
    A fonte pode reescrever o fim de um item sem que ele volte como novo."""
    chave = re.sub(r"[^a-z0-9]", "", texto.lower())[:80]
    return hashlib.sha1(f"{lab}|{fonte}|{data}|{chave}".encode()).hexdigest()[:12]


def bruto(lab, fonte, link, data, texto):
    texto = limpar_md(texto)
    return {"id": mov_id(lab, fonte, data, texto), "lab": lab, "fonte": fonte, "link": link, "data": data, "texto": texto}


# ------------------------------------------------------------------ markdown (Mintlify e afins)

CAB_MD = re.compile(r"^(?:#{2,5}\s+(.+?)\s*#*|\*\*([^*]+)\*\*)\s*$")


def secoes_md(md):
    """[(data, linhas)] a cada cabecalho de data ('## October 13, 2026', '#### Oct. 19, 2026',
    '**2026-08-26**', '**September 2026**'). O que vem antes do primeiro cabecalho fica de fora."""
    out, atual = [], None
    for ln in (md or "").splitlines():
        m = CAB_MD.match(ln.strip())
        d = data_de(m.group(1) or m.group(2)) if m else None
        if d:
            atual = (d, [])
            out.append(atual)
        elif atual is not None:
            if re.match(r"^#{1,2}\s", ln) and not re.match(r"^#{2}\s+" + _MES, ln):
                atual = None          # titulo de outra parte da pagina encerra a secao
                continue
            atual[1].append(ln)
    return out


def blocos_md(linhas, modo="itens"):
    """Um item por marcador de lista no primeiro nivel, por subtitulo (###) ou por cartao citado ('> **').
    modo='secao': a secao inteira e um item so (uma versao por data, como na Z.ai)."""
    if modo == "secao":
        txt = "\n".join(linhas).strip()
        return [txt] if txt else []
    blocos, atual = [], None
    for ln in linhas:
        if re.match(r"^[*-]\s", ln) or re.match(r"^#{3,6}\s", ln) or re.match(r"^>\s*\*\*", ln):
            atual = [ln]
            blocos.append(atual)
        elif atual is not None:
            atual.append(ln)
        elif ln.strip():
            atual = [ln]
            blocos.append(atual)
    out = []
    for b in blocos:
        # subtitulo seguido de texto vira um item so; subtitulo sozinho nao e item
        txt = "\n".join(b).strip()
        if txt and not (re.match(r"^#{3,6}\s", txt) and "\n" not in txt):
            out.append(txt)
    return out


def fonte_md(lab, fonte, url_md, pagina, dominios, modo="itens"):
    def coletar(get, desde):
        out = []
        for data, linhas in secoes_md(get(url_md)):
            if not recente(data, desde):
                continue
            for b in blocos_md(linhas, modo):
                txt = limpar_md(b)
                if len(txt) >= 25:
                    out.append(bruto(lab, fonte, primeiro_link(b, dominios) or pagina, data, txt))
        return out
    return coletar


# ------------------------------------------------------------------ paginas HTML

def coletar_openai(get, desde):
    """Changelog da API da OpenAI: cabecalho por mes ('October, 2026') e uma etiqueta 'Oct 22' por item,
    seguida das etiquetas de tipo e modelo. As release notes do ChatGPT recusam robo (HTTP 403)."""
    base = "https://developers.openai.com"
    pg = get(base + "/changelog")
    meses = [(m.start(), int(m.group(2))) for m in re.finditer(r"<h3[^>]*>\s*([A-Z][a-z]+),\s*(20\d\d)\s*</h3>", pg)]
    marcas = list(re.finditer(r'data-variant="outline"[^>]*>\s*' + r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\s*</div>", pg))
    out = []
    for k, m in enumerate(marcas):
        ano = next((a for p, a in reversed(meses) if p < m.start()), None)
        if not ano:
            continue
        data = f"{ano:04d}-{MESES[m.group(1).lower()]:02d}-{int(m.group(2)):02d}"
        if not recente(data, desde):
            continue
        # a etiqueta seguinte comeca no meio de um <div>: corta no "<" que abre a tag dela
        fim = pg.rfind("<", 0, marcas[k + 1].start()) if k + 1 < len(marcas) else len(pg)
        prox = next((p for p, _ in meses if p > m.start()), None)
        bloco = pg[m.end(): min(fim, prox) if prox else fim]
        tags = [limpar_html(x, 60) for x in re.findall(r'data-variant="soft"[^>]*>(?:\s*<span[^>]*>)?([^<]+)<', bloco)]
        # o corpo inteiro, sem as etiquetas: preco costuma vir em tabela ou lista, nao em paragrafo
        sem_tags = re.sub(r'<div[^>]*data-variant="soft"[^>]*>.*?</div>', " ", bloco, flags=re.S)
        corpo = limpar_html(re.sub(r"</(p|li|tr|td|th|h\d)>", r". </\1>", sem_tags))
        corpo = re.sub(r"\s*\.\s*(\.\s*)+", ". ", corpo).strip(" .")
        if len(corpo) < 25:
            continue
        txt = (f"[{', '.join(t for t in tags if t)}] " if tags else "") + corpo
        out.append(bruto("openai", "OpenAI API changelog", primeiro_link(bloco, {"openai.com"}, base) or base + "/changelog", data, txt))
    return out


def coletar_gemini_app(get, desde):
    """Notas do app Gemini: uma data por <h2> ('2026.10.13') e um recurso por <h3> com 'What' e 'Why'."""
    url = "https://gemini.google/release-notes/"
    pg = get(url)
    hs = list(re.finditer(r"<h2[^>]*>(.*?)</h2>", pg, re.S))
    out = []
    for k, h in enumerate(hs):
        data = data_de(limpar_html(h.group(1), 40))
        if not data or not recente(data, desde):
            continue
        secao = pg[h.end(): hs[k + 1].start() if k + 1 < len(hs) else len(pg)]
        for t in re.split(r"(?=<h3[^>]*>)", secao):
            m = re.match(r"<h3[^>]*>(.*?)</h3>(.*)", t, re.S)
            if not m:
                continue
            titulo, corpo = limpar_html(m.group(1), 200), limpar_html(m.group(2))
            if titulo:
                out.append(bruto("google", "Gemini app release notes", url, data, f"{titulo}. {corpo}"))
    return out


def coletar_alibaba(get, desde):
    """Tabela de lancamentos do Model Studio (Alibaba Cloud): so os modelos Qwen, um item por data.
    A pagina repete a tabela por regiao; a mesma linha conta uma vez."""
    url = "https://www.alibabacloud.com/help/en/model-studio/newly-released-models"
    pg = get(url)
    por_dia, vistos = {}, set()
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", pg, re.S):
        tds = [limpar_html(x, 400) for x in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if len(tds) < 5:
            continue
        tipo, data, _, modelo, desc = tds[:5]
        data = data_de(data)
        if not data or not recente(data, desde) or "qwen" not in modelo.lower() or (data, modelo) in vistos:
            continue
        vistos.add((data, modelo))
        por_dia.setdefault(data, []).append(f"{modelo} ({tipo}): {desc}")
    return [bruto("qwen", "Alibaba Model Studio", url, d, " | ".join(linhas)) for d, linhas in sorted(por_dia.items())]


NAO_TITULO = re.compile(r"^(english|news|中文.*|next.*|previous.*)$", re.I)


def noticias_deepseek(get):
    """Notas da API da DeepSeek: [(link, 'AAAA-MM-DD', titulo, corpo)]. A data esta no endereco
    (/news/newsAAMMDD). O mesmo endereco aparece em varios links da pagina, e o primeiro e o
    seletor de idioma ("English"): vale o primeiro texto que e titulo de verdade. A nota mais
    recente e a pagina aberta, e dela vem o titulo do h1 e o comeco do texto."""
    home = get("https://api-docs.deepseek.com/")
    ultima = re.search(r'href="(/news/news\d{6})"', home)
    if not ultima:
        raise RuntimeError("link de noticias nao encontrado")
    pagina = get("https://api-docs.deepseek.com" + ultima.group(1))
    titulos = {}
    for m in re.finditer(r'<a[^>]+href="(/news/news(\d{2})(\d{2})(\d{2}))"[^>]*>(.*?)</a>', pagina, re.I | re.S):
        t = limpar_html(m.group(5), 200)
        if t and not NAO_TITULO.match(t) and m.group(1) not in titulos:
            titulos[m.group(1)] = (f"20{m.group(2)}-{m.group(3)}-{m.group(4)}", t)
    h1 = re.search(r"<h1[^>]*>(.*?)</h1>", pagina, re.S)
    artigo = re.search(r"<article[^>]*>(.*?)</article>", pagina, re.S)
    out = []
    for href, (data, t) in titulos.items():
        corpo = ""
        if href == ultima.group(1):
            t = limpar_html(h1.group(1), 200) if h1 else t
            corpo = limpar_html(re.sub(r"<h1[^>]*>.*?</h1>", " ", artigo.group(1), flags=re.S), 700) if artigo else ""
            corpo = re.sub(r"^.*?\bOn this page\b\s*", "", corpo)
        out.append(("https://api-docs.deepseek.com" + href, data, t, corpo))
    return out


def coletar_deepseek(get, desde):
    return [bruto("deepseek", "DeepSeek API news", link, data, f"{t}. {corpo}" if corpo else t)
            for link, data, t, corpo in noticias_deepseek(get) if recente(data, desde)]


def coletar_hf(get, desde):
    """Pesos novos no Hugging Face, um item por laboratorio e dia (oito tamanhos no mesmo dia sao um lancamento)."""
    por = {}
    for org, lab in ORGS_HF.items():
        for m in json.loads(get(f"https://huggingface.co/api/models?author={org}&sort=createdAt&direction=-1&limit=20")):
            data = (m.get("createdAt") or "")[:10]
            nome = (m.get("id") or "").split("/", 1)[-1]
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", data) or not recente(data, desde) or not nome \
                    or DERIVADO.search(nome) or m.get("private"):
                continue
            por.setdefault((lab, data), []).append((nome, m.get("pipeline_tag") or "model", m["id"]))
    out = []
    for (lab, data), ms in sorted(por.items()):
        ms.sort()
        txt = f"{LABS[lab]['nome']} published open weights on Hugging Face: " + ", ".join(f"{n} ({t})" for n, t, _ in ms[:12])
        link = f"https://huggingface.co/{ms[0][2]}" if len(ms) == 1 else f"https://huggingface.co/{ms[0][2].split('/')[0]}"
        out.append(bruto(lab, "Hugging Face", link, data, txt))
    return out


FONTES = {
    "anthropic": fonte_md("anthropic", "Claude Platform release notes",
                          "https://platform.claude.com/docs/en/release-notes/overview.md",
                          "https://platform.claude.com/docs/en/release-notes/overview", {"claude.com", "anthropic.com"}),
    "openai": coletar_openai,
    "google_api": fonte_md("google", "Gemini API changelog", "https://ai.google.dev/gemini-api/docs/changelog.md.txt",
                           "https://ai.google.dev/gemini-api/docs/changelog", {"ai.google.dev", "blog.google", "deepmind.google"}),
    "google_app": coletar_gemini_app,
    "deepseek": coletar_deepseek,
    "z-ai": fonte_md("z-ai", "Z.ai release notes", "https://docs.z.ai/release-notes/new-released.md",
                     "https://docs.z.ai/release-notes/new-released", {"z.ai"}, modo="secao"),
    "minimax": fonte_md("minimax", "MiniMax release notes", "https://platform.minimax.io/docs/release-notes/models.md",
                        "https://platform.minimax.io/docs/release-notes/models", {"minimax.io"}),
    "moonshotai": fonte_md("moonshotai", "Kimi platform changelog", "https://platform.kimi.ai/docs/platform-changelog.md",
                           "https://platform.kimi.ai/docs/platform-changelog", {"kimi.ai", "moonshot.ai", "kimi.com"}),
    "qwen": coletar_alibaba,
    "hf": coletar_hf,
}

# Paginas oficiais acompanhadas, por laboratorio: o site lista para o leitor conferir.
PAGINAS = {
    "anthropic": [("Claude Platform release notes", "https://platform.claude.com/docs/en/release-notes/overview")],
    "openai": [("OpenAI API changelog", "https://developers.openai.com/changelog")],
    "google": [("Gemini API changelog", "https://ai.google.dev/gemini-api/docs/changelog"),
               ("Gemini app release notes", "https://gemini.google/release-notes/")],
    "deepseek": [("DeepSeek API news", "https://api-docs.deepseek.com/"), ("Hugging Face", "https://huggingface.co/deepseek-ai")],
    "z-ai": [("Z.ai release notes", "https://docs.z.ai/release-notes/new-released"), ("Hugging Face", "https://huggingface.co/zai-org")],
    "tencent": [("Hugging Face", "https://huggingface.co/tencent")],
    "xiaomi": [("Hugging Face", "https://huggingface.co/XiaomiMiMo")],
    "minimax": [("MiniMax release notes", "https://platform.minimax.io/docs/release-notes/models"), ("Hugging Face", "https://huggingface.co/MiniMaxAI")],
    "moonshotai": [("Kimi platform changelog", "https://platform.kimi.ai/docs/platform-changelog"), ("Hugging Face", "https://huggingface.co/moonshotai")],
    "qwen": [("Alibaba Model Studio", "https://www.alibabacloud.com/help/en/model-studio/newly-released-models"), ("Hugging Face", "https://huggingface.co/Qwen")],
}


def coletar(get, dia, fontes=FONTES, lookback=LOOKBACK_DIAS):
    """Itens brutos de todas as fontes desde dia - lookback, sem repetir id. Uma fonte fora nao derruba as outras."""
    desde = (dt.date.fromisoformat(dia) - dt.timedelta(days=lookback)).isoformat()
    itens, status, vistos = [], {}, set()
    for nome, f in fontes.items():
        try:
            achados = [x for x in f(get, desde) if x["id"] not in vistos]
            vistos |= {x["id"] for x in achados}
            status[nome] = {"ok": True, "itens": len(achados)}
            itens += achados
        except Exception as e:
            status[nome] = {"ok": False, "erro": f"{type(e).__name__}: {str(e)[:120]}"}
    itens.sort(key=lambda x: (x["data"], x["lab"], x["id"]), reverse=True)
    return itens, status


# ------------------------------------------------------------------ registro

def registrados(pasta, dia, inicial=INICIAL):
    """Ids ja publicados ou ignorados: pautas mescladas antes de dia e o registro inicial."""
    ids = set()
    arqs = [p for p in sorted(Path(pasta).glob("????-??-??.json")) if p.name[:10] < dia]
    if Path(inicial).exists():
        arqs.append(Path(inicial))
    for arq in arqs:
        p = json.loads(arq.read_text())
        ids |= {m["id"] for m in p.get("movimentos", []) + p.get("movimentos_ignorados", [])}
    return ids


def todos(pasta, inicial=INICIAL):
    """Movimentos publicados, do mais novo para o mais velho, com o dia da edicao que os trouxe."""
    out = []
    arqs = sorted(Path(pasta).glob("????-??-??.json"))
    if Path(inicial).exists():
        arqs.append(Path(inicial))
    for arq in arqs:
        p = json.loads(arq.read_text())
        for m in p.get("movimentos", []):
            out.append({**m, "edicao": p.get("dia")})
    out.sort(key=lambda m: (m["data"], TIPOS.get(m["tipo"], 0), m["id"]), reverse=True)
    return out


# ------------------------------------------------------------------ redacao

def sistema(aviso):
    return f"""Você escreve o registro de movimentos oficiais dos laboratórios de IA para um site brasileiro sobre o mercado de modelos de linguagem, em português do Brasil e em inglês americano.
{aviso}
Cada item é um trecho das notas de versão, do changelog ou da página oficial do próprio laboratório. Para cada item, decida se é relevante para quem escolhe e integra modelos e, se for, escreva o registro.
Relevante: modelo novo ou versão nova, inclusive pesos abertos; mudança de preço, cota ou plano; desativação de modelo ou recurso; recurso de API que muda o que dá para construir (ferramenta, endpoint, modalidade, janela de contexto, disponibilidade geral do que estava em beta, nova nuvem ou região); lançamento relevante no app de consumo.
Não relevante: ajuste de console ou painel, documentação, correção pequena de SDK, recurso administrativo ou de conformidade só para planos empresariais, conta e cobrança sem mudança de preço, modelo de outra empresa.
Responda somente com JSON no formato:
{{"movimentos": [{{"id": "m1", "relevante": true, "tipo": "...", "pt": {{"titulo": "...", "simples": "...", "tecnico": "..."}}, "en": {{"titulo": "...", "simples": "...", "tecnico": "..."}}}}, {{"id": "m2", "relevante": false, "motivo": "..."}}]}}
Regras:
- Responda todos os ids. Item não relevante leva só "id", "relevante": false e "motivo" (até 60 caracteres, em português).
- "tipo": exatamente um de {sorted(TIPOS)}. modelo = modelo ou versão nova; preco = preço, cota, plano ou desconto; desativacao = modelo ou recurso que sai do ar; api = recurso de API, SDK, ferramenta, endpoint ou nuvem; app = produto de consumo; outro.
- Use SOMENTE o que está no trecho. Não acrescente contexto, comparação, causa, avaliação ou opinião.
- titulo: até 80 caracteres, afirmativo, começando pelo produto ou pelo modelo, sem ponto final.
- simples: uma frase de até 200 caracteres que diz o que mudou em palavras simples, para quem não é técnico.
- tecnico: até 320 caracteres com o detalhe técnico do trecho, como identificador do modelo, endpoint, parâmetro, cabeçalho beta, preço ou data de desativação. Se o trecho não tiver detalhe técnico, deixe vazio.
- Todo número do texto precisa aparecer no trecho, escrito do mesmo jeito ou com a mesma quantidade.
- Não escreva a data do item: o registro já sai datado. Data de desativação ou de cobrança que o trecho trouxer pode entrar.
- Identificadores de modelo, endpoint e parâmetro ficam escritos como no trecho.
- Português com acentuação e cedilha corretas. Nunca use travessão nem meia-risca: use vírgula.
- Inglês: caixa de frase no título, sem vírgula de Oxford.
"""


def checar(x, trecho, numeros_ok, valida_pt, en_ascii):
    """Registro pronto para gravar, ou o motivo da recusa. Mesmas travas da pauta: tamanho,
    travessao, acento no portugues, todo numero no trecho e ingles sem acento."""
    tipo = x.get("tipo") if x.get("tipo") in TIPOS else None
    if not tipo:
        return None, "tipo invalido"
    out = {"tipo": tipo}
    for lang in ("pt", "en"):
        t = x.get(lang)
        if not isinstance(t, dict):
            return None, f"{lang} ausente"
        ti, si, te = (str(t.get(k) or "").strip() for k in ("titulo", "simples", "tecnico"))
        if not ti or not si:
            return None, f"titulo ou simples vazio em {lang}"
        if len(ti) > 90 or len(si) > 240 or len(te) > 380:
            return None, f"texto longo demais em {lang}"
        tudo = f"{ti} {si} {te}"
        if "—" in tudo or "–" in tudo:
            return None, "travessao"
        ok, faltam = numeros_ok(tudo, trecho)
        if not ok:
            return None, f"numero fora do trecho em {lang}: {faltam}"
        out[lang] = {"titulo": ti.rstrip("."), "simples": si, "tecnico": te}
    erro = valida_pt({"titulo": out["pt"]["titulo"], "resumo": out["pt"]["simples"] + " " + out["pt"]["tecnico"]})
    if erro:
        return None, erro
    out["en"] = {k: en_ascii(v) for k, v in out["en"].items()}
    return out, None


def redigir(claude, itens, aviso, numeros_ok, valida_pt, en_ascii, log=print):
    """{id_bruto: registro} dos relevantes e {id_bruto: motivo} dos ignorados ou recusados.
    Recusa nas travas ganha uma segunda tentativa, com o motivo."""
    if not itens:
        return {}, {}
    curto = {f"m{i + 1}": it for i, it in enumerate(itens)}
    pedido = [{"id": k, "laboratorio": LABS[it["lab"]]["nome"], "fonte": it["fonte"], "trecho": it["texto"]} for k, it in curto.items()]
    feitos, ignorados, problemas = {}, {}, {}
    msg = "Itens:\n" + json.dumps(pedido, ensure_ascii=False, indent=1)
    for rodada in range(2):
        resp = claude.json(sistema(aviso), msg) or {}
        problemas = {}
        for x in resp.get("movimentos", []):
            k = x.get("id")
            if k not in curto or curto[k]["id"] in feitos or curto[k]["id"] in ignorados:
                continue
            it = curto[k]
            if x.get("relevante") is False:
                ignorados[it["id"]] = str(x.get("motivo") or "não relevante")[:80]
                continue
            reg, erro = checar(x, it["texto"] + " " + LABS[it["lab"]]["nome"], numeros_ok, valida_pt, en_ascii)
            if erro:
                problemas[k] = erro
                continue
            feitos[it["id"]] = reg
        faltam = [k for k, it in curto.items() if it["id"] not in feitos and it["id"] not in ignorados]
        if not faltam or rodada == 1:
            break
        log(f"  movimentos: {len(faltam)} sem registro valido, nova tentativa")
        msg = ("Itens:\n" + json.dumps([p for p in pedido if p["id"] in faltam], ensure_ascii=False, indent=1)
               + "\n\nA versão anterior foi recusada por: " + json.dumps({k: problemas.get(k, "ausente") for k in faltam}, ensure_ascii=False)
               + ". Corrija seguindo as regras.")
    for k, it in curto.items():
        if it["id"] not in feitos and it["id"] not in ignorados:
            ignorados[it["id"]] = f"recusado: {problemas.get(k, 'sem resposta')}"
    return feitos, ignorados


def selecionar(itens, ja, excluir_links=()):
    """Itens novos para a IA: fora o que ja foi registrado e o que a pauta do dia ja conta como noticia."""
    norm = lambda u: re.sub(r"[?#].*$", "", u or "").rstrip("/").lower()  # noqa: E731
    fora = {norm(u) for u in excluir_links}
    por_lab, out = {}, []
    for it in itens:
        if it["id"] in ja or it["lab"] not in LABS or (it["link"] and norm(it["link"]) in fora):
            continue
        n = por_lab.get(it["lab"], 0)
        if n >= MAX_POR_LAB_IA:
            continue
        por_lab[it["lab"]] = n + 1
        out.append(it)
    return out[:MAX_IA]


def montar(dia, claude, get, ja, aviso, numeros_ok, valida_pt, en_ascii, excluir_links=(), log=print, fontes=FONTES):
    """Bloco de movimentos da edicao: {movimentos, movimentos_ignorados, fontes_movimentos}."""
    itens, status = coletar(get, dia, fontes=fontes)
    novos = selecionar(itens, ja, excluir_links)
    log(f"  movimentos: {len(itens)} itens nas fontes, {len(novos)} novos")
    feitos, ignorados = redigir(claude, novos, aviso, numeros_ok, valida_pt, en_ascii, log=log) if novos else ({}, {})
    pub = [{**{k: it[k] for k in ("id", "lab", "fonte", "link", "data")}, **feitos[it["id"]]} for it in novos if it["id"] in feitos]
    final, por_lab, sobra = [], {}, []
    for m in sorted(pub, key=lambda m: (TIPOS[m["tipo"]], m["data"]), reverse=True):
        if por_lab.get(m["lab"], 0) >= MAX_POR_LAB:
            sobra.append(m)
            continue
        por_lab[m["lab"]] = por_lab.get(m["lab"], 0) + 1
        final.append(m)
    ign = [{"id": it["id"], "lab": it["lab"], "data": it["data"], "motivo": ignorados[it["id"]]} for it in novos if it["id"] in ignorados]
    ign += [{"id": m["id"], "lab": m["lab"], "data": m["data"], "motivo": f"limite de {MAX_POR_LAB} por laboratório na edição"} for m in sobra]
    # exibicao: laboratorio na ordem de LABS, dentro dele o tipo de mais peso e o mais novo primeiro
    ordem = list(LABS)
    final.sort(key=lambda m: m["data"], reverse=True)
    final.sort(key=lambda m: (ordem.index(m["lab"]), -TIPOS[m["tipo"]]))
    return {"movimentos": final, "movimentos_ignorados": ign, "fontes_movimentos": status}
