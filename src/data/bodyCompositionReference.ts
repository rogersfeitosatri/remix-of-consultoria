export interface PercentileData {
  sport: string;
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

export const femalePercentiles: PercentileData[] = [
  { sport: 'Atletismo', p5: 27.21, p25: 53.97, median: 72.57, p75: 91.18, p95: 117.94 },
  { sport: 'Basquete', p5: 70.14, p25: 103.20, median: 126.17, p75: 149.15, p95: 182.21 },
  { sport: 'Ginástica', p5: 47.46, p25: 73.76, median: 92.04, p75: 110.32, p95: 136.62 },
  { sport: 'Remo', p5: 58.85, p25: 85.70, median: 104.36, p75: 123.02, p95: 149.87 },
  { sport: 'Futebol', p5: 59.08, p25: 86.42, median: 105.42, p75: 124.42, p95: 151.76 },
  { sport: 'Natação', p5: 47.92, p25: 74.81, median: 93.50, p75: 112.19, p95: 139.08 },
  { sport: 'Tênis', p5: 90.25, p25: 118.17, median: 137.58, p75: 156.99, p95: 184.91 },
  { sport: 'Triatlo', p5: 35.11, p25: 66.54, median: 88.38, p75: 110.22, p95: 141.65 },
  { sport: 'Voleibol', p5: 65.10, p25: 95.76, median: 117.08, p75: 138.39, p95: 169.06 },
  { sport: 'Judô', p5: 64.21, p25: 98.38, median: 112.12, p75: 145.87, p95: 180.04 },
  { sport: 'Outros Esportes de Combate', p5: 53.82, p25: 85.16, median: 106.94, p75: 128.72, p95: 160.05 },
];

export const malePercentiles: PercentileData[] = [
  { sport: 'Atletismo', p5: 24.49, p25: 38.14, median: 47.62, p75: 57.11, p95: 70.75 },
  { sport: 'Basquete', p5: 34.38, p25: 56.96, median: 72.65, p75: 88.34, p95: 110.91 },
  { sport: 'Ginástica', p5: 25.93, p25: 45.51, median: 59.12, p75: 72.72, p95: 92.30 },
  { sport: 'Handball', p5: 40.30, p25: 68.36, median: 87.87, p75: 107.38, p95: 135.45 },
  { sport: 'Remo', p5: 28.92, p25: 47.77, median: 60.88, p75: 73.98, p95: 92.83 },
  { sport: 'Rugby', p5: 18.39, p25: 72.38, median: 109.90, p75: 147.42, p95: 201.40 },
  { sport: 'Vela', p5: 33.14, p25: 66.20, median: 89.19, p75: 112.17, p95: 145.24 },
  { sport: 'Futebol', p5: 35.48, p25: 49.24, median: 58.81, p75: 68.38, p95: 82.14 },
  { sport: 'Natação', p5: 24.27, p25: 43.54, median: 56.93, p75: 70.33, p95: 89.60 },
  { sport: 'Tênis', p5: 38.53, p25: 55.83, median: 67.85, p75: 79.88, p95: 97.17 },
  { sport: 'Triatlo', p5: 28.82, p25: 41.47, median: 50.26, p75: 59.05, p95: 71.70 },
  { sport: 'Voleibol', p5: 37.69, p25: 56.75, median: 70.00, p75: 83.26, p95: 102.32 },
  { sport: 'Judô', p5: 21.99, p25: 44.17, median: 59.58, p75: 75.00, p95: 97.18 },
  { sport: 'Outros Esportes de Combate', p5: 29.57, p25: 49.22, median: 62.89, p75: 76.55, p95: 96.21 },
];

export interface BodyFatReference {
  sport: string;
  male: string;
  female: string;
}

export const bodyFatReference: BodyFatReference[] = [
  { sport: 'Basquete', male: '12-15%', female: '12-18%' },
  { sport: 'Fisiculturista', male: '5-8%', female: '10-15%' },
  { sport: 'Ciclista', male: '5-15%', female: '15-20%' },
  { sport: 'Ginástica', male: '5-12%', female: '10-16%' },
  { sport: 'Saltadores', male: '7-12%', female: '10-18%' },
  { sport: 'Hockey', male: '8-15%', female: '12-18%' },
  { sport: 'Maratonista', male: '5-11%', female: '10-15%' },
  { sport: 'Remo', male: '6-14%', female: '12-18%' },
  { sport: 'Arremessadores', male: '16-20%', female: '20-28%' },
  { sport: 'Ski X-country', male: '7-12%', female: '16-22%' },
  { sport: 'Velocistas', male: '8-10%', female: '12-20%' },
  { sport: 'Futebol', male: '10-18%', female: '13-18%' },
  { sport: 'Natação', male: '9-12%', female: '14-24%' },
  { sport: 'Tênis', male: '12-16%', female: '16-24%' },
  { sport: 'Triatlo', male: '5-12%', female: '10-15%' },
  { sport: 'Voleibol', male: '11-14%', female: '16-25%' },
  { sport: 'Levant. Peso', male: '9-16%', female: 'sem dados' },
  { sport: 'Luta livre', male: '5-16%', female: 'sem dados' },
];
