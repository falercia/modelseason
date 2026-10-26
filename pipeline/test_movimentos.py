"""Checagens offline dos movimentos dos laboratorios (pipeline/movimentos.py) e da ligacao com a pauta.

Paginas sinteticas com a mesma estrutura das reais (24/10/2026): Markdown das docs em Mintlify
(Claude, Gemini API, Z.ai, MiniMax, Kimi), HTML do changelog da OpenAI, do app Gemini, da tabela
do Model Studio e das notas da DeepSeek, e a API do Hugging Face.

Uso: python pipeline/test_movimentos.py
"""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import movimentos as M  # noqa: E402
import pauta as P  # noqa: E402

falhas = []


def ok(nome, cond, det=""):
    print(("  ok  " if cond else "  X   ") + nome + ("" if cond else f"  [{det}]"))
    if not cond:
        falhas.append(nome)


DIA = "2026-10-24"
DESDE = "2026-10-10"

# ------------------------------------------------------------------ datas e texto
ok("data por extenso", M.data_de("October 22, 2026") == "2026-10-22")
ok("data abreviada com ponto", M.data_de("Oct. 19, 2026") == "2026-10-19")
ok("data ISO e com ponto", M.data_de("2026-08-26") == "2026-08-26" and M.data_de("2026.10.13") == "2026-10-13")
ok("so o mes", M.data_de("September 2026") == "2026-09" and M.data_de("Apr. 2026") == "2026-04" and M.data_de("October, 2026") == "2026-10")
ok("texto longo nao e cabecalho de data", M.data_de("We launched on October 22, 2026 a new model for everyone") is None)
ok("recente por dia e por mes", M.recente("2026-10-10", DESDE) and not M.recente("2026-10-09", DESDE)
   and M.recente("2026-10", DESDE) and not M.recente("2026-09", DESDE))
ok("limpar_md tira link, crase, negrito e emoji",
   M.limpar_md("* We've launched [Claude X](https://a.b/c) (`claude-x`) **now** 🚀") == "We've launched Claude X (claude-x) now")
BASE_TXT = "Fast mode is available for Claude Opus 5.5 on Claude Models on Google Cloud (Anthropic managed) for every customer"
a = M.mov_id("anthropic", "f", "2026-10-22", BASE_TXT + ". See the guide.")
b = M.mov_id("anthropic", "f", "2026-10-22", BASE_TXT + ", with a rewritten ending and a new link.")
ok("id estavel quando a fonte reescreve o fim do item", a == b)
ok("id muda com a data", a != M.mov_id("anthropic", "f", "2026-10-23", "Fast mode is available for Claude Opus 5.5 on Google Cloud"))

