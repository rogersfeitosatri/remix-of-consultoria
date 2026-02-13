export interface LabExamRef {
  name: string;
  category: string;
  unit: string;
  refMin: number | null;
  refMax: number | null;
  rcv95: number | null;
}

export const labExamsReference: LabExamRef[] = [
  // Eritrograma
  { name: 'Eritrócitos', category: 'Eritrograma', unit: 'milhões/mm³', refMin: 4.01, refMax: 5.23, rcv95: 8.3 },
  { name: 'Hematócrito', category: 'Eritrograma', unit: '%', refMin: 36.7, refMax: 46.1, rcv95: 8 },
  { name: 'Hemoglobina', category: 'Eritrograma', unit: 'g/dL', refMin: 12.2, refMax: 15.4, rcv95: 8 },
  { name: 'VCM', category: 'Eritrograma', unit: 'fL', refMin: 81.8, refMax: 97.8, rcv95: 2.3 },
  { name: 'HCM', category: 'Eritrograma', unit: 'pg', refMin: 27, refMax: 33, rcv95: 2.8 },
  { name: 'CHCM', category: 'Eritrograma', unit: 'g/L', refMin: 32, refMax: 35, rcv95: 3.3 },
  { name: 'RDW', category: 'Eritrograma', unit: '%', refMin: 12.4, refMax: 14.9, rcv95: 6.1 },
  { name: 'Reticulócitos %', category: 'Eritrograma', unit: '%', refMin: 0.54, refMax: 1.33, rcv95: 33.8 },
  { name: 'Reticulócitos abs', category: 'Eritrograma', unit: 'mm³', refMin: 28, refMax: 68, rcv95: 30 },
  { name: 'Ret-HE', category: 'Eritrograma', unit: 'pg', refMin: 23.3, refMax: 39.2, rcv95: null },
  // Leucograma
  { name: 'Leucócitos', category: 'Leucograma', unit: 'milhões/mm³', refMin: 5.0, refMax: 10.8, rcv95: 43.9 },
  { name: 'Linfócitos %', category: 'Leucograma', unit: '%', refMin: 15, refMax: 48, rcv95: 40.5 },
  { name: 'Linfócitos abs', category: 'Leucograma', unit: 'mm³', refMin: 1.3, refMax: 3.7, rcv95: 40.5 },
  { name: 'Neutrófilos %', category: 'Leucograma', unit: '%', refMin: 37, refMax: 72, rcv95: 65.3 },
  { name: 'Neutrófilos abs', category: 'Leucograma', unit: 'mm³', refMin: 2.4, refMax: 7.5, rcv95: 65.3 },
  { name: 'Monócitos %', category: 'Leucograma', unit: '%', refMin: 7, refMax: 13, rcv95: 55.2 },
  { name: 'Monócitos abs', category: 'Leucograma', unit: 'mm³', refMin: 0.4, refMax: 1.4, rcv95: 55.2 },
  { name: 'Eosinófilos %', category: 'Leucograma', unit: '%', refMin: 0.9, refMax: 7.7, rcv95: 65.1 },
  { name: 'Eosinófilos abs', category: 'Leucograma', unit: 'mm³', refMin: 0.05, refMax: 0.55, rcv95: 65.1 },
  { name: 'Basófilos %', category: 'Leucograma', unit: '%', refMin: 0.4, refMax: 1.8, rcv95: 86.8 },
  { name: 'Basófilos abs', category: 'Leucograma', unit: 'mm³', refMin: 0.02, refMax: 0.11, rcv95: 86.8 },
  // Plaquetas
  { name: 'Plaquetas', category: 'Plaquetas', unit: 'mm³', refMin: 141, refMax: 305, rcv95: 21.5 },
  { name: 'Volume Plaquetário', category: 'Plaquetas', unit: 'fL', refMin: 9.8, refMax: 13.4, rcv95: 13.3 },
  // Ferro
  { name: 'Ferro sérico', category: 'Ferro', unit: 'mcg/dL', refMin: 8.4, refMax: 28.8, rcv95: 73.4 },
  { name: 'Ferritina', category: 'Ferro', unit: 'ng/mL', refMin: 11, refMax: 306.8, rcv95: 39.3 },
  { name: 'Transferrina', category: 'Ferro', unit: 'mg/dL', refMin: 200, refMax: 400, rcv95: 8.3 },
  { name: 'TIBC (CTFF)', category: 'Ferro', unit: 'mcg/dL', refMin: 250, refMax: 450, rcv95: 16 },
  { name: '% Saturação Transferrina', category: 'Ferro', unit: '%', refMin: null, refMax: null, rcv95: null },
  // Função Hepática e Muscular
  { name: 'Albumina sérica', category: 'Proteínas', unit: 'g/dL', refMin: 3.7, refMax: 5.7, rcv95: 8.9 },
  { name: 'PCR ultra-sensível', category: 'Inflamação', unit: 'mg/L', refMin: null, refMax: 10.2, rcv95: null },
  { name: 'CK', category: 'Muscular', unit: 'U/L', refMin: null, refMax: 513, rcv95: 119.3 },
  { name: 'CK-MB', category: 'Muscular', unit: 'U/L', refMin: null, refMax: 29, rcv95: 61.1 },
  { name: 'LDH', category: 'Muscular', unit: 'U/L', refMin: null, refMax: 222, rcv95: 26.7 },
  { name: 'Mioglobina', category: 'Muscular', unit: 'ng/mL', refMin: 56, refMax: 133, rcv95: 43.1 },
  { name: 'AST', category: 'Hepático', unit: 'U/L', refMin: null, refMax: 62, rcv95: 36.9 },
  { name: 'ALT', category: 'Hepático', unit: 'U/L', refMin: 9, refMax: 40, rcv95: 75.3 },
  { name: 'GAMA GT', category: 'Hepático', unit: 'U/L', refMin: null, refMax: 50, rcv95: 42.8 },
  { name: 'Fosfatase alcalina', category: 'Hepático', unit: 'U/L', refMin: 122, refMax: 281, rcv95: 19.8 },
  // Perfil Lipídico
  { name: 'Colesterol Total', category: 'Perfil Lipídico', unit: 'mg/dL', refMin: null, refMax: 200, rcv95: null },
  { name: 'HDL', category: 'Perfil Lipídico', unit: 'mg/dL', refMin: 60, refMax: null, rcv95: null },
  { name: 'LDL', category: 'Perfil Lipídico', unit: 'mg/dL', refMin: null, refMax: 100, rcv95: null },
  { name: 'Colesterol Não HDL', category: 'Perfil Lipídico', unit: 'mg/dL', refMin: null, refMax: 130, rcv95: null },
  { name: 'Triglicerídeos', category: 'Perfil Lipídico', unit: 'mg/dL', refMin: null, refMax: 150, rcv95: null },
  // Renal
  { name: 'Creatinina', category: 'Renal', unit: 'mg/dL', refMin: 0.88, refMax: 1.50, rcv95: 26.8 },
  { name: 'Uréia', category: 'Renal', unit: 'mg/dL', refMin: 18, refMax: 50, rcv95: 42.5 },
  { name: 'Ácido úrico', category: 'Renal', unit: 'mg/dL', refMin: 2.6, refMax: 5.9, rcv95: 35 },
  // Glicemia
  { name: 'Insulina de jejum', category: 'Glicemia', unit: '', refMin: null, refMax: null, rcv95: null },
  { name: 'Glicemia de jejum', category: 'Glicemia', unit: 'mg/dL', refMin: null, refMax: null, rcv95: null },
  { name: 'Hemoglobina glicada', category: 'Glicemia', unit: '%', refMin: null, refMax: null, rcv95: null },
  // Tireoide
  { name: 'TSH', category: 'Tireoide', unit: 'mUI/L', refMin: 0.58, refMax: 4.1, rcv95: null },
  { name: 'T4 livre', category: 'Tireoide', unit: 'ng/dL', refMin: 0.90, refMax: 1.58, rcv95: null },
  { name: 'T3 livre', category: 'Tireoide', unit: 'pg/dL', refMin: 1.81, refMax: 4.59, rcv95: null },
  { name: 'T3 reverso', category: 'Tireoide', unit: 'ng/mL', refMin: 0.06, refMax: 0.76, rcv95: null },
  // Hormônios
  { name: 'Cortisol (6-10h)', category: 'Hormônios', unit: 'mcg/dL', refMin: 166, refMax: 507, rcv95: 60.4 },
  { name: 'Cortisol (16-20h)', category: 'Hormônios', unit: 'nmol/L', refMin: 68.2, refMax: 327, rcv95: 60.4 },
  { name: 'DHEA-S', category: 'Hormônios', unit: 'mcg/dL', refMin: 31, refMax: 228, rcv95: 12.8 },
  { name: 'Testosterona total', category: 'Hormônios', unit: 'nmol/L', refMin: 0.27, refMax: 2.08, rcv95: 29.4 },
  { name: 'Testosterona livre', category: 'Hormônios', unit: 'ng/dL', refMin: null, refMax: null, rcv95: 29.4 },
  { name: 'Relação Testo/Cortisol', category: 'Hormônios', unit: '', refMin: null, refMax: null, rcv95: null },
  { name: 'FSH', category: 'Hormônios', unit: 'mU/mL', refMin: null, refMax: null, rcv95: 27 },
  { name: 'LH', category: 'Hormônios', unit: 'mU/mL', refMin: null, refMax: null, rcv95: 44.9 },
  { name: 'Estradiol', category: 'Hormônios', unit: 'pg/mL', refMin: null, refMax: null, rcv95: 62.5 },
  { name: 'Progesterona', category: 'Hormônios', unit: 'ng/mL', refMin: null, refMax: null, rcv95: 54.2 },
  { name: 'Prolactina', category: 'Hormônios', unit: 'ng/mL', refMin: null, refMax: null, rcv95: 63.7 },
  // Vitaminas e Minerais
  { name: '25(OH) Vitamina D', category: 'Vitaminas', unit: 'ng/mL', refMin: 40, refMax: null, rcv95: null },
  { name: 'Zinco sérico', category: 'Minerais', unit: 'mcg/dL', refMin: 66, refMax: 110, rcv95: null },
  { name: 'Cobre plasmático', category: 'Minerais', unit: 'mcg/dL', refMin: 70, refMax: 140, rcv95: null },
  { name: 'Magnésio plasmático', category: 'Minerais', unit: 'mg/dL', refMin: 1.5, refMax: 2.0, rcv95: null },
  { name: 'Magnésio eritrocitário', category: 'Minerais', unit: 'mmol/L', refMin: 1.9, refMax: 2.54, rcv95: null },
  { name: 'Selênio', category: 'Minerais', unit: 'mcg/L', refMin: 46, refMax: 143, rcv95: null },
  { name: 'Vitamina A', category: 'Vitaminas', unit: 'mg/L', refMin: 0.32, refMax: 0.78, rcv95: null },
  { name: 'Vitamina C', category: 'Vitaminas', unit: 'mg/L', refMin: 4.6, refMax: 15, rcv95: null },
  { name: 'Vitamina E', category: 'Vitaminas', unit: 'mg/L', refMin: 5, refMax: 20, rcv95: null },
  { name: 'Ácido Fólico', category: 'Vitaminas', unit: 'ng/mL', refMin: null, refMax: null, rcv95: null },
  { name: 'Vitamina B12', category: 'Vitaminas', unit: 'pg/mL', refMin: null, refMax: null, rcv95: null },
  { name: 'Vitamina B6', category: 'Vitaminas', unit: '', refMin: null, refMax: null, rcv95: null },
];
