// Serverens sprogmodel (Gemma, på CPU'en -- uden for GPU-køen), OpenAI-kompatibel. Bruges af quiz.mjs og traitor.mjs.
const API = process.env.ASSET_API || 'http://10.1.0.21:8200';

export async function chat(system, user, { maxTokens = 2000, temperature = 0.8 } = {}) {
  const res = await fetch(`${API}/v1/chat/completions`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gemma', max_tokens: maxTokens, temperature, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`LLM ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content;
}

// Det første hele JSON-array i et svar. Modellen pakker det gerne ind i ```json … ``` og skriver af og til tekst
// eller et array mere bagefter, så slutningen findes ved at tælle klammer (uden for strenge).
export function firstJsonArray(text) {
  const start = text.indexOf('[');
  if (start < 0) throw new Error(`intet JSON-array i: ${text.slice(0, 200)}`);
  let depth = 0, str = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (str) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error(`ufuldendt JSON-array i: ${text.slice(0, 200)}`);
}