# ------------------------------------------------------------------ paginas sinteticas
CLAUDE_MD = """---
title: Claude Platform release notes
---

Intro text that is not an item.

### October 22, 2026

* We've launched [Claude Models on Google Cloud](https://platform.claude.com/docs/en/build-with-claude/gc.md), the Claude API operated by Anthropic.
* [Fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode) is available for Claude Opus 5.5 on Google Cloud.

### October 9, 2026

* An old item from before the window, long enough to count as an item.
"""
ZAI_MD = """# New Released

## Models

**2026-10-20**

GLM-6

* Stronger coding: a 50% gain over GLM-5.3 on the internal bench.

* Learn more in our [documentation](https://docs.z.ai/guides/llm/glm-6.md).

**2026-08-26**

GLM-5.3-Flash

* Native visual capabilities.
"""
MINIMAX_MD = """# Models

#### Oct. 19, 2026

> **[MiniMax M3.1 Flash](https://www.minimax.io/blog/minimax-m31f)**
>
> An ultra-efficient open-weight model for everyday work.

#### Jul. 31, 2026

> **[MiniMax H3](https://www.minimax.io/blog/minimax-h3)**
>
> A video model.
"""
KIMI_MD = """# Platform Changelog

**October 2026**

### 🔍 Web Search API

Launch web searches through `/v1/tools/search` and get structured results for agents. See [Web Search](https://platform.kimi.ai/docs/api/tools-search.md).

* The `kimi-k2.5` model was retired across all platforms and now returns a 404 error.

**September 2026**

* Something from last month that falls outside the window.
"""
OPENAI_HTML = """<html><h1>Changelog</h1><div><h3 class="x">October, 2026</h3><div>
<div><div><div class="b" data-color="secondary" data-size="md" data-variant="outline">Oct 22</div></div><div><div>
<div class="b" data-variant="soft"><span>Update</span></div><div class="b" data-variant="soft">gpt-6-luna</div></div>
<div><p>The <a href="/api/docs/guides/decisions">Decisions API</a> is now generally available with <code>gpt-6-luna</code>.</p></div></div></div>
<div><div><div class="b" data-color="secondary" data-size="md" data-variant="outline">Oct 12</div></div><div><div>
<div class="b" data-variant="soft"><span>Feature</span></div></div>
<div><p>Released GPT-6 Sol. Standard pricing per 1M tokens:</p><ul><li>GPT-6 Sol: $2 input and $10 output.</li></ul></div></div></div>
</div><h3>September, 2026</h3><div>
<div><div><div class="b" data-variant="outline">Sep 3</div></div><div><p>Released GPT-6 Astra, our most capable model for the hardest work.</p></div></div>
</div></div></html>"""
GEMINI_APP = """<main><h1>Release Notes</h1><div><h2>2026.10.13</h2><div><div><h3>Introducing Gemini 4 Argon</h3>
<ul><li><p><b>What:</b> Gemini 4 Argon is rolling out for Pro and Ultra subscribers.</p></li><li><p><b>Why:</b> To help.</p></li></ul></div>
<div><h3>Antigravity in the macOS app</h3><ul><li><p><b>What:</b> Build apps from chat.</p></li></ul></div></div>
<h2>2026.09.30</h2><div><h3>Skills in chat</h3><ul><li><p>Old.</p></li></ul></div></div></main>"""
ALIBABA = """<section id="singapore"><table><tr><th>Model type</th><th>Date</th><th>Scope</th><th>Model ID</th><th>Description</th></tr>
<tr><td><p>Text generation</p></td><td><p>2026-10-22</p></td><td><p>Intl</p></td><td><p><code>qwen3.9-max</code></p></td><td><p>New flagship with 1M context.</p></td></tr>
<tr><td><p>Video</p></td><td><p>2026-10-22</p></td><td><p>Intl</p></td><td><p><code>pixverse/pixverse-v6</code></p></td><td><p>Third party.</p></td></tr>
<tr><td><p>Text generation</p></td><td><p>2026-10-22</p></td><td><p>Intl</p></td><td><p><code>qwen3.9-flash</code></p></td><td><p>Fast one.</p></td></tr>
</table></section><section id="us"><table>
<tr><td><p>Text generation</p></td><td><p>2026-10-22</p></td><td><p>US</p></td><td><p><code>qwen3.9-max</code></p></td><td><p>New flagship with 1M context.</p></td></tr>
<tr><td><p>Text generation</p></td><td><p>2026-09-01</p></td><td><p>US</p></td><td><p><code>qwen3.8-max</code></p></td><td><p>Old.</p></td></tr>
</table></section>"""
DS_HOME = '<nav><a href="/news/news261017">News</a></nav>'
DS_NEWS = """<html><a href="/news/news261017">English</a><a href="/news/news261017">中文</a><a href="/news/news261017">News</a>
<a href="/news/news261017">DeepSeek-V4.1-Flash-1017 Release 2026/10/17</a><a href="/news/news260910">DeepSeek-V4.1-Flash Release 2026/09/10</a>
<a href="/news/news260910">NextDeepSeek-V4.1-Flash: Smarter</a>
<article><nav>Home News</nav><h1>DeepSeek-V4.1-Flash-1017: Wish-Driven Programming</h1><p>On this page</p><p>Stronger benchmark performance and shorter outputs.</p></article></html>"""


