"""Classificacao de laboratorio por pais-sede e de modelo por licenca dos pesos.

Copia fiel das regras do build.py, para o build_web.py usar sem importar um
script que executa ao ser importado. Quando o build.py for aposentado, ele
passa a importar daqui.
"""
CN={"deepseek","xiaomi","tencent","minimax","z-ai","moonshotai","qwen","alibaba","stepfun","inclusionai","kwaipilot","bytedance-seed","baai","dots-studio","nex-agi"}
US={"google","anthropic","openai","x-ai","nvidia","meta","meta-llama","microsoft","poolside","perplexity","thinkingmachines","amazon","liquid","arcee-ai","cohere","nousresearch","openchat","cognitivecomputations"}
EU={"mistralai","tngtech"}
def origin(v):
    if v in CN: return "China"
    if v in US: return "EUA/Canadá"
    if v in EU: return "Europa"
    if v=="upstage": return "Coreia"
    if v in ("stealth","openrouter","other"): return "Não identificado"
    return "Outros"
OPEN_V={"deepseek","xiaomi","tencent","minimax","z-ai","nvidia","moonshotai","stepfun","inclusionai","meta-llama","arcee-ai","tngtech","kwaipilot","nex-agi","baai","dots-studio","alibaba","nousresearch","microsoft","upstage","thinkingmachines","liquid","sao10k","thedrummer","gryphe","neversleep","anthracite-org","infermatic","cognitivecomputations","openchat","sentence-transformers","intfloat","bytedance-seed"}
def openw(m):
    v=m.split("/")[0]; n=m.split("/")[-1]
    if v in ("stealth","openrouter") or m=="other": return "Não identificado"
    if v=="openai": return "Open-weights" if "gpt-oss" in n else "Proprietário"
    if v=="google": return "Open-weights" if n.startswith("gemma") else "Proprietário"
    if v=="qwen":
        return "Proprietário" if any(k in n for k in ("-max","-plus","-turbo","flash","coder-plus","coder-next")) else "Open-weights"
    if v=="mistralai":
        return "Proprietário" if any(k in n for k in ("large","medium","codestral","ministral-3b","ministral-8b","mistral-small","tiny")) and "2501" not in n and "3.1" not in n and "3.2" not in n else "Open-weights"
    if v=="meta": return "Proprietário"
    if v=="xiaomi": return "Open-weights" if "flash" in n else "Proprietário"
    if v in OPEN_V: return "Open-weights"
    return "Proprietário"
