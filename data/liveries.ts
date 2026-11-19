// Formula Racing 3D — Team Livery Definitions

export interface Livery {
  name: string;
  team: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const LIVERIES: Livery[] = [
  { name: "Scuderia", team: "Maranello Rosso", primary: "#dc2626", secondary: "#111827", accent: "#fbbf24" },
  { name: "Silver Arrow", team: "Stuttgart Motorsport", primary: "#9ca3af", secondary: "#111827", accent: "#06b6d4" },
  { name: "Papaya", team: "Woking Racing", primary: "#f97316", secondary: "#1e3a8a", accent: "#38bdf8" },
  { name: "Bull Speed", team: "Milton Keynes", primary: "#1e293b", secondary: "#991b1b", accent: "#facc15" },
  { name: "Verdant Racing", team: "Silverstone Green", primary: "#065f46", secondary: "#047857", accent: "#a3e635" }
];