def hf(org):
    if org == "Qwen":
        return json.dumps([{"id": "Qwen/Qwen3.9-8B", "createdAt": "2026-10-21T10:00:00Z", "pipeline_tag": "text-generation"},
                           {"id": "Qwen/Qwen3.9-32B", "createdAt": "2026-10-21T11:00:00Z", "pipeline_tag": "text-generation"},
                           {"id": "Qwen/Qwen3.9-32B-GGUF", "createdAt": "2026-10-21T12:00:00Z"},
                           {"id": "Qwen/Qwen3.5-7B", "createdAt": "2026-06-01T12:00:00Z"}])
    return "[]"


PAGINAS = {
    "https://platform.claude.com/docs/en/release-notes/overview.md": CLAUDE_MD,
    "https://docs.z.ai/release-notes/new-released.md": ZAI_MD,
    "https://platform.minimax.io/docs/release-notes/models.md": MINIMAX_MD,
    "https://platform.kimi.ai/docs/platform-changelog.md": KIMI_MD,
    "https://developers.openai.com/changelog": OPENAI_HTML,
    "https://gemini.google/release-notes/": GEMINI_APP,
    "https://www.alibabacloud.com/help/en/model-studio/newly-released-models": ALIBABA,
    "https://api-docs.deepseek.com/": DS_HOME,
    "https://api-docs.deepseek.com/news/news261017": DS_NEWS,
    "https://ai.google.dev/gemini-api/docs/changelog.md.txt": "## October 13, 2026\n\n- **Gemini 4 Argon (`gemini-4-argon`) GA**: Released [Gemini 4 Argon](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon).\n",
}


def get(url):
    if url.startswith("https://huggingface.co/api/models?author="):
        return hf(url.split("author=")[1].split("&")[0])
    if url not in PAGINAS:
        raise RuntimeError(f"HTTP 404 {url}")
    return PAGINAS[url]


cl = M.FONTES["anthropic"](get, DESDE)
ok("Claude: um item por marcador, so dentro da janela", len(cl) == 2 and all(x["data"] == "2026-10-22" for x in cl), cl)
ok("Claude: link do proprio laboratorio, sem .md", cl[0]["link"] == "https://platform.claude.com/docs/en/build-with-claude/gc", cl[0]["link"])
ok("Claude: texto limpo", cl[0]["texto"].startswith("We've launched Claude Models on Google Cloud, the Claude API"), cl[0]["texto"])

z = M.FONTES["z-ai"](get, DESDE)
ok("Z.ai: a secao da data e um item so, com titulo e marcadores", len(z) == 1 and z[0]["texto"].startswith("GLM-6 Stronger coding") and "50%" in z[0]["texto"], z)
ok("Z.ai: link da documentacao", z and z[0]["link"] == "https://docs.z.ai/guides/llm/glm-6", z and z[0]["link"])

mm = M.FONTES["minimax"](get, DESDE)
ok("MiniMax: cartao citado vira item com o link do blog", len(mm) == 1 and mm[0]["link"] == "https://www.minimax.io/blog/minimax-m31f"
   and "ultra-efficient" in mm[0]["texto"], mm)

km = M.FONTES["moonshotai"](get, DESDE)
ok("Kimi: mes inteiro, subtitulo com texto e marcador viram dois itens", len(km) == 2 and all(x["data"] == "2026-10" for x in km), km)
ok("Kimi: subtitulo sem emoji", km and km[0]["texto"].startswith("Web Search API Launch"), km and km[0]["texto"])

oa = M.coletar_openai(get, DESDE)
ok("OpenAI: um item por etiqueta de data, ano do cabecalho do mes", [x["data"] for x in oa] == ["2026-10-22", "2026-10-12"], [x["data"] for x in oa])
ok("OpenAI: etiquetas de tipo e modelo no comeco", oa and oa[0]["texto"].startswith("[Update, gpt-6-luna] The Decisions API"), oa and oa[0]["texto"])
ok("OpenAI: preco em lista entra no texto", len(oa) > 1 and "$2 input and $10 output" in oa[1]["texto"], oa[1]["texto"] if len(oa) > 1 else oa)
ok("OpenAI: link relativo vira absoluto", oa and oa[0]["link"] == "https://developers.openai.com/api/docs/guides/decisions", oa and oa[0]["link"])

