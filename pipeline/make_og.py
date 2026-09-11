"""Gera os cards sociais de 1200x630 a partir de public/data.json: public/og.png
(portugues) e public/og-en.png (ingles, usado pelas paginas em /en).

Roda no fim do pipeline diario, entao o card que aparece no LinkedIn, no
WhatsApp e no X carrega os numeros do dia, nao um print congelado. Usa Pillow
em vez de headless browser porque precisa rodar em CI em segundos, sem baixar
navegador.

Uso: python pipeline/make_og.py
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data.json"
SAIDA = {"pt": ROOT / "public" / "og.png", "en": ROOT / "public" / "og-en.png"}

# Texto de cada card. Os numeros sao os mesmos; so muda a lingua e o formato da data.
TEXTO = {
    "pt": {"kicker": "INTELIGÊNCIA DE MERCADO · MODELOS DE LINGUAGEM",
           "linha1": "Para onde vai o tráfego de tokens dos modelos de linguagem,",
           "linha2": "semana a semana. Atualizado todo dia.",
           "metricas": ["tokens por semana", "laboratórios chineses", "pesos abertos", "trocam a cada 4 semanas"],
           "rodape": "Dados: OpenRouter · CC BY 4.0 · as of {data}"},
    "en": {"kicker": "MARKET INTELLIGENCE · LANGUAGE MODELS",
           "linha1": "Where language model token traffic goes,",
           "linha2": "week by week. Updated daily.",
           "metricas": ["tokens per week", "Chinese labs", "open weights", "turn over every 4 weeks"],
           "rodape": "Data: OpenRouter · CC BY 4.0 · as of {data}"},
}
MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

W, H = 1200, 630
TINTA = (18, 20, 23)          # --ink
FUNDO = (250, 250, 251)
TINTA_2 = (75, 81, 96)        # --ink-2
TINTA_3 = (125, 131, 148)     # --ink-3
ACENTO = (25, 158, 112)       # --accent
LINHA = (227, 229, 234)       # --grid

CANDIDATAS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans{}.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans{}.ttf",
    "/Library/Fonts/DejaVuSans{}.ttf",
]


def fonte(tamanho: int, negrito: bool = False):
    sufixo = "-Bold" if negrito else ""
    for padrao in CANDIDATAS:
        caminho = Path(padrao.format(sufixo))
        if caminho.exists():
            return ImageFont.truetype(str(caminho), tamanho)
    print("AVISO: DejaVu nao encontrada, usando fonte padrao do Pillow.", file=sys.stderr)
    return ImageFont.load_default()


def br(iso: str) -> str:
    return "/".join(reversed(iso.split("-")))


def data_en(iso: str) -> str:
    a, m, d = iso.split("-")
    return f"{MESES_EN[int(m) - 1]} {int(d)}, {a}"


def main() -> int:
    if not DATA.exists():
        print(f"ERRO: {DATA} nao existe. Rode pipeline/build.py antes.", file=sys.stderr)
        return 1
    d = json.load(open(DATA))

    volume = d["weekly_total_T"][-1]
    china = d["origin_share"]["China"][-1]
    abertos = d["weights_share"]["Open-weights"][-1]
    rotativ = d["churn"][-1]
    for lang, out in SAIDA.items():
        desenhar(lang, out, d, volume, china, abertos, rotativ)
    return 0


def desenhar(lang, out, d, volume, china, abertos, rotativ):
    T = TEXTO[lang]
    img = Image.new("RGB", (W, H), FUNDO)
    dr = ImageDraw.Draw(img)

    # Faixa de acento no topo
    dr.rectangle([0, 0, W, 8], fill=ACENTO)

    m = 72  # margem

    dr.text((m, 74), T["kicker"], font=fonte(19, True), fill=TINTA_3)

    dr.text((m, 116), "Model Season", font=fonte(78, True), fill=TINTA)

    dr.text((m, 218), T["linha1"], font=fonte(30), fill=TINTA_2)
    dr.text((m, 258), T["linha2"], font=fonte(30), fill=TINTA_2)

    dr.line([m, 336, W - m, 336], fill=LINHA, width=2)

    metricas = list(zip([f"{volume:.0f}T", f"{china:.0f}%", f"{abertos:.0f}%", f"{rotativ}/10"], T["metricas"]))
    largura = (W - 2 * m) // len(metricas)
    for i, (valor, rotulo) in enumerate(metricas):
        x = m + i * largura
        dr.text((x, 380), valor, font=fonte(56, True), fill=TINTA)
        dr.text((x, 452), rotulo, font=fonte(21), fill=TINTA_3)

    dr.line([m, 528, W - m, 528], fill=LINHA, width=2)

    dr.text((m, 556), "modelseason.com", font=fonte(25, True), fill=ACENTO)
    rodape = T["rodape"].format(data=br(d["as_of"]) if lang == "pt" else data_en(d["as_of"]))
    caixa = dr.textbbox((0, 0), rodape, font=fonte(21))
    dr.text((W - m - (caixa[2] - caixa[0]), 559), rodape, font=fonte(21), fill=TINTA_3)

    img.save(out, "PNG", optimize=True)
    print(f"{out.name} gerado: {out.stat().st_size // 1024}KB · "
          f"{volume:.0f}T · China {china:.0f}% · abertos {abertos:.0f}% · churn {rotativ}")


if __name__ == "__main__":
    sys.exit(main())
