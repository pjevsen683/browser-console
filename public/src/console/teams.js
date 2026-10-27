// Hold til holdspil (Snowball Fight m.fl.): spillerne fordeles skiftevis i tilmeldingsrækkefølge, så holdene
// højst er én fra hinanden. Ren logik (test/teams.test.js).
export const TEAM_COLORS = ['#ff4d5e', '#3fa7ff', '#ffd23f', '#3ddc84'];
export const TEAM_NAMES = ['Red', 'Blue', 'Yellow', 'Green'];

export function assignTeams(ids, n) {
  if (n < 2 || n > TEAM_COLORS.length) throw new Error(`2-${TEAM_COLORS.length} hold, ikke ${n}`);
  return new Map(ids.map((id, i) => [id, i % n]));
}