ga = M.coletar_gemini_app(get, DESDE)
ok("app Gemini: um item por recurso, so na janela", len(ga) == 2 and ga[0]["texto"].startswith("Introducing Gemini 4 Argon. What:"), ga)

al = M.coletar_alibaba(get, DESDE)
ok("Model Studio: so Qwen, um item por data, linha repetida por regiao conta uma vez",
   len(al) == 1 and al[0]["texto"].count("qwen3.9-max") == 1 and "qwen3.9-flash" in al[0]["texto"] and "pixverse" not in al[0]["texto"], al)

ds = M.noticias_deepseek(get)
ok("DeepSeek: seletor de idioma nao vira titulo", all(t not in ("English", "中文", "News") for _, _, t, _ in ds), ds)
ok("DeepSeek: a nota aberta usa o h1 e o comeco do texto", ds and ds[0][2] == "DeepSeek-V4.1-Flash-1017: Wish-Driven Programming"
   and ds[0][3].startswith("Stronger benchmark"), ds and ds[0])
ok("DeepSeek: nota antiga com o titulo certo", len(ds) == 2 and ds[1][2] == "DeepSeek-V4.1-Flash Release 2026/09/10", ds)
dsp = P.coletar_deepseek(get, P.dt.datetime(2026, 10, 1, tzinfo=P.dt.timezone.utc))
ok("pauta: coletor da DeepSeek usa o mesmo leitor", len(dsp) == 1 and dsp[0]["titulo"].startswith("DeepSeek-V4.1-Flash-1017"), dsp)

h = M.coletar_hf(get, DESDE)
ok("Hugging Face: um item por laboratorio e dia, sem quantizacao e sem item velho",
   len(h) == 1 and h[0]["lab"] == "qwen" and "Qwen3.9-8B" in h[0]["texto"] and "GGUF" not in h[0]["texto"], h)

itens, st = M.coletar(get, DIA)
ok("coleta: todas as fontes respondem", all(v["ok"] for v in st.values()), {k: v for k, v in st.items() if not v["ok"]})
ok("coleta: ids unicos e do mais novo para o mais velho", len({x["id"] for x in itens}) == len(itens)
   and [x["data"] for x in itens] == sorted([x["data"] for x in itens], reverse=True))


def quebra(url):
    raise RuntimeError("HTTP 500")


_, st2 = M.coletar(lambda u: quebra(u) if "z.ai" in u else get(u), DIA)
ok("coleta: fonte fora nao derruba as outras", not st2["z-ai"]["ok"] and st2["anthropic"]["ok"])

# ------------------------------------------------------------------ travas do texto
TRECHO = "Released GPT-6 Sol. Standard pricing per 1M tokens: $2 input and $10 output. OpenAI"
BOM = {"tipo": "modelo",
       "pt": {"titulo": "GPT-6 Sol chega à API.", "simples": "A OpenAI lançou o GPT-6 Sol.", "tecnico": "US$ 2 de entrada e US$ 10 de saída por milhão de tokens."},
       "en": {"titulo": "GPT-6 Sol arrives on the API", "simples": "OpenAI released GPT-6 Sol.", "tecnico": "$2 input and $10 output per 1M tokens, the café price."}}
reg, erro = M.checar(BOM, TRECHO, P.numeros_ok, P.valida_pt, P.en_ascii)
ok("checar: texto bom passa, sem ponto no titulo e ingles sem acento", erro is None and reg["pt"]["titulo"] == "GPT-6 Sol chega à API"
   and "cafe" in reg["en"]["tecnico"], erro)
