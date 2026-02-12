export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string | null
          enable_continuation_mode: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enable_continuation_mode?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enable_continuation_mode?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_analyses: {
        Row: {
          alerts: string[] | null
          athlete_profile_id: string | null
          caloric_deficit: Json
          client_id: string
          created_at: string
          diagnosis: string
          energy_expenditure: Json
          id: string
          macronutrients: Json
          model_used: string | null
          raw_response: string | null
          updated_at: string
        }
        Insert: {
          alerts?: string[] | null
          athlete_profile_id?: string | null
          caloric_deficit: Json
          client_id: string
          created_at?: string
          diagnosis: string
          energy_expenditure: Json
          id?: string
          macronutrients: Json
          model_used?: string | null
          raw_response?: string | null
          updated_at?: string
        }
        Update: {
          alerts?: string[] | null
          athlete_profile_id?: string | null
          caloric_deficit?: Json
          client_id?: string
          created_at?: string
          diagnosis?: string
          energy_expenditure?: Json
          id?: string
          macronutrients?: Json
          model_used?: string | null
          raw_response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analyses_athlete_profile_id_fkey"
            columns: ["athlete_profile_id"]
            isOneToOne: false
            referencedRelation: "athlete_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_forms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      anamnese_questions: {
        Row: {
          comment_field_label: string | null
          comment_field_required: boolean
          created_at: string
          form_id: string
          has_comment_field: boolean
          id: string
          is_required: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          scale_max: number | null
          scale_min: number | null
          section: string
        }
        Insert: {
          comment_field_label?: string | null
          comment_field_required?: boolean
          created_at?: string
          form_id: string
          has_comment_field?: boolean
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
          scale_max?: number | null
          scale_min?: number | null
          section?: string
        }
        Update: {
          comment_field_label?: string | null
          comment_field_required?: boolean
          created_at?: string
          form_id?: string
          has_comment_field?: boolean
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          scale_max?: number | null
          scale_min?: number | null
          section?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "anamnese_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      anamnese_responses: {
        Row: {
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          client_id: string | null
          form_id: string
          id: string
          respondent_email: string | null
          respondent_name: string | null
          responses: Json
          submitted_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id?: string | null
          form_id: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          responses: Json
          submitted_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id?: string | null
          form_id?: string
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          responses?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnese_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anamnese_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "anamnese_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          client_id: string
          consultation_schedule_id: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          google_calendar_event_id: string | null
          google_meet_link: string | null
          id: string
          meet_status: string | null
          notes: string | null
          notes_admin: string | null
          reminder_15m_sent_at: string | null
          reminder_sent_at: string | null
          status: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_id: string
          consultation_schedule_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          google_calendar_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          meet_status?: string | null
          notes?: string | null
          notes_admin?: string | null
          reminder_15m_sent_at?: string | null
          reminder_sent_at?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_id?: string
          consultation_schedule_id?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          google_calendar_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          meet_status?: string | null
          notes?: string | null
          notes_admin?: string | null
          reminder_15m_sent_at?: string | null
          reminder_sent_at?: string | null
          status?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_consultation_schedule_id_fkey"
            columns: ["consultation_schedule_id"]
            isOneToOne: false
            referencedRelation: "consultation_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_attachments: {
        Row: {
          client_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          type_tag: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          type_tag?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          type_tag?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_challenge_progress: {
        Row: {
          client_id: string
          completed_weeks: number[] | null
          created_at: string
          current_week: number
          id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_weeks?: number[] | null
          created_at?: string
          current_week?: number
          id?: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_weeks?: number[] | null
          created_at?: string
          current_week?: number
          id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_challenge_progress_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profiles: {
        Row: {
          anamnese_completed: boolean | null
          anamnese_submitted_at: string | null
          bedtime: string | null
          birth_date: string | null
          city_state: string | null
          client_id: string
          created_at: string
          current_supplements: string | null
          current_weight: number | null
          diet_stop_reason: string | null
          diet_types: string | null
          disliked_foods: string | null
          evacuation_frequency: string | null
          favorite_foods: string | null
          food_allergies: string | null
          full_name: string | null
          gender: string | null
          gluten_intolerance: string | null
          height: number | null
          hip_circumference: number | null
          hours_sitting: string | null
          id: string
          ideal_weight: number | null
          injury_history: string | null
          intestinal_function: string | null
          intestinal_problems: Json | null
          intestinal_problems_other: string | null
          lactose_intolerance: string | null
          main_goal: string | null
          max_weight: number | null
          meal_afternoon_snack: Json | null
          meal_afternoon_snack_enabled: boolean | null
          meal_breakfast: Json | null
          meal_dinner: Json | null
          meal_lunch: Json | null
          meal_morning_snack: Json | null
          meal_morning_snack_enabled: boolean | null
          meal_supper: Json | null
          meal_supper_enabled: boolean | null
          min_adult_weight: number | null
          nutritional_followup: string | null
          past_supplements: string | null
          phone: string | null
          practices_running: string | null
          previous_diets: string | null
          profession: string | null
          races_participated: string | null
          religious_restrictions: string | null
          running_time: string | null
          secondary_goal: string | null
          sedentary_work: string | null
          sleep_hours: string | null
          sleep_quality: string | null
          specific_target: string | null
          stress_cause: string | null
          stress_level: string | null
          target_deadline: string | null
          target_race: string | null
          updated_at: string
          used_supplements_before: string | null
          uses_supplements: string | null
          waist_circumference: number | null
          wake_time: string | null
          weekend_changes: string | null
          weekend_description: string | null
          weekly_frequency: string | null
          weekly_volume_km: number | null
          work_schedule: string | null
        }
        Insert: {
          anamnese_completed?: boolean | null
          anamnese_submitted_at?: string | null
          bedtime?: string | null
          birth_date?: string | null
          city_state?: string | null
          client_id: string
          created_at?: string
          current_supplements?: string | null
          current_weight?: number | null
          diet_stop_reason?: string | null
          diet_types?: string | null
          disliked_foods?: string | null
          evacuation_frequency?: string | null
          favorite_foods?: string | null
          food_allergies?: string | null
          full_name?: string | null
          gender?: string | null
          gluten_intolerance?: string | null
          height?: number | null
          hip_circumference?: number | null
          hours_sitting?: string | null
          id?: string
          ideal_weight?: number | null
          injury_history?: string | null
          intestinal_function?: string | null
          intestinal_problems?: Json | null
          intestinal_problems_other?: string | null
          lactose_intolerance?: string | null
          main_goal?: string | null
          max_weight?: number | null
          meal_afternoon_snack?: Json | null
          meal_afternoon_snack_enabled?: boolean | null
          meal_breakfast?: Json | null
          meal_dinner?: Json | null
          meal_lunch?: Json | null
          meal_morning_snack?: Json | null
          meal_morning_snack_enabled?: boolean | null
          meal_supper?: Json | null
          meal_supper_enabled?: boolean | null
          min_adult_weight?: number | null
          nutritional_followup?: string | null
          past_supplements?: string | null
          phone?: string | null
          practices_running?: string | null
          previous_diets?: string | null
          profession?: string | null
          races_participated?: string | null
          religious_restrictions?: string | null
          running_time?: string | null
          secondary_goal?: string | null
          sedentary_work?: string | null
          sleep_hours?: string | null
          sleep_quality?: string | null
          specific_target?: string | null
          stress_cause?: string | null
          stress_level?: string | null
          target_deadline?: string | null
          target_race?: string | null
          updated_at?: string
          used_supplements_before?: string | null
          uses_supplements?: string | null
          waist_circumference?: number | null
          wake_time?: string | null
          weekend_changes?: string | null
          weekend_description?: string | null
          weekly_frequency?: string | null
          weekly_volume_km?: number | null
          work_schedule?: string | null
        }
        Update: {
          anamnese_completed?: boolean | null
          anamnese_submitted_at?: string | null
          bedtime?: string | null
          birth_date?: string | null
          city_state?: string | null
          client_id?: string
          created_at?: string
          current_supplements?: string | null
          current_weight?: number | null
          diet_stop_reason?: string | null
          diet_types?: string | null
          disliked_foods?: string | null
          evacuation_frequency?: string | null
          favorite_foods?: string | null
          food_allergies?: string | null
          full_name?: string | null
          gender?: string | null
          gluten_intolerance?: string | null
          height?: number | null
          hip_circumference?: number | null
          hours_sitting?: string | null
          id?: string
          ideal_weight?: number | null
          injury_history?: string | null
          intestinal_function?: string | null
          intestinal_problems?: Json | null
          intestinal_problems_other?: string | null
          lactose_intolerance?: string | null
          main_goal?: string | null
          max_weight?: number | null
          meal_afternoon_snack?: Json | null
          meal_afternoon_snack_enabled?: boolean | null
          meal_breakfast?: Json | null
          meal_dinner?: Json | null
          meal_lunch?: Json | null
          meal_morning_snack?: Json | null
          meal_morning_snack_enabled?: boolean | null
          meal_supper?: Json | null
          meal_supper_enabled?: boolean | null
          min_adult_weight?: number | null
          nutritional_followup?: string | null
          past_supplements?: string | null
          phone?: string | null
          practices_running?: string | null
          previous_diets?: string | null
          profession?: string | null
          races_participated?: string | null
          religious_restrictions?: string | null
          running_time?: string | null
          secondary_goal?: string | null
          sedentary_work?: string | null
          sleep_hours?: string | null
          sleep_quality?: string | null
          specific_target?: string | null
          stress_cause?: string | null
          stress_level?: string | null
          target_deadline?: string | null
          target_race?: string | null
          updated_at?: string
          used_supplements_before?: string | null
          uses_supplements?: string | null
          waist_circumference?: number | null
          wake_time?: string | null
          weekend_changes?: string | null
          weekend_description?: string | null
          weekly_frequency?: string | null
          weekly_volume_km?: number | null
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_summary_audit_logs: {
        Row: {
          admin_id: string
          client_id: string
          created_at: string
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          admin_id: string
          client_id: string
          created_at?: string
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          admin_id?: string
          client_id?: string
          created_at?: string
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_summary_audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_whatsapp_settings: {
        Row: {
          client_id: string
          created_at: string | null
          disabled_all: boolean | null
          disabled_template_keys: string[] | null
          id: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          disabled_all?: boolean | null
          disabled_template_keys?: string[] | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          disabled_all?: boolean | null
          disabled_template_keys?: string[] | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_whatsapp_settings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_rules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_enabled: boolean
          slot_minutes: number
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_enabled?: boolean
          slot_minutes?: number
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_enabled?: boolean
          slot_minutes?: number
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      booking_links: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          last_sent_at: string | null
          token: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_sent_at?: string | null
          token?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_sent_at?: string | null
          token?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_activities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          order_index: number | null
          required_days: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          order_index?: number | null
          required_days?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          order_index?: number | null
          required_days?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      challenge_daily_marks: {
        Row: {
          client_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string
          day_of_week: number
          id: string
          week_number: number
        }
        Insert: {
          client_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          week_number: number
        }
        Update: {
          client_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_daily_marks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_weekly_marks: {
        Row: {
          activity_id: string
          client_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string
          id: string
          week_number: number
        }
        Insert: {
          activity_id: string
          client_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          week_number: number
        }
        Update: {
          activity_id?: string
          client_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string
          id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_weekly_marks_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "challenge_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_weekly_marks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_ai_analyses: {
        Row: {
          alerts: string[] | null
          checkin_response_id: string
          client_id: string
          created_at: string
          evolution_trend: string
          id: string
          model_used: string | null
          raw_response: string | null
          suggested_feedback: string
          updated_at: string
          weekly_summary: string
        }
        Insert: {
          alerts?: string[] | null
          checkin_response_id: string
          client_id: string
          created_at?: string
          evolution_trend: string
          id?: string
          model_used?: string | null
          raw_response?: string | null
          suggested_feedback: string
          updated_at?: string
          weekly_summary: string
        }
        Update: {
          alerts?: string[] | null
          checkin_response_id?: string
          client_id?: string
          created_at?: string
          evolution_trend?: string
          id?: string
          model_used?: string | null
          raw_response?: string | null
          suggested_feedback?: string
          updated_at?: string
          weekly_summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_ai_analyses_checkin_response_id_fkey"
            columns: ["checkin_response_id"]
            isOneToOne: false
            referencedRelation: "checkin_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_ai_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_feedbacks: {
        Row: {
          ai_analysis_id: string | null
          approved_at: string | null
          approved_by: string | null
          checkin_response_id: string
          client_id: string
          created_at: string
          final_feedback: string | null
          id: string
          sent_at: string | null
          sent_via: string | null
          status: string
          suggested_feedback: string | null
          updated_at: string
        }
        Insert: {
          ai_analysis_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          checkin_response_id: string
          client_id: string
          created_at?: string
          final_feedback?: string | null
          id?: string
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          suggested_feedback?: string | null
          updated_at?: string
        }
        Update: {
          ai_analysis_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          checkin_response_id?: string
          client_id?: string
          created_at?: string
          final_feedback?: string | null
          id?: string
          sent_at?: string | null
          sent_via?: string | null
          status?: string
          suggested_feedback?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_feedbacks_ai_analysis_id_fkey"
            columns: ["ai_analysis_id"]
            isOneToOne: false
            referencedRelation: "checkin_ai_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_feedbacks_checkin_response_id_fkey"
            columns: ["checkin_response_id"]
            isOneToOne: false
            referencedRelation: "checkin_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_feedbacks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_forms: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkin_questions: {
        Row: {
          comment_field_label: string | null
          comment_field_required: boolean
          comment_field_type: string | null
          created_at: string
          form_id: string
          has_comment_field: boolean
          id: string
          is_required: boolean | null
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          scale_max: number | null
          scale_min: number | null
        }
        Insert: {
          comment_field_label?: string | null
          comment_field_required?: boolean
          comment_field_type?: string | null
          created_at?: string
          form_id: string
          has_comment_field?: boolean
          id?: string
          is_required?: boolean | null
          options?: Json | null
          order_index?: number
          question_text: string
          question_type: string
          scale_max?: number | null
          scale_min?: number | null
        }
        Update: {
          comment_field_label?: string | null
          comment_field_required?: boolean
          comment_field_type?: string | null
          created_at?: string
          form_id?: string
          has_comment_field?: boolean
          id?: string
          is_required?: boolean | null
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          scale_max?: number | null
          scale_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "checkin_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_responses: {
        Row: {
          client_id: string
          form_id: string
          id: string
          responses: Json
          submitted_at: string
        }
        Insert: {
          client_id: string
          form_id: string
          id?: string
          responses: Json
          submitted_at?: string
        }
        Update: {
          client_id?: string
          form_id?: string
          id?: string
          responses?: Json
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "checkin_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          admin_attention_points: string | null
          admin_next_focus: string | null
          admin_notes_short: string | null
          admin_summary: string | null
          athlete_status: string | null
          athlete_user_id: string | null
          checkin_frequency: string | null
          consultation_count: number | null
          consultation_frequency: string | null
          created_at: string
          eligible_for_booking: boolean
          email: string | null
          end_date: string
          first_consultation_date: string | null
          has_agenda_access: boolean | null
          has_checkin: boolean
          has_consultations: boolean | null
          has_zona_nutri_access: boolean | null
          id: string
          is_active: boolean
          last_consultation_at: string | null
          last_consultation_index: number | null
          monthly_value: number
          name: string
          notes: string | null
          onboarding_type: string | null
          payment_date: string | null
          payment_type: string | null
          phone: string | null
          plan_duration: string | null
          plan_type: string
          registration_source: string | null
          remaining_consultations: number | null
          service_type: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_attention_points?: string | null
          admin_next_focus?: string | null
          admin_notes_short?: string | null
          admin_summary?: string | null
          athlete_status?: string | null
          athlete_user_id?: string | null
          checkin_frequency?: string | null
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          eligible_for_booking?: boolean
          email?: string | null
          end_date: string
          first_consultation_date?: string | null
          has_agenda_access?: boolean | null
          has_checkin?: boolean
          has_consultations?: boolean | null
          has_zona_nutri_access?: boolean | null
          id?: string
          is_active?: boolean
          last_consultation_at?: string | null
          last_consultation_index?: number | null
          monthly_value: number
          name: string
          notes?: string | null
          onboarding_type?: string | null
          payment_date?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_duration?: string | null
          plan_type: string
          registration_source?: string | null
          remaining_consultations?: number | null
          service_type: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_attention_points?: string | null
          admin_next_focus?: string | null
          admin_notes_short?: string | null
          admin_summary?: string | null
          athlete_status?: string | null
          athlete_user_id?: string | null
          checkin_frequency?: string | null
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          eligible_for_booking?: boolean
          email?: string | null
          end_date?: string
          first_consultation_date?: string | null
          has_agenda_access?: boolean | null
          has_checkin?: boolean
          has_consultations?: boolean | null
          has_zona_nutri_access?: boolean | null
          id?: string
          is_active?: boolean
          last_consultation_at?: string | null
          last_consultation_index?: number | null
          monthly_value?: number
          name?: string
          notes?: string | null
          onboarding_type?: string | null
          payment_date?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_duration?: string | null
          plan_type?: string
          registration_source?: string | null
          remaining_consultations?: number | null
          service_type?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consult_automation_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          message_template_booking: string | null
          message_template_confirmation: string | null
          send_day_of_week: number
          send_time: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_template_booking?: string | null
          message_template_confirmation?: string | null
          send_day_of_week?: number
          send_time?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          message_template_booking?: string | null
          message_template_confirmation?: string | null
          send_day_of_week?: number
          send_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consult_invite_logs: {
        Row: {
          channel: string
          client_id: string
          error_message: string | null
          id: string
          message_type: string
          metadata: Json | null
          sent_at: string
          status: string
        }
        Insert: {
          channel?: string
          client_id: string
          error_message?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          sent_at?: string
          status?: string
        }
        Update: {
          channel?: string
          client_id?: string
          error_message?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "consult_invite_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_schedule_rules: {
        Row: {
          cadence_weeks: number
          client_id: string
          consultations_completed: number | null
          created_at: string
          first_consultation_at: string | null
          is_enabled: boolean
          last_appointment_at: string | null
          last_link_sent_at: string | null
          next_invite_date: string | null
          next_link_send_date: string | null
          next_link_send_time: string | null
          updated_at: string
        }
        Insert: {
          cadence_weeks?: number
          client_id: string
          consultations_completed?: number | null
          created_at?: string
          first_consultation_at?: string | null
          is_enabled?: boolean
          last_appointment_at?: string | null
          last_link_sent_at?: string | null
          next_invite_date?: string | null
          next_link_send_date?: string | null
          next_link_send_time?: string | null
          updated_at?: string
        }
        Update: {
          cadence_weeks?: number
          client_id?: string
          consultations_completed?: number | null
          created_at?: string
          first_consultation_at?: string | null
          is_enabled?: boolean
          last_appointment_at?: string | null
          last_link_sent_at?: string | null
          next_invite_date?: string | null
          next_link_send_date?: string | null
          next_link_send_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_schedule_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_schedules: {
        Row: {
          booking_expires_at: string | null
          booking_token: string | null
          client_id: string
          created_at: string
          id: string
          scheduled_date: string
          scheduled_time: string | null
          send_link_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_expires_at?: string | null
          booking_token?: string | null
          client_id: string
          created_at?: string
          id?: string
          scheduled_date: string
          scheduled_time?: string | null
          send_link_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_expires_at?: string | null
          booking_token?: string | null
          client_id?: string
          created_at?: string
          id?: string
          scheduled_date?: string
          scheduled_time?: string | null
          send_link_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_control_cycles: {
        Row: {
          client_id: string
          created_at: string
          end_date: string
          id: string
          is_active: boolean | null
          start_date: string
        }
        Insert: {
          client_id: string
          created_at?: string
          end_date: string
          id?: string
          is_active?: boolean | null
          start_date: string
        }
        Update: {
          client_id?: string
          created_at?: string
          end_date?: string
          id?: string
          is_active?: boolean | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_control_cycles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_control_entries: {
        Row: {
          created_at: string
          cycle_id: string
          entry_date: string
          id: string
          updated_at: string
          waist_circumference: number | null
          weight: number | null
        }
        Insert: {
          created_at?: string
          cycle_id: string
          entry_date: string
          id?: string
          updated_at?: string
          waist_circumference?: number | null
          weight?: number | null
        }
        Update: {
          created_at?: string
          cycle_id?: string
          entry_date?: string
          id?: string
          updated_at?: string
          waist_circumference?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_control_entries_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "daily_control_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_adjustment_alerts: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_adjustment_at: string | null
          next_alert_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_adjustment_at?: string | null
          next_alert_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_adjustment_at?: string | null
          next_alert_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_adjustment_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_app_config: {
        Row: {
          app_code: string | null
          app_download_instructions: string | null
          created_at: string
          id: string
          support_instructions: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          app_code?: string | null
          app_download_instructions?: string | null
          created_at?: string
          id?: string
          support_instructions?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          app_code?: string | null
          app_download_instructions?: string | null
          created_at?: string
          id?: string
          support_instructions?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          due_date: string
          due_day: number | null
          expense_type: string
          id: string
          notes: string | null
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          description: string
          due_date: string
          due_day?: number | null
          expense_type?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          due_date?: string
          due_day?: number | null
          expense_type?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_debts: {
        Row: {
          area: string
          created_at: string
          due_date: string | null
          has_due_date: boolean | null
          id: string
          name: string
          notes: string | null
          priority: string
          remaining_amount: number
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          due_date?: string | null
          has_due_date?: boolean | null
          id?: string
          name: string
          notes?: string | null
          priority?: string
          remaining_amount: number
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          due_date?: string | null
          has_due_date?: boolean | null
          id?: string
          name?: string
          notes?: string | null
          priority?: string
          remaining_amount?: number
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_initial_balances: {
        Row: {
          amount: number
          area: string
          created_at: string
          id: string
          notes: string | null
          reference_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          area?: string
          created_at?: string
          id?: string
          notes?: string | null
          reference_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          area?: string
          created_at?: string
          id?: string
          notes?: string | null
          reference_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          area: string
          card_name: string | null
          category: string
          created_at: string
          current_installment: number | null
          date: string
          description: string | null
          id: string
          installments: number | null
          is_recurring: boolean | null
          notes: string | null
          origin: string | null
          payment_method: string | null
          receipt_method: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          area: string
          card_name?: string | null
          category: string
          created_at?: string
          current_installment?: number | null
          date?: string
          description?: string | null
          id?: string
          installments?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          origin?: string | null
          payment_method?: string | null
          receipt_method?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          area?: string
          card_name?: string | null
          category?: string
          created_at?: string
          current_installment?: number | null
          date?: string
          description?: string | null
          id?: string
          installments?: number | null
          is_recurring?: boolean | null
          notes?: string | null
          origin?: string | null
          payment_method?: string | null
          receipt_method?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_calendar_connections: {
        Row: {
          calendar_id: string | null
          created_at: string
          id: string
          is_connected: boolean
          last_sync_at: string | null
          service_account_email: string | null
          service_account_key_encrypted: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          service_account_email?: string | null
          service_account_key_encrypted?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          service_account_email?: string | null
          service_account_key_encrypted?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_oauth_connections: {
        Row: {
          access_token: string | null
          created_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kiwify_purchases: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          order_id: string | null
          phone: string | null
          product_id: string | null
          product_name: string | null
          purchase_date: string
          status: string
          webhook_data: Json | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          order_id?: string | null
          phone?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_date?: string
          status?: string
          webhook_data?: Json | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          order_id?: string | null
          phone?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_date?: string
          status?: string
          webhook_data?: Json | null
        }
        Relationships: []
      }
      landing_page_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      link_bio_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          link_url: string | null
          order_index: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          order_index?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          link_url?: string | null
          order_index?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_plan_status: {
        Row: {
          client_id: string
          created_at: string
          id: string
          sent_at: string | null
          status: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          sent_at?: string | null
          status?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_status_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_status_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          available_variables: string[] | null
          created_at: string
          description: string | null
          id: string
          template_content: string
          template_key: string
          template_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_variables?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          template_content: string
          template_key: string
          template_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_variables?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          template_content?: string
          template_key?: string
          template_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          plan_end_date: string | null
          plan_start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_end_date?: string | null
          plan_start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          plan_end_date?: string | null
          plan_start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      question_templates: {
        Row: {
          category: string
          comment_field_label: string | null
          comment_field_required: boolean | null
          created_at: string
          has_comment_field: boolean
          id: string
          is_required: boolean
          options: Json | null
          question_text: string
          question_type: string
          scale_max: number | null
          scale_min: number | null
          section: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          comment_field_label?: string | null
          comment_field_required?: boolean | null
          created_at?: string
          has_comment_field?: boolean
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text: string
          question_type: string
          scale_max?: number | null
          scale_min?: number | null
          section?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          comment_field_label?: string | null
          comment_field_required?: boolean | null
          created_at?: string
          has_comment_field?: boolean
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text?: string
          question_type?: string
          scale_max?: number | null
          scale_min?: number | null
          section?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_checkins: {
        Row: {
          client_id: string
          created_at: string
          form_id: string | null
          id: string
          notes: string | null
          response_id: string | null
          scheduled_send_date: string
          scheduled_send_time: string | null
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          form_id?: string | null
          id?: string
          notes?: string | null
          response_id?: string | null
          scheduled_send_date: string
          scheduled_send_time?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          form_id?: string | null
          id?: string
          notes?: string | null
          response_id?: string | null
          scheduled_send_date?: string
          scheduled_send_time?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_checkins_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_checkins_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "checkin_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_checkins_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "checkin_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_blocks: {
        Row: {
          block_date: string
          block_type: string
          created_at: string
          end_time: string | null
          id: string
          reason: string | null
          start_time: string | null
          user_id: string
        }
        Insert: {
          block_date: string
          block_type?: string
          created_at?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          start_time?: string | null
          user_id: string
        }
        Update: {
          block_date?: string
          block_type?: string
          created_at?: string
          end_time?: string | null
          id?: string
          reason?: string | null
          start_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scheduling_settings: {
        Row: {
          booking_link_slug: string | null
          buffer_minutes: number
          created_at: string
          id: string
          slot_duration_minutes: number
          updated_at: string
          user_id: string
          working_days: Json
          working_hours_end: string
          working_hours_start: string
        }
        Insert: {
          booking_link_slug?: string | null
          buffer_minutes?: number
          created_at?: string
          id?: string
          slot_duration_minutes?: number
          updated_at?: string
          user_id: string
          working_days?: Json
          working_hours_end?: string
          working_hours_start?: string
        }
        Update: {
          booking_link_slug?: string | null
          buffer_minutes?: number
          created_at?: string
          id?: string
          slot_duration_minutes?: number
          updated_at?: string
          user_id?: string
          working_days?: Json
          working_hours_end?: string
          working_hours_start?: string
        }
        Relationships: []
      }
      scheduling_time_blocks: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          settings_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          settings_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          settings_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_time_blocks_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "scheduling_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      support_materials: {
        Row: {
          category: string
          content: string | null
          content_type: string
          created_at: string
          id: string
          is_active: boolean | null
          order_index: number | null
          title: string | null
          updated_at: string
          user_id: string
          youtube_url: string | null
        }
        Insert: {
          category: string
          content?: string | null
          content_type: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title?: string | null
          updated_at?: string
          user_id: string
          youtube_url?: string | null
        }
        Update: {
          category?: string
          content?: string | null
          content_type?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          title?: string | null
          updated_at?: string
          user_id?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      task_label_assignments: {
        Row: {
          created_at: string
          id: string
          label_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          day_of_week: number
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          is_archived: boolean
          is_pinned: boolean
          order_index: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          order_index?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          order_index?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_message_logs: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message_type: string
          metadata: Json | null
          payload_preview: string | null
          status: string
          template_key: string | null
          to_phone: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type: string
          metadata?: Json | null
          payload_preview?: string | null
          status?: string
          template_key?: string | null
          to_phone: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          payload_preview?: string | null
          status?: string
          template_key?: string | null
          to_phone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_scheduled_messages: {
        Row: {
          appointment_id: string | null
          client_id: string
          context_data: Json
          created_at: string
          error_message: string | null
          id: string
          scheduled_checkin_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          context_data?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          scheduled_checkin_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          template_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          context_data?: Json
          created_at?: string
          error_message?: string | null
          id?: string
          scheduled_checkin_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_scheduled_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_messages_scheduled_checkin_id_fkey"
            columns: ["scheduled_checkin_id"]
            isOneToOne: false
            referencedRelation: "scheduled_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body: string
          created_at: string | null
          default_timing: string | null
          id: string
          is_active: boolean | null
          template_key: string
          template_name: string
          title: string | null
          updated_at: string | null
          user_id: string
          variables: string[] | null
        }
        Insert: {
          body: string
          created_at?: string | null
          default_timing?: string | null
          id?: string
          is_active?: boolean | null
          template_key: string
          template_name: string
          title?: string | null
          updated_at?: string | null
          user_id: string
          variables?: string[] | null
        }
        Update: {
          body?: string
          created_at?: string | null
          default_timing?: string | null
          id?: string
          is_active?: boolean | null
          template_key?: string
          template_name?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string
          variables?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_next_booking_send_date: {
        Args: { p_cadence_weeks: number; p_last_appointment_at: string }
        Returns: string
      }
      create_public_booking_appointment: {
        Args: { p_date: string; p_time: string; p_token: string }
        Returns: {
          appointment_id: string
        }[]
      }
      get_pending_booking_invites: {
        Args: never
        Returns: {
          admin_user_id: string
          cadence_weeks: number
          client_id: string
          client_name: string
          client_phone: string
        }[]
      }
      get_public_booking_context: {
        Args: { p_token: string }
        Returns: {
          admin_user_id: string
          booking_link_id: string
          client_id: string
          client_name: string
          usage_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invoke_booking_links_processor: { Args: never; Returns: undefined }
      mark_pending_reminders: {
        Args: never
        Returns: {
          appointment_date: string
          appointment_id: string
          appointment_time: string
          client_name: string
          client_phone: string
          google_meet_link: string
        }[]
      }
      validate_booking_email: {
        Args: { p_email: string; p_token: string }
        Returns: {
          admin_user_id: string
          client_id: string
          client_name: string
          error_message: string
          valid: boolean
        }[]
      }
      validate_booking_email_v2: {
        Args: { p_email: string; p_token: string }
        Returns: {
          admin_user_id: string
          anamnese_completed: boolean
          client_id: string
          client_name: string
          eligible_for_booking: boolean
          error_message: string
          is_active: boolean
          onboarding_type: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "athlete"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "athlete"],
    },
  },
} as const
