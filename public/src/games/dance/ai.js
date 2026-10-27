// Botterne i Dance Beat: hver har en dygtighed (hvor ofte den rammer, og hvor meget den svinger om takten).
export const botSkill = (rng) => ({ hit: 0.75 + rng() * 0.2, sd: 0.025 + rng() * 0.05 });

// Tidspunktet, botten trykker for pilen n, eller null (den misser). Afvigelsen er normalfordelt (Box-Muller).
export function botTap(n, skill, rng) {
  if (rng() > skill.hit) return null;
  const g = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  return n.t + g * skill.sd;
}