ruim = json.loads(json.dumps(BOM)); ruim["pt"]["tecnico"] = "US$ 3 de entrada."
ok("checar: numero fora do trecho e recusado", "numero fora do trecho" in (M.checar(ruim, TRECHO, P.numeros_ok, P.valida_pt, P.en_ascii)[1] or ""))
ruim = json.loads(json.dumps(BOM)); ruim["pt"]["simples"] = "A OpenAI lançou o GPT-6 Sol — o novo."
ok("checar: travessao e recusado", M.checar(ruim, TRECHO, P.numeros_ok, P.valida_pt, P.en_ascii)[1] == "travessao")
ruim = json.loads(json.dumps(BOM)); ruim["pt"]["simples"] = "A OpenAI nao lancou nada."
ok("checar: portugues sem acento e recusado", "sem acento" in (M.checar(ruim, TRECHO, P.numeros_ok, P.valida_pt, P.en_ascii)[1] or ""))
ruim = json.loads(json.dumps(BOM)); ruim["tipo"] = "novidade"
ok("checar: tipo fora da lista e recusado", M.checar(ruim, TRECHO, P.numeros_ok, P.valida_pt, P.en_ascii)[1] == "tipo invalido")
ruim = json.loads(json.dumps(BOM)); ruim["en"]["tecnico"] = ""
ok("checar: tecnico vazio e permitido", M.checar(ruim, TRECHO, P.numeros_ok, P.valida_pt, P.en_ascii)[1] is None)


# ------------------------------------------------------------------ redacao com IA falsa
class FalsoClaude:
    def __init__(self, respostas):
        self.respostas, self.pedidos, self.modelo = list(respostas), [], "falso"
        self.uso = {"entrada": 0, "saida": 0}

    def json(self, sistema, usuario, max_tokens=None):
        self.pedidos.append(usuario)
        return self.respostas.pop(0) if self.respostas else {"movimentos": []}


def texto(n, lab_nome="OpenAI"):
    return {"tipo": "modelo", "pt": {"titulo": f"Modelo {n} chega à API", "simples": f"A {lab_nome} lançou o modelo {n}.", "tecnico": ""},
            "en": {"titulo": f"Model {n} arrives on the API", "simples": f"{lab_nome} released model {n}.", "tecnico": ""}}


brutos = [M.bruto("openai", "OpenAI API changelog", f"https://developers.openai.com/x{n}", f"2026-10-{20 + n}", f"Released model {n} for everyone today.")
          for n in range(1, 5)]
brutos.append(M.bruto("openai", "OpenAI API changelog", "https://developers.openai.com/console", "2026-10-21", "Console now has a dark theme for everyone."))
c = FalsoClaude([
    {"movimentos": [{"id": "m1", "relevante": True, **texto(1)}, {"id": "m2", "relevante": True, **texto(9)},
                    {"id": "m3", "relevante": True, **texto(3)}, {"id": "m4", "relevante": True, **texto(4)},
                    {"id": "m5", "relevante": False, "motivo": "ajuste de console"}]},
    {"movimentos": [{"id": "m2", "relevante": True, **texto(2)}]},
])
feitos, ign = M.redigir(c, brutos, P.AVISO_DADO, P.numeros_ok, P.valida_pt, P.en_ascii, log=lambda *_: None)
ok("redigir: numero errado ganha segunda tentativa com o motivo", len(c.pedidos) == 2 and "recusada" in c.pedidos[1] and "m2" in c.pedidos[1])
ok("redigir: quatro relevantes e um ignorado", len(feitos) == 4 and list(ign.values()) == ["ajuste de console"], (len(feitos), ign))
ok("redigir: trecho vai como dado, com o aviso no sistema", "Released model 1" in c.pedidos[0])

