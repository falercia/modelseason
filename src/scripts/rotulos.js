// Nome de exibicao dos laboratorios. Fica num modulo proprio porque a pagina
// principal e as paginas por modelo precisam do MESMO mapa: duas copias
// divergem em semanas e o leitor ve 'z-ai' numa tela e 'Z.ai (GLM)' na outra.
export const VENDOR_LABEL = {deepseek:'DeepSeek',google:'Google',anthropic:'Anthropic',openai:'OpenAI',
  xiaomi:'Xiaomi',tencent:'Tencent',minimax:'MiniMax','z-ai':'Z.ai (GLM)',Outros:'Outros','x-ai':'xAI',
  nvidia:'NVIDIA',mistralai:'Mistral AI',moonshotai:'Moonshot AI',thinkingmachines:'Thinking Machines',
  stepfun:'StepFun',inclusionai:'InclusionAI',poolside:'Poolside',upstage:'Upstage',qwen:'Qwen',
  meta:'Meta','meta-llama':'Meta',alibaba:'Alibaba',bytedance:'ByteDance','bytedance-seed':'ByteDance',
  'arcee-ai':'Arcee AI',cohere:'Cohere',microsoft:'Microsoft',amazon:'Amazon',perplexity:'Perplexity',
  liquid:'Liquid AI',baai:'BAAI',kwaipilot:'KwaiPilot','nex-agi':'Nex AGI','dots-studio':'Dots Studio',
  'tngtech:':'TNG',tngtech:'TNG',nousresearch:'Nous Research',openchat:'OpenChat',
  'ibm-granite':'IBM Granite',stealth:'Anônimo (stealth)',openrouter:'OpenRouter (teste)'};

export const rotuloLab = (k) => VENDOR_LABEL[k] || String(k).split(/[-_]/)
  .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
