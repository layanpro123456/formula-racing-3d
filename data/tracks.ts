// Formula Racing 3D — Enhanced Circuit Definitions
// Real-world circuit approximations with 3D elevation profile, banking, sector splits, and DRS zones.

export type Sector = {
  id: 1 | 2 | 3;
  name: string;
  tEnd: number; // Normalized position on Catmull-Rom curve [0, 1]
};

export type Track = {
  id: string;
  name: string;
  officialName: string;
  location: string;
  country: string;
  length: string;
  turns: number;
  color: string;
  skyColor: string;
  groundColor: string;
  // 3D coordinates [X, Y (elevation), Z] for realistic hill climbs and undulation
  points: [number, number, number][];
  width: number;
  sectors: [Sector, Sector, Sector];
  drsZones: { start: number; end: number }[];
  lapsDefault: number;
};

export const TRACKS: Track[] = [
  {
    id: "spa",
    name: "SPA-FRANCORCHAMPS",
    officialName: "Circuit de Spa-Francorchamps",
    location: "Stavelot, Belgium",
    country: "Belgium",
    length: "7.004 km",
    turns: 19,
    color: "#e63946",
    skyColor: "#94b8d7",
    groundColor: "#29462f",
    width: 6.8,
    // Realistic Ardennes elevation: steep climb through Eau Rouge / Raidillon (Y increases), downhill into Pouhon
    points: [
      [0, 0, 0],          // Start / Finish straight
      [15, -0.5, 3],      // La Source hairpin entry
      [22, -0.8, 12],     // La Source apex
      [12, -0.4, 25],     // Exit downhill towards Eau Rouge
      [-5, -1.5, 45],     // Descent to Eau Rouge bridge (lowest point)
      [-10, 4.2, 70],     // Raidillon climb begins steep
      [-12, 11.5, 95],    // Raidillon crest (high elevation)
      [-8, 12.0, 130],    // Kemmel Straight top plateau
      [5, 11.8, 180],     // Kemmel Straight DRS zone
      [18, 11.2, 220],    // Les Combes braking
      [28, 9.8, 235],     // Les Combes chicane
      [36, 7.5, 230],     // Malmedy downhill exit
      [45, 4.0, 205],     // Rivage downhill hairpin
      [42, 1.8, 175],     // Rivage exit
      [30, -0.5, 140],    // Accelerating to Pouhon
      [18, -1.8, 100],    // Pouhon double-left apex
      [8, -2.0, 60],      // Pouhon exit
      [34, -1.2, 25],     // Fagnes chicane
      [44, -0.5, 0],      // Stavelot corner
      [42, 0.0, -35],     // Blanchimont flat-out left
      [32, 0.2, -75],     // Blanchimont entry
      [15, 0.0, -100],    // Bus Stop chicane heavy braking
      [4, 0.0, -90],      // Bus Stop chicane apex
      [0, 0.0, -50],      // Pit straight entry
      [0, 0, 0]           // Closed loop finish
    ],
    sectors: [
      { id: 1, name: "Sector 1 (Kemmel)", tEnd: 0.32 },
      { id: 2, name: "Sector 2 (Rivage/Pouhon)", tEnd: 0.72 },
      { id: 3, name: "Sector 3 (Blanchimont/Bus Stop)", tEnd: 1.0 }
    ],
    drsZones: [
      { start: 0.16, end: 0.30 }, // Kemmel Straight
      { start: 0.94, end: 0.04 }  // Main Pit Straight
    ],
    lapsDefault: 3
  },
  {
    id: "monza",
    name: "MONZA",
    officialName: "Autodromo Nazionale Monza",
    location: "Monza, Italy",
    country: "Italy",
    length: "5.793 km",
    turns: 11,
    color: "#2a9d8f",
    skyColor: "#9ec5e8",
    groundColor: "#2f4f34",
    width: 6.6,
    // Temple of speed: Long flat straights, gentle banking into Curva Grande and Parabolica
    points: [
      [0, 0, 0],          // Main straight
      [35, 0, 0],         // Rettifilo braking
      [55, 0, 8],         // Prima Variante chicane
      [58, 0.2, 22],      // Chicane exit
      [52, 0.4, 45],      // Curva Grande entry
      [35, 0.5, 75],      // Curva Grande apex
      [12, 0.4, 98],      // Curva Grande exit into Roggia
      [-10, 0.3, 115],    // Variante della Roggia chicane
      [-25, 0.2, 118],    // Roggia exit
      [-48, 0.4, 105],    // Lesmo 1 entry
      [-62, 0.6, 85],     // Lesmo 1 apex
      [-68, 0.5, 60],     // Lesmo 2 entry
      [-72, 0.3, 30],     // Lesmo 2 exit downhill into Serraglio
      [-68, -0.4, -15],   // Serraglio bridge underpass
      [-62, -0.6, -65],   // Curva del Vialone
      [-50, -0.4, -100],  // Variante Ascari entry
      [-32, -0.2, -112],  // Ascari chicane middle
      [-12, 0.0, -108],   // Ascari exit towards Back Straight
      [10, 0.0, -95],     // Back Straight DRS zone
      [30, 0.0, -75],     // Parabolica braking zone
      [42, 0.2, -45],     // Curva Parabolica (Alboreto) sweeping radius
      [38, 0.1, -15],     // Parabolica apex onto main straight
      [18, 0.0, -4],      // Main straight acceleration
      [0, 0, 0]
    ],
    sectors: [
      { id: 1, name: "Sector 1 (Curva Grande)", tEnd: 0.34 },
      { id: 2, name: "Sector 2 (Lesmo & Ascari)", tEnd: 0.75 },
      { id: 3, name: "Sector 3 (Parabolica)", tEnd: 1.0 }
    ],
    drsZones: [
      { start: 0.82, end: 0.94 }, // Back straight
      { start: 0.98, end: 0.10 }  // Main pit straight
    ],
    lapsDefault: 3
  },
  {
    id: "silverstone",
    name: "SILVERSTONE",
    officialName: "Silverstone Circuit",
    location: "Northamptonshire, UK",
    country: "United Kingdom",
    length: "5.891 km",
    turns: 18,
    color: "#e76f51",
    skyColor: "#93b3d2",
    groundColor: "#335138",
    width: 6.8,
    // High speed flowing curves (Copse, Maggotts, Becketts, Stowe)
    points: [
      [0, 0, 0],          // Hamilton Straight
      [22, 0, 6],         // Abbey flat-out right
      [38, 0.2, 18],      // Farm Curve
      [48, 0.3, 38],      // Village hairpin
      [42, 0.4, 55],      // The Loop tight hairpin
      [28, 0.2, 62],      // Aintree left exit
      [8, 0.0, 72],       // Wellington Straight
      [-22, 0.0, 80],     // Brooklands braking
      [-42, 0.1, 75],     // Luffield long right carousel
      [-48, 0.2, 52],     // Woodcote exit
      [-45, 0.2, 25],     // National Pit Straight
      [-40, 0.2, -10],    // Copse flat-out blind right
      [-32, 0.1, -45],    // Maggotts entry
      [-22, 0.0, -75],    // Becketts rapid S-curves
      [-10, 0.0, -98],    // Chapel exit onto Hangar Straight
      [12, 0.0, -115],    // Hangar Straight DRS zone
      [35, 0.1, -112],    // Stowe corner entry
      [52, 0.2, -95],     // Stowe apex
      [55, 0.1, -65],     // Vale heavy braking
      [45, 0.0, -38],     // Club corner entry
      [28, 0.0, -18],     // Club exit onto Hamilton straight
      [0, 0, 0]
    ],
    sectors: [
      { id: 1, name: "Sector 1 (The Loop)", tEnd: 0.35 },
      { id: 2, name: "Sector 2 (Maggotts/Becketts)", tEnd: 0.68 },
      { id: 3, name: "Sector 3 (Hangar/Stowe)", tEnd: 1.0 }
    ],
    drsZones: [
      { start: 0.24, end: 0.36 }, // Wellington Straight
      { start: 0.72, end: 0.86 }  // Hangar Straight
    ],
    lapsDefault: 3
  },
  {
    id: "monaco",
    name: "MONACO GP",
    officialName: "Circuit de Monaco",
    location: "Monte Carlo, Monaco",
    country: "Monaco",
    length: "3.337 km",
    turns: 19,
    color: "#f4a261",
    skyColor: "#8bb9e5",
    groundColor: "#394d3c",
    width: 5.8,
    // Steep climb up Sainte Devote to Casino, drop to Grand Hotel Hairpin, Tunnel, and Chicane
    points: [
      [0, 0, 0],          // Pit straight
      [14, 0.2, 2],       // Sainte Devote right corner
      [22, 2.5, 16],      // Beau Rivage steep uphill climb
      [24, 5.8, 34],      // Massenet left
      [16, 7.5, 48],      // Casino Square crest
      [2, 6.2, 52],       // Mirabeau Haute descent begins
      [-10, 4.0, 46],     // Grand Hotel hairpin (slowest turn in F1)
      [-8, 2.8, 34],      // Mirabeau Bas
      [2, 1.8, 24],       // Portier entry
      [14, 1.0, 14],      // Entering the Tunnel
      [25, 0.2, 0],       // Tunnel descent flat out
      [36, -0.2, -25],    // Tunnel exit towards chicane
      [44, 0.0, -52],     // Nouvelle Chicane braking
      [38, 0.0, -70],     // Tabac left corner
      [24, 0.0, -84],     // Louis Chiron / Swimming Pool
      [8, 0.0, -86],      // Swimming Pool exit chicane
      [-8, 0.0, -76],     // La Rascasse tight right
      [-12, 0.0, -50],    // Anthony Noghes final corner
      [-6, 0.0, -25],     // Pit straight acceleration
      [0, 0, 0]
    ],
    sectors: [
      { id: 1, name: "Sector 1 (Casino)", tEnd: 0.36 },
      { id: 2, name: "Sector 2 (Hairpin & Tunnel)", tEnd: 0.70 },
      { id: 3, name: "Sector 3 (Swimming Pool & Rascasse)", tEnd: 1.0 }
    ],
    drsZones: [
      { start: 0.94, end: 0.06 }  // Main straight
    ],
    lapsDefault: 3
  },
  {
    id: "suzuka",
    name: "SUZUKA",
    officialName: "Suzuka International Racing Course",
    location: "Mie Prefecture, Japan",
    country: "Japan",
    length: "5.807 km",
    turns: 18,
    color: "#e9c46a",
    skyColor: "#91c0e3",
    groundColor: "#2a422e",
    width: 6.4,
    // Unique figure-8 layout: S-Curves, Dunlop, Degner, crossover bridge, 130R
    points: [
      [0, 0, 0],          // Main straight downhill
      [25, -0.5, 4],      // First curve Turn 1 & 2
      [40, -0.2, 18],     // Turn 2 exit
      [38, 0.5, 38],      // S-Curves Turn 3 left
      [28, 1.2, 55],      // S-Curves Turn 4 right
      [34, 2.0, 72],      // S-Curves Turn 5 left
      [45, 2.8, 85],      // Dunlop curve uphill left
      [48, 3.5, 105],     // Degner 1 fast right
      [40, 3.2, 118],     // Degner 2 tight 90-degree right
      [22, 2.0, 115],     // Underpass straight (runs under bridge)
      [5, 1.2, 100],      // Hairpin entry
      [-12, 0.8, 92],     // Hairpin apex
      [-25, 1.5, 80],     // 200R curve uphill
      [-42, 2.8, 62],     // Spoon Curve Turn 1
      [-52, 3.2, 38],     // Spoon Curve Turn 2
      [-45, 3.0, 10],     // Back Straight downhill
      [-30, 4.5, -25],    // Crossover Bridge (elevated crossing over underpass)
      [-15, 2.8, -58],    // 130R legendary flat-out left
      [5, 1.0, -78],      // Casio Triangle chicane heavy braking
      [12, 0.4, -55],     // Final curve onto main straight
      [6, 0.0, -25],      // Main straight sprint
      [0, 0, 0]
    ],
    sectors: [
      { id: 1, name: "Sector 1 (S-Curves)", tEnd: 0.36 },
      { id: 2, name: "Sector 2 (Degner & Hairpin)", tEnd: 0.68 },
      { id: 3, name: "Sector 3 (Spoon & 130R)", tEnd: 1.0 }
    ],
    drsZones: [
      { start: 0.96, end: 0.08 }  // Pit straight
    ],
    lapsDefault: 3
  }
];