class LeitorClaude(FalsoClaude):
    """Responde lendo o trecho: console e irrelevante; modelo N vira um registro com o numero certo."""
    def json(self, sistema, usuario, max_tokens=None):
        self.pedidos.append(usuario)
        itens = json.loads(usuario.split("Itens:\n", 1)[1].split("\n\nA versão anterior", 1)[0])
        out = []
        for it in itens:
            if "Console" in it["trecho"]:
                out.append({"id": it["id"], "relevante": False, "motivo": "console"})
            else:
                out.append({"id": it["id"], "relevante": True, **texto(int(it["trecho"].split("model ")[1][0]))})
        return {"movimentos": out}


c2 = LeitorClaude([])
fontes = {"falsa": lambda g, d: brutos}
R = M.montar(DIA, c2, get, set(), P.AVISO_DADO, P.numeros_ok, P.valida_pt, P.en_ascii, log=lambda *_: None, fontes=fontes)
ok("montar: no maximo tres por laboratorio, o excedente vai para ignorados com o motivo",
   len(R["movimentos"]) == 3 and any("limite de 3" in x["motivo"] for x in R["movimentos_ignorados"]), (len(R["movimentos"]), R["movimentos_ignorados"]))
ok("montar: movimento publicado leva id, lab, fonte, link, data, tipo e os dois idiomas",
   all(set(m) == {"id", "lab", "fonte", "link", "data", "tipo", "pt", "en"} for m in R["movimentos"]))
ok("montar: dentro do laboratorio, o mais novo primeiro", [m["data"] for m in R["movimentos"]] == ["2026-10-24", "2026-10-23", "2026-10-22"],
   [m["data"] for m in R["movimentos"]])
c3 = FalsoClaude([])
R3 = M.montar(DIA, c3, get, {x["id"] for x in brutos}, P.AVISO_DADO, P.numeros_ok, P.valida_pt, P.en_ascii, log=lambda *_: None, fontes=fontes)
ok("montar: nada novo, nenhuma chamada de IA", not c3.pedidos and R3["movimentos"] == [])
sel = M.selecionar(brutos, set(), excluir_links=["https://developers.openai.com/x1?utm=a"])
ok("selecionar: o que a pauta do dia ja conta como noticia fica de fora", all(x["link"] != "https://developers.openai.com/x1" for x in sel) and len(sel) == 4)

# ------------------------------------------------------------------ registro e pauta
with tempfile.TemporaryDirectory() as tmp:
    pasta, ini = Path(tmp) / "pauta", Path(tmp) / "inicial.json"
    pasta.mkdir()
    (pasta / "2026-10-21.json").write_text(json.dumps({"dia": "2026-10-21", "movimentos": [{"id": "a1"}], "movimentos_ignorados": [{"id": "a2"}]}))
    (pasta / "2026-10-26.json").write_text(json.dumps({"dia": "2026-10-26", "movimentos": [{"id": "fut"}]}))
    ini.write_text(json.dumps({"dia": "2026-10-24", "movimentos": [{"id": "i1"}], "movimentos_ignorados": [{"id": "i2"}]}))
    ok("registrados: pautas anteriores e registro inicial, publicados e ignorados", M.registrados(pasta, "2026-10-26", ini) == {"a1", "a2", "i1", "i2"})

    p = {"assuntos": [], "editor": {"aprovada": False, "motivo": "nenhum assunto aprovado", "acoes": [], "revisao": {}}}
    c4 = FalsoClaude([{"movimentos": [{"id": "m1", "relevante": True, **texto(1)}]}])
    out = P.com_movimentos(p, DIA, c4, get, pasta=pasta, inicial=ini, fontes={"falsa": lambda g, d: brutos[:1]})
    ok("pauta: edição só com movimento aprovado publica sozinha", p["editor"]["aprovada"] and len(out["movimentos"]) == 1
       and "só com movimentos" in p["editor"]["motivo"], p["editor"])
    p2 = {"assuntos": [], "editor": {"aprovada": False, "motivo": "revisora sem resposta (Timeout)", "acoes": [], "revisao": {}}}
    P.com_movimentos(p2, DIA, FalsoClaude([{"movimentos": [{"id": "m1", "relevante": True, **texto(1)}]}]), get, pasta=pasta, inicial=ini,
                     fontes={"falsa": lambda g, d: brutos[:1]})
    ok("pauta: revisora fora do ar continua barrando o merge", not p2["editor"]["aprovada"])

    def explode(g, d):
        raise ValueError("pagina mudou")
    p3 = {"assuntos": []}
    out3 = P.com_movimentos(p3, DIA, FalsoClaude([]), get, pasta=pasta, inicial=ini, fontes={"x": explode})
    ok("pauta: fonte de movimento com erro nao derruba a pauta", out3["movimentos"] == [] and "fontes_movimentos" in out3)

    def explode_tudo(*a, **k):
        raise RuntimeError("API HTTP 529")
    orig, M.montar = M.montar, explode_tudo
    out4 = P.com_movimentos({"assuntos": []}, DIA, FalsoClaude([]), get, pasta=pasta, inicial=ini)
    M.montar = orig
    ok("pauta: falha nos movimentos vira motivo no JSON, sem derrubar a pauta", out4["movimentos"] == [] and "API HTTP 529" in out4["movimentos_erro"])

    corpo = P.corpo_pr({"dia": DIA, "assuntos": [], "descartados": [], "fontes": {}, "editor": p["editor"], **out})
    ok("PR: secao de movimentos com o titulo em portugues", "### Movimentos dos laboratórios" in corpo and "Modelo 1 chega à API" in corpo, corpo)

