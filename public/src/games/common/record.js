// En rekord pr. spil i konsollens localStorage (Tower Stack, Sumo Survival). Tåler en privat fane: så huskes intet.
// store kan erstattes i tests (test/record.test.js).
const KEY = (name) => `konsol-best-${name}`;

export function createRecord(name, store = globalThis.localStorage) {
  const read = () => { try { return Number(store?.getItem(KEY(name))) || 0; } catch { return 0; } };
  const best = read();
  return {
    best,
    // Gemmer v, hvis det slår den gamle rekord; svarer, om det gjorde.
    submit(v) {
      if (!(v > best)) return false;
      try { store?.setItem(KEY(name), String(v)); } catch { /* privat fane */ }
      return true;
    },
  };
}
