"""Build public/data.json from data/rankings_daily.csv.

Weekly aggregation (ISO weeks, Monday-Sunday, complete weeks only), vendor/origin/
license classification, concentration, Anthropic breakdown, lifecycle metrics.
Run after fetch.py. No network access needed.
"""
import pandas as pd, json, numpy as np, re, datetime as dt
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / "data" / "rankings_daily.csv"
OUT = ROOT / "public" / "data.json"
df=pd.read_csv(CSV, parse_dates=["date"], dtype={"total_tokens":"int64"})
df=df.drop_duplicates(["date","model_permaslug"])
df["vendor"]=df.model_permaslug.str.split("/").str[0]
df["week"]=df.date.dt.to_period("W-SUN").dt.start_time
# drop incomplete last week (Aug 31 is Monday alone)
full=df.groupby("week").date.nunique(); full_weeks=full[full==7].index
df=df[df.week.isin(full_weeks)]
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
df["origin"]=df.vendor.map(origin)
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
df["weights"]=df.model_permaslug.map(openw)
df["free"]=df.model_permaslug.str.endswith(":free")

wk=df.groupby("week").total_tokens.sum()
weeks=[w.strftime("%Y-%m-%d") for w in wk.index]
def share_table(col, top=None, keep=None):
    t=df.pivot_table(index="week",columns=col,values="total_tokens",aggfunc="sum",fill_value=0)
    if top:
        order=t.sum().sort_values(ascending=False)
        keep=[k for k in order.index if k!="other"][:top]
        t2=t[keep].copy(); t2["Outros"]=t.drop(columns=keep).sum(axis=1); t=t2
    return {c:(t[c]/t.sum(axis=1)*100).round(2).tolist() for c in t.columns}, {c:(t[c]/1e12).round(3).tolist() for c in t.columns}

vendor_share, vendor_abs = share_table("vendor", top=8)
origin_share,_ = share_table("origin")
weights_share,_ = share_table("weights")
free_share = (df[df.free].groupby("week").total_tokens.sum().reindex(wk.index,fill_value=0)/wk*100).round(2).tolist()

# concentration: top5 model share, HHI over models (excluding other)
mw=df[df.model_permaslug!="other"].pivot_table(index="week",columns="model_permaslug",values="total_tokens",aggfunc="sum",fill_value=0)
top5=(mw.apply(lambda r: r.sort_values(ascending=False).head(5).sum(),axis=1)/wk*100).round(2).tolist()
hhi=mw.div(mw.sum(axis=1),axis=0).pow(2).sum(axis=1).mul(10000).round(0).tolist()

# anthropic
an=df[df.vendor=="anthropic"].copy()
def fam(m):
    n=m.split("/")[-1]
    for k in ("haiku","sonnet","opus","fable"):
        if k in n: return k.capitalize()
    return "Outro"
an["family"]=an.model_permaslug.map(fam)
an_share=(an.groupby("week").total_tokens.sum().reindex(wk.index,fill_value=0)/wk*100).round(2).tolist()
an_fam=an.pivot_table(index="week",columns="family",values="total_tokens",aggfunc="sum",fill_value=0).reindex(wk.index,fill_value=0)
an_fam_abs={c:(an_fam[c]/1e12).round(3).tolist() for c in an_fam.columns}
# anthropic per model (weekly, top models)
def clean(m): 
    n=m.split("/")[-1]
    return re.sub(r"-20\d{6}$","",n)
an["model"]=an.model_permaslug.map(clean)
am=an.pivot_table(index="week",columns="model",values="total_tokens",aggfunc="sum",fill_value=0).reindex(wk.index,fill_value=0)
amorder=am.sum().sort_values(ascending=False).index[:12]
an_models={c:(am[c]/1e12).round(3).tolist() for c in amorder}
# competitor vendors share for comparison lines
comp=df.pivot_table(index="week",columns="vendor",values="total_tokens",aggfunc="sum",fill_value=0).reindex(wk.index,fill_value=0)
comp_share={v:(comp[v]/wk*100).round(2).tolist() for v in ["anthropic","google","openai","deepseek","x-ai","xiaomi","tencent","z-ai","minimax"]}

