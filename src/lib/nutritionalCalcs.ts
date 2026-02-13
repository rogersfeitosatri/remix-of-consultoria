// TMB calculation utilities

export function calculateAge(birthDate: string, consultDate: string): number {
  const birth = new Date(birthDate);
  const consult = new Date(consultDate);
  let age = consult.getFullYear() - birth.getFullYear();
  const m = consult.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && consult.getDate() < birth.getDate())) age--;
  return age;
}

export function calculateTMBCunningham(leanMassKg: number): number {
  return 500 + 22 * leanMassKg;
}

export function calculateTMBHarrisBenedictMale(weight: number, height: number, age: number): number {
  return 66.47 + 13.75 * weight + 5 * height - 6.76 * age;
}

export function calculateTMBHarrisBenedictFemale(weight: number, height: number, age: number): number {
  return 655.1 + 9.56 * weight + 1.85 * height - 4.68 * age;
}

export function calculateTMBFA(tmb: number, fa: number): number {
  return (tmb * fa) * 1.05;
}

export function calculateGEE(metValue: number, weight: number, durationMinutes: number): number {
  return (metValue * weight / 60) * durationMinutes;
}

export function calculateEnergyAvailability(vct: number, gee: number, leanMassKg: number): number {
  if (!leanMassKg || leanMassKg === 0) return 0;
  return (vct - gee) / leanMassKg;
}

export const activityFactors = {
  male: { sedentaria: 1.00, baixa: 1.11, ativa: 1.25, muito_ativa: 1.48 },
  female: { sedentaria: 1.00, baixa: 1.12, ativa: 1.27, muito_ativa: 1.45 },
};

export const defaultRunningZones = [
  { zone_name: 'LEVE', hr_zone: '122-131', pace: '5:33', speed_kmh: '10.8', met_value: 10 },
  { zone_name: 'CONFORTÁVEL', hr_zone: '134-140', pace: '5:01 - 5:21', speed_kmh: '12 - 11,2', met_value: 12.5 },
  { zone_name: 'MODERADO', hr_zone: '144-153', pace: '4:41 - 5:00', speed_kmh: '12,8 - 12', met_value: 13.5 },
  { zone_name: 'FIRME', hr_zone: '154-164', pace: '4:24 - 4:40', speed_kmh: '13,6 - 12,9', met_value: 14 },
  { zone_name: 'FORTE', hr_zone: '167-175', pace: '4:12 - 4:23', speed_kmh: '14,3 - 13,7', met_value: 15 },
  { zone_name: 'TIROS 400M', hr_zone: '', pace: '3:43 - 3:59', speed_kmh: '16,1 - 15,1', met_value: 16 },
  { zone_name: 'TIROS 500M', hr_zone: '', pace: '3:49 - 4:11', speed_kmh: '15,7 - 14,3', met_value: 15 },
  { zone_name: 'TIROS 800M', hr_zone: '', pace: '3:57 - 4:15', speed_kmh: '15,2 - 14,1', met_value: 15 },
  { zone_name: 'TIROS 1000M', hr_zone: '', pace: '4:15 - 4:30', speed_kmh: '14,1 - 13,3', met_value: 15 },
  { zone_name: 'TIROS 1500M', hr_zone: '', pace: '4:17 - 4:33', speed_kmh: '14 - 13,2', met_value: 14 },
  { zone_name: 'TIROS 2000M', hr_zone: '', pace: '4:20 - 4:36', speed_kmh: '13,8 - 13', met_value: 13.5 },
];

export const triathlonMets: Record<string, Record<string, number>> = {
  natacao: { leve: 5, moderado: 7, forte: 10 },
  corrida: { leve: 8, moderado: 10, forte: 12.5 },
  bike: { leve: 6, moderado: 8, forte: 10 },
  musculacao: { leve: 3, moderado: 6, forte: 8 },
};

export const dayLabels = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
