// Telefonens hældning som pind (fase 8: tiltespil). DeviceOrientation giver beta (frem/tilbage i portræt) og gamma
// (venstre/højre i portræt); i landscape bytter de rolle efter skærmens vinkel. Nulpunktet er stillingen, da man slog
// hældning til (eller trykkede "Recenter"). MAX_DEG grader = fuldt udslag. Ren logik (test/tilt.test.js).
export const MAX_DEG = 25, DEAD = 0.08;

export function tiltToStick({ beta, gamma }, angle, zero) {
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return { x: 0, y: 0 };
  const db = beta - zero.beta, dg = gamma - zero.gamma;
  const a = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  let x, y;
  // landscape 90 (telefonens top til venstre): skærmens højre side ned = telefonens bund ned = beta op; skærmens top er
  // telefonens højre kant, så toppen væk fra en = gamma op = frem (y < 0, som i portræt). Regnet ud, ikke prøvet på en
  // telefon (Flip på telefonen).
  if (a === 90) { x = db; y = -dg; } else if (a === 270) { x = -db; y = dg; } else if (a === 180) { x = -dg; y = -db; } else { x = dg; y = db; }
  x /= MAX_DEG; y /= MAX_DEG;
  const m = Math.hypot(x, y);
  if (m < DEAD) return { x: 0, y: 0 };
  if (m > 1) { x /= m; y /= m; }
  return { x, y };
}