# lifecycle (share-based so 2025 models are comparable)
life=[]
ms=mw.div(wk,axis=0)*100
for m in ms.columns:
    s=ms[m]; s=s[s>0]
    peak=s.max()
    if peak<2.0: continue  # peak weekly share >= 2%
    first=s.index.min(); pk=s.idxmax()
    ttp=int((pk-first).days/7)
    after=ms[m][ms[m].index>pk]
    below=after[after<peak*0.5]
    half=int((below.index.min()-pk).days/7) if len(below) else None
    weeks_top10=int((mw.rank(axis=1,ascending=False)[m]<=10).sum())
    life.append(dict(model=m,vendor=m.split("/")[0],origin=origin(m.split("/")[0]),weights=openw(m),first=first.strftime("%Y-%m-%d"),peak_week=pk.strftime("%Y-%m-%d"),peak_share=round(peak,2),weeks_to_peak=ttp,half_life_weeks=half,weeks_in_top10=weeks_top10,total_T=round(mw[m].sum()/1e12,2),still_alive=bool(ms[m].iloc[-1]>0.5*peak),weeks_alive=int((s>0).sum())))
life=sorted(life,key=lambda x:x["first"])
# top10 churn: per week, how many of top10 were not in top10 4 weeks earlier
rk=mw.rank(axis=1,ascending=False)
top10sets=[set(rk.columns[rk.loc[w]<=10]) for w in rk.index]
churn=[None]*4+[len(top10sets[i]-top10sets[i-4]) for i in range(4,len(top10sets))]
# median age (weeks since first appearance) of top10 models
firsts={m:mw[m][mw[m]>0].index.min() for m in mw.columns}
age=[float(np.median([(w-firsts[m]).days/7 for m in top10sets[i]])) for i,w in enumerate(rk.index)]
# quarterly new entrants: count of models reaching top10 first time per quarter
first_top10={}
for i,w in enumerate(rk.index):
    for m in top10sets[i]:
        first_top10.setdefault(m,w)
q=pd.Series(first_top10).dt.to_period("Q").value_counts().sort_index()
entrants={str(k):int(v) for k,v in q.items()}

# leaderboard last week & 12 weeks ago & year ago
last=wk.index[-1]
def board(w,n=15):
    r=mw.loc[w].sort_values(ascending=False).head(n)
    return [dict(model=m,T=round(v/1e12,2),share=round(v/wk[w]*100,1),vendor=m.split("/")[0],origin=origin(m.split("/")[0]),weights=openw(m)) for m,v in r.items()]
boards={"last":board(last),"prev12":board(wk.index[-13]),"yearago":board(wk.index[-53])}
# monthly total tokens
monthly=(df.groupby(df.date.dt.to_period("M")).total_tokens.sum()/1e12).round(1)
monthly={str(k):float(v) for k,v in monthly.items()}
# other share
other_share=(df[df.model_permaslug=="other"].groupby("week").total_tokens.sum().reindex(wk.index,fill_value=0)/wk*100).round(2).tolist()

life_series={m['model']:ms[m['model']].round(2).tolist() for m in life}
out=dict(life_series=life_series,weeks=weeks,weekly_total_T=(wk/1e12).round(2).tolist(),vendor_share=vendor_share,vendor_abs=vendor_abs,origin_share=origin_share,weights_share=weights_share,free_share=free_share,top5=top5,hhi=hhi,an_share=an_share,an_fam_abs=an_fam_abs,an_models=an_models,comp_share=comp_share,life=life,churn=churn,age=age,entrants=entrants,boards=boards,monthly=monthly,other_share=other_share,last_week=last.strftime("%Y-%m-%d"),n_models=int(df.model_permaslug.nunique()))
out["as_of"]=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")
out["daily_last"]=df.date.max().strftime("%Y-%m-%d")
OUT.parent.mkdir(parents=True,exist_ok=True)
json.dump(out,open(OUT,"w"),ensure_ascii=False,separators=(",",":"))

