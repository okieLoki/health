export const kcal = (v: number | null | undefined) =>
  v == null ? "-" : Math.round(v).toLocaleString("en-US");

export const kg = (v: number | null | undefined, digits = 1) =>
  v == null ? "-" : v.toFixed(digits);

export const grams = (v: number | null | undefined) => (v == null ? "-" : `${Math.round(v)} g`);

export const litres = (ml: number | null | undefined) =>
  ml == null ? "-" : `${(ml / 1000).toFixed(2)} L`;

export const count = (v: number | null | undefined) =>
  v == null ? "-" : Math.round(v).toLocaleString("en-US");

export const hours = (h: number | null | undefined) => {
  if (h == null) return "-";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return `${whole}h ${String(mins).padStart(2, "0")}m`;
};

export const signedKcal = (v: number | null | undefined) => {
  if (v == null) return "-";
  return v < 0 ? `${kcal(Math.abs(v))} under` : `${kcal(v)} over`;
};

export const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🍛",
  dinner: "🍽️",
  snack: "🍎",
};