# ------------------------------------------------------------------ registro inicial versionado
ini = json.loads(M.INICIAL.read_text())
ms = ini["movimentos"]
ok("inicial: ids unicos entre publicados e ignorados", len({m["id"] for m in ms + ini["movimentos_ignorados"]}) == len(ms) + len(ini["movimentos_ignorados"]))
ok("inicial: todo laboratorio acompanhado tem ao menos dois movimentos", all(sum(m["lab"] == k for m in ms) >= 2 for k in M.LABS),
   {k: sum(m["lab"] == k for m in ms) for k in M.LABS})
ok("inicial: tipos validos e textos completos nos dois idiomas",
   all(m["tipo"] in M.TIPOS and all(m[lang]["titulo"] and m[lang]["simples"] for lang in ("pt", "en")) for m in ms))
ok("inicial: ingles sem acento e nenhum travessao", all(not any(ord(ch) > 127 for ch in " ".join(m["en"].values())) for m in ms)
   and not any("—" in json.dumps(m, ensure_ascii=False) or "–" in json.dumps(m, ensure_ascii=False) for m in ms))
ok("inicial: link oficial em todo movimento", all(m["link"].startswith("https://") for m in ms))

# ------------------------------------------------------------------ placar (data/web/labs.json)
labs = json.loads((M.ROOT / "data" / "web" / "labs.json").read_text())
dados = json.loads((M.ROOT / "public" / "data.json").read_text())
vv = {x["lab"]: x for x in dados["volume_vs_dinheiro"]}
ok("placar: os dez laboratorios, tres dos EUA e sete chineses", len(labs["labs"]) == 10
   and sum(x["grupo"] == "eua" for x in labs["labs"]) == 3)
if labs["semana"] == dados["last_week"]:
    ok("placar: mesma conta da faixa 'O dado' do Radar (volume_vs_dinheiro)",
       all(abs(x["share_tokens"] - vv[x["vendor"]]["share_tokens"]) < 0.011 and abs(x["share_gasto"] - vv[x["vendor"]]["share_gasto"]) < 0.011
           for x in labs["labs"] if x["vendor"] in vv),
       [(x["vendor"], x["share_tokens"], vv.get(x["vendor"], {}).get("share_tokens")) for x in labs["labs"]])
ok("placar: series de 13 semanas", all(len(x["serie_tokens"]) == len(labs["semanas"]) == 13 for x in labs["labs"]))

print(f"\n{'FALHARAM ' + str(len(falhas)) if falhas else 'TODAS AS CHECAGENS PASSARAM'}")
sys.exit(1 if falhas else 0)
