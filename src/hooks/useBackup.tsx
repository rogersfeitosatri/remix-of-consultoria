import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { toast } from 'sonner';

// Export all data for backup
export async function exportFullBackup() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  // Fetch all data
  const [
    { data: clients },
    { data: payments },
    { data: athleteProfiles },
    { data: checkinForms },
    { data: checkinQuestions },
    { data: checkinResponses },
    { data: anamneseForms },
    { data: anamneseQuestions },
    { data: anamneseResponses },
    { data: scheduledCheckins },
    { data: consultationSchedules },
    { data: appointments },
    { data: supportMaterials },
    { data: dietAppConfig },
    { data: linkBioItems },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('payments').select('*'),
    supabase.from('athlete_profiles').select('*'),
    supabase.from('checkin_forms').select('*'),
    supabase.from('checkin_questions').select('*'),
    supabase.from('checkin_responses').select('*'),
    supabase.from('anamnese_forms').select('*'),
    supabase.from('anamnese_questions').select('*'),
    supabase.from('anamnese_responses').select('*'),
    supabase.from('scheduled_checkins').select('*'),
    supabase.from('consultation_schedules').select('*'),
    supabase.from('appointments').select('*'),
    supabase.from('support_materials').select('*'),
    supabase.from('diet_app_config').select('*'),
    supabase.from('link_bio_items').select('*'),
    supabase.from('expenses').select('*'),
  ]);

  // Create workbook with all sheets
  const workbook = XLSX.utils.book_new();

  const addSheet = (name: string, data: any[] | null) => {
    if (data && data.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, worksheet, name);
    }
  };

  addSheet('Clients', clients);
  addSheet('Payments', payments);
  addSheet('AthleteProfiles', athleteProfiles);
  addSheet('CheckinForms', checkinForms);
  addSheet('CheckinQuestions', checkinQuestions);
  addSheet('CheckinResponses', checkinResponses);
  addSheet('AnamneseForms', anamneseForms);
  addSheet('AnamneseQuestions', anamneseQuestions);
  addSheet('AnamneseResponses', anamneseResponses);
  addSheet('ScheduledCheckins', scheduledCheckins);
  addSheet('ConsultationSchedules', consultationSchedules);
  addSheet('Appointments', appointments);
  addSheet('SupportMaterials', supportMaterials);
  addSheet('DietAppConfig', dietAppConfig);
  addSheet('LinkBioItems', linkBioItems);
  addSheet('Expenses', expenses);

  // Download file
  const fileName = `backup_completo_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  
  return fileName;
}

// Import backup data
export async function importFullBackup(file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const importResults: { table: string; count: number; errors: string[] }[] = [];

  // Helper to import a sheet
  const importSheet = async (sheetName: string, tableName: 'support_materials' | 'diet_app_config' | 'link_bio_items' | 'expenses') => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return { table: tableName, count: 0, errors: [] };

    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    if (jsonData.length === 0) return { table: tableName, count: 0, errors: [] };

    const errors: string[] = [];
    let count = 0;

    for (const row of jsonData) {
      try {
        // Remove id and timestamps for new inserts
        const { id, created_at, updated_at, ...rest } = row as any;
        const insertData = { ...rest, user_id: user.id };

        const { error } = await supabase.from(tableName).insert(insertData);
        if (error) throw error;
        count++;
      } catch (error) {
        errors.push(`Erro na linha: ${JSON.stringify(row).substring(0, 50)}...`);
      }
    }

    return { table: tableName, count, errors };
  };

  // Import sheets
  const results = await Promise.all([
    importSheet('SupportMaterials', 'support_materials'),
    importSheet('DietAppConfig', 'diet_app_config'),
    importSheet('LinkBioItems', 'link_bio_items'),
    importSheet('Expenses', 'expenses'),
  ]);

  importResults.push(...results);

  return importResults;
}
