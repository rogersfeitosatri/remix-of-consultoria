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
      admin_layout_settings: {
        Row: {
          avatar_url: string | null
          brand_name: string | null
          brand_subtitle: string | null
          created_at: string
          id: string
          logo_url: string | null
          sidebar_items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          brand_name?: string | null
          brand_subtitle?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          sidebar_items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          brand_name?: string | null
          brand_subtitle?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          sidebar_items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          admin_whatsapp_number: string | null
          created_at: string | null
          enable_continuation_mode: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_whatsapp_number?: string | null
          created_at?: string | null
          enable_continuation_mode?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_whatsapp_number?: string | null
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
      ai_chat_conversations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_message_at: string | null
          message_count: number
          phone_e164: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          phone_e164: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          message_count?: number
          phone_e164?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_escalations: {
        Row: {
          client_id: string
          conversation_id: string
          created_at: string
          excerpt: string
          id: string
          message_id: string | null
          resolved_at: string | null
          status: string
          trigger: string
          user_id: string
        }
        Insert: {
          client_id: string
          conversation_id: string
          created_at?: string
          excerpt: string
          id?: string
          message_id?: string | null
          resolved_at?: string | null
          status?: string
          trigger: string
          user_id: string
        }
        Update: {
          client_id?: string
          conversation_id?: string
          created_at?: string
          excerpt?: string
          id?: string
          message_id?: string | null
          resolved_at?: string | null
          status?: string
          trigger?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_escalations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_escalations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_escalations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          escalated: boolean
          id: string
          model: string | null
          role: string
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
          wa_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          escalated?: boolean
          id?: string
          model?: string | null
          role: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
          wa_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          escalated?: boolean
          id?: string
          model?: string | null
          role?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_settings: {
        Row: {
          created_at: string
          enabled: boolean
          escalation_keywords: string[]
          model: string
          system_prompt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          escalation_keywords?: string[]
          model?: string
          system_prompt?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          escalation_keywords?: string[]
          model?: string
          system_prompt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      athlete_checkin_schedules: {
        Row: {
          checkin_form_id: string
          client_id: string
          created_at: string
          due_at: string | null
          due_in_hours: number | null
          frequency_type: string
          id: string
          is_active: boolean
          last_dispatched_at: string | null
          send_time: string
          start_date: string
          timezone: string
          updated_at: string
          user_id: string
          weekly_days: number[] | null
        }
        Insert: {
          checkin_form_id: string
          client_id: string
          created_at?: string
          due_at?: string | null
          due_in_hours?: number | null
          frequency_type?: string
          id?: string
          is_active?: boolean
          last_dispatched_at?: string | null
          send_time?: string
          start_date: string
          timezone?: string
          updated_at?: string
          user_id: string
          weekly_days?: number[] | null
        }
        Update: {
          checkin_form_id?: string
          client_id?: string
          created_at?: string
          due_at?: string | null
          due_in_hours?: number | null
          frequency_type?: string
          id?: string
          is_active?: boolean
          last_dispatched_at?: string | null
          send_time?: string
          start_date?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          weekly_days?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_checkin_schedules_checkin_form_id_fkey"
            columns: ["checkin_form_id"]
            isOneToOne: false
            referencedRelation: "checkin_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_checkin_schedules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_completed_races: {
        Row: {
          archived_at: string
          client_id: string
          created_at: string
          id: string
          notes: string | null
          race_date: string | null
          race_name: string
          user_id: string
        }
        Insert: {
          archived_at?: string
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          race_date?: string | null
          race_name: string
          user_id: string
        }
        Update: {
          archived_at?: string
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          race_date?: string | null
          race_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_completed_races_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_periodization: {
        Row: {
          client_id: string
          created_at: string
          id: string
          initial_cho_gkg: number | null
          method_id: string
          plan_adjustment_type: string
          race_date: string
          start_date: string
          timeline_blocks: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          initial_cho_gkg?: number | null
          method_id: string
          plan_adjustment_type?: string
          race_date: string
          start_date: string
          timeline_blocks?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          initial_cho_gkg?: number | null
          method_id?: string
          plan_adjustment_type?: string
          race_date?: string
          start_date?: string
          timeline_blocks?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_periodization_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_periodization_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "periodization_method"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_periodization_notes: {
        Row: {
          athlete_periodization_id: string
          block_index: number | null
          created_at: string
          id: string
          note_text: string
          phase_id: string
        }
        Insert: {
          athlete_periodization_id: string
          block_index?: number | null
          created_at?: string
          id?: string
          note_text: string
          phase_id: string
        }
        Update: {
          athlete_periodization_id?: string
          block_index?: number | null
          created_at?: string
          id?: string
          note_text?: string
          phase_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_periodization_notes_athlete_periodization_id_fkey"
            columns: ["athlete_periodization_id"]
            isOneToOne: false
            referencedRelation: "athlete_periodization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_periodization_notes_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "periodization_method_phases"
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
      call_bookings: {
        Row: {
          booking_date: string
          booking_time: string
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmation_sent_at: string | null
          created_at: string
          duration_minutes: number
          google_calendar_event_id: string | null
          id: string
          lead_email: string | null
          lead_name: string | null
          lead_phone: string | null
          meeting_link: string | null
          notes: string | null
          reminder_15m_sent_at: string | null
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          scheduling_link_id: string
          status: string
          strategic_call_id: string | null
          strategic_call_response_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_date: string
          booking_time: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          meeting_link?: string | null
          notes?: string | null
          reminder_15m_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          scheduling_link_id: string
          status?: string
          strategic_call_id?: string | null
          strategic_call_response_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_date?: string
          booking_time?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmation_sent_at?: string | null
          created_at?: string
          duration_minutes?: number
          google_calendar_event_id?: string | null
          id?: string
          lead_email?: string | null
          lead_name?: string | null
          lead_phone?: string | null
          meeting_link?: string | null
          notes?: string | null
          reminder_15m_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          scheduling_link_id?: string
          status?: string
          strategic_call_id?: string | null
          strategic_call_response_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_bookings_scheduling_link_id_fkey"
            columns: ["scheduling_link_id"]
            isOneToOne: false
            referencedRelation: "call_scheduling_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_bookings_strategic_call_id_fkey"
            columns: ["strategic_call_id"]
            isOneToOne: false
            referencedRelation: "strategic_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_bookings_strategic_call_response_id_fkey"
            columns: ["strategic_call_response_id"]
            isOneToOne: false
            referencedRelation: "strategic_call_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      call_scheduling_links: {
        Row: {
          allow_multiple_per_lead: boolean
          blocked_dates: Json
          buffer_after_minutes: number
          buffer_before_minutes: number
          cancellation_template: string | null
          confirmation_template: string | null
          created_at: string
          daily_limit: number | null
          description: string | null
          extra_dates: Json
          id: string
          max_advance_days: number
          meeting_link: string | null
          min_advance_hours: number
          reminder_15m_template: string | null
          reminder_24h_template: string | null
          reminder_2h_template: string | null
          require_manual_confirmation: boolean
          send_reminder_15m: boolean
          send_reminder_24h: boolean
          send_reminder_2h: boolean
          slot_capacity: number
          slot_duration_minutes: number
          slug: string
          status: string
          strategic_call_id: string | null
          timezone: string
          title: string
          updated_at: string
          user_id: string
          weekly_availability: Json
        }
        Insert: {
          allow_multiple_per_lead?: boolean
          blocked_dates?: Json
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancellation_template?: string | null
          confirmation_template?: string | null
          created_at?: string
          daily_limit?: number | null
          description?: string | null
          extra_dates?: Json
          id?: string
          max_advance_days?: number
          meeting_link?: string | null
          min_advance_hours?: number
          reminder_15m_template?: string | null
          reminder_24h_template?: string | null
          reminder_2h_template?: string | null
          require_manual_confirmation?: boolean
          send_reminder_15m?: boolean
          send_reminder_24h?: boolean
          send_reminder_2h?: boolean
          slot_capacity?: number
          slot_duration_minutes?: number
          slug: string
          status?: string
          strategic_call_id?: string | null
          timezone?: string
          title: string
          updated_at?: string
          user_id: string
          weekly_availability?: Json
        }
        Update: {
          allow_multiple_per_lead?: boolean
          blocked_dates?: Json
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cancellation_template?: string | null
          confirmation_template?: string | null
          created_at?: string
          daily_limit?: number | null
          description?: string | null
          extra_dates?: Json
          id?: string
          max_advance_days?: number
          meeting_link?: string | null
          min_advance_hours?: number
          reminder_15m_template?: string | null
          reminder_24h_template?: string | null
          reminder_2h_template?: string | null
          require_manual_confirmation?: boolean
          send_reminder_15m?: boolean
          send_reminder_24h?: boolean
          send_reminder_2h?: boolean
          slot_capacity?: number
          slot_duration_minutes?: number
          slug?: string
          status?: string
          strategic_call_id?: string | null
          timezone?: string
          title?: string
          updated_at?: string
          user_id?: string
          weekly_availability?: Json
        }
        Relationships: [
          {
            foreignKeyName: "call_scheduling_links_strategic_call_id_fkey"
            columns: ["strategic_call_id"]
            isOneToOne: false
            referencedRelation: "strategic_calls"
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
      checkin_dispatch_runs: {
        Row: {
          details: Json | null
          error_message: string | null
          finished_at: string | null
          id: string
          source: string
          started_at: string
          status: string
          total_analyzed: number
          total_dispatched: number
          total_eligible: number
          total_failed: number
          total_skipped: number
        }
        Insert: {
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: string
          total_analyzed?: number
          total_dispatched?: number
          total_eligible?: number
          total_failed?: number
          total_skipped?: number
        }
        Update: {
          details?: Json | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          source?: string
          started_at?: string
          status?: string
          total_analyzed?: number
          total_dispatched?: number
          total_eligible?: number
          total_failed?: number
          total_skipped?: number
        }
        Relationships: []
      }
      checkin_dispatches: {
        Row: {
          checkin_form_id: string
          client_id: string
          created_at: string
          dispatch_token: string | null
          due_at: string | null
          error_message: string | null
          id: string
          link_checkin: string | null
          provider_response: Json | null
          schedule_id: string | null
          sent_at: string
          status: string
          user_id: string
          whatsapp_log_id: string | null
        }
        Insert: {
          checkin_form_id: string
          client_id: string
          created_at?: string
          dispatch_token?: string | null
          due_at?: string | null
          error_message?: string | null
          id?: string
          link_checkin?: string | null
          provider_response?: Json | null
          schedule_id?: string | null
          sent_at?: string
          status?: string
          user_id: string
          whatsapp_log_id?: string | null
        }
        Update: {
          checkin_form_id?: string
          client_id?: string
          created_at?: string
          dispatch_token?: string | null
          due_at?: string | null
          error_message?: string | null
          id?: string
          link_checkin?: string | null
          provider_response?: Json | null
          schedule_id?: string | null
          sent_at?: string
          status?: string
          user_id?: string
          whatsapp_log_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkin_dispatches_checkin_form_id_fkey"
            columns: ["checkin_form_id"]
            isOneToOne: false
            referencedRelation: "checkin_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_dispatches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_dispatches_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "athlete_checkin_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_feedbacks: {
        Row: {
          admin_decision: string | null
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
          admin_decision?: string | null
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
          admin_decision?: string | null
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
          is_periodization: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_periodization?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_periodization?: boolean
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
      client_plan_history: {
        Row: {
          checkin_frequency: string | null
          client_id: string
          consultation_count: number | null
          consultation_frequency: string | null
          created_at: string
          end_date: string
          has_agenda_access: boolean | null
          has_checkin: boolean | null
          has_consultations: boolean | null
          id: string
          monthly_value: number
          notes: string | null
          payment_type: string | null
          plan_duration: string | null
          plan_type: string
          renewed_at: string
          service_type: string
          start_date: string
          user_id: string
        }
        Insert: {
          checkin_frequency?: string | null
          client_id: string
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          end_date: string
          has_agenda_access?: boolean | null
          has_checkin?: boolean | null
          has_consultations?: boolean | null
          id?: string
          monthly_value?: number
          notes?: string | null
          payment_type?: string | null
          plan_duration?: string | null
          plan_type: string
          renewed_at?: string
          service_type: string
          start_date: string
          user_id: string
        }
        Update: {
          checkin_frequency?: string | null
          client_id?: string
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          end_date?: string
          has_agenda_access?: boolean | null
          has_checkin?: boolean | null
          has_consultations?: boolean | null
          id?: string
          monthly_value?: number
          notes?: string | null
          payment_type?: string | null
          plan_duration?: string | null
          plan_type?: string
          renewed_at?: string
          service_type?: string
          start_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_plan_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
          ai_whatsapp_enabled: boolean
          athlete_status: string | null
          athlete_user_id: string | null
          checkin_frequency: string | null
          checkin_response_window_hours: number | null
          checkin_start_date: string | null
          consultation_count: number | null
          consultation_frequency: string | null
          created_at: string
          eligible_for_booking: boolean
          email: string | null
          end_date: string
          first_consultation_date: string | null
          freeze_reason: string | null
          frozen_at: string | null
          has_agenda_access: boolean | null
          has_checkin: boolean
          has_consultations: boolean | null
          has_zona_nutri_access: boolean | null
          id: string
          is_active: boolean
          is_frozen: boolean
          last_consultation_at: string | null
          last_consultation_index: number | null
          monthly_value: number
          name: string
          notes: string | null
          onboarding_status: string | null
          onboarding_type: string | null
          payment_date: string | null
          payment_type: string | null
          phone: string | null
          plan_duration: string | null
          plan_sent_at: string | null
          plan_type: string
          registration_source: string | null
          remaining_consultations: number | null
          selected_plan_id: string | null
          service_type: string
          start_date: string
          total_frozen_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_attention_points?: string | null
          admin_next_focus?: string | null
          admin_notes_short?: string | null
          admin_summary?: string | null
          ai_whatsapp_enabled?: boolean
          athlete_status?: string | null
          athlete_user_id?: string | null
          checkin_frequency?: string | null
          checkin_response_window_hours?: number | null
          checkin_start_date?: string | null
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          eligible_for_booking?: boolean
          email?: string | null
          end_date: string
          first_consultation_date?: string | null
          freeze_reason?: string | null
          frozen_at?: string | null
          has_agenda_access?: boolean | null
          has_checkin?: boolean
          has_consultations?: boolean | null
          has_zona_nutri_access?: boolean | null
          id?: string
          is_active?: boolean
          is_frozen?: boolean
          last_consultation_at?: string | null
          last_consultation_index?: number | null
          monthly_value: number
          name: string
          notes?: string | null
          onboarding_status?: string | null
          onboarding_type?: string | null
          payment_date?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_duration?: string | null
          plan_sent_at?: string | null
          plan_type: string
          registration_source?: string | null
          remaining_consultations?: number | null
          selected_plan_id?: string | null
          service_type: string
          start_date: string
          total_frozen_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_attention_points?: string | null
          admin_next_focus?: string | null
          admin_notes_short?: string | null
          admin_summary?: string | null
          ai_whatsapp_enabled?: boolean
          athlete_status?: string | null
          athlete_user_id?: string | null
          checkin_frequency?: string | null
          checkin_response_window_hours?: number | null
          checkin_start_date?: string | null
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          eligible_for_booking?: boolean
          email?: string | null
          end_date?: string
          first_consultation_date?: string | null
          freeze_reason?: string | null
          frozen_at?: string | null
          has_agenda_access?: boolean | null
          has_checkin?: boolean
          has_consultations?: boolean | null
          has_zona_nutri_access?: boolean | null
          id?: string
          is_active?: boolean
          is_frozen?: boolean
          last_consultation_at?: string | null
          last_consultation_index?: number | null
          monthly_value?: number
          name?: string
          notes?: string | null
          onboarding_status?: string | null
          onboarding_type?: string | null
          payment_date?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_duration?: string | null
          plan_sent_at?: string | null
          plan_type?: string
          registration_source?: string | null
          remaining_consultations?: number | null
          selected_plan_id?: string | null
          service_type?: string
          start_date?: string
          total_frozen_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_selected_plan_id_fkey"
            columns: ["selected_plan_id"]
            isOneToOne: false
            referencedRelation: "onboarding_plans"
            referencedColumns: ["id"]
          },
        ]
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
          appointment_id: string | null
          booking_expires_at: string | null
          booking_token: string | null
          client_id: string
          confirmation_status: string | null
          confirmed_at: string | null
          created_at: string
          id: string
          link_sent_at: string | null
          scheduled_date: string
          scheduled_time: string | null
          send_link_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          booking_expires_at?: string | null
          booking_token?: string | null
          client_id: string
          confirmation_status?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          link_sent_at?: string | null
          scheduled_date: string
          scheduled_time?: string | null
          send_link_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          booking_expires_at?: string | null
          booking_token?: string | null
          client_id?: string
          confirmation_status?: string | null
          confirmed_at?: string | null
          created_at?: string
          id?: string
          link_sent_at?: string | null
          scheduled_date?: string
          scheduled_time?: string | null
          send_link_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_schedules_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      evolution_analyses: {
        Row: {
          analysis: Json
          client_id: string
          created_at: string
          has_target_race: boolean
          id: string
          target_race_deadline: string | null
          target_race_name: string | null
          updated_at: string
        }
        Insert: {
          analysis: Json
          client_id: string
          created_at?: string
          has_target_race?: boolean
          id?: string
          target_race_deadline?: string | null
          target_race_name?: string | null
          updated_at?: string
        }
        Update: {
          analysis?: Json
          client_id?: string
          created_at?: string
          has_target_race?: boolean
          id?: string
          target_race_deadline?: string | null
          target_race_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payments: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          paid_at: string
          period_month: number
          period_year: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          paid_at?: string
          period_month: number
          period_year: number
          user_id: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          paid_at?: string
          period_month?: number
          period_year?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
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
          monthly_cost_goal: number | null
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
          monthly_cost_goal?: number | null
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
          monthly_cost_goal?: number | null
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
      journey_day_dynamics: {
        Row: {
          afternoon_cho_pct: number | null
          ai_generated: boolean | null
          cho_classification: string | null
          cho_gkg: number | null
          created_at: string
          day_of_week: number
          distribution_rationale: string | null
          id: string
          intra_training: string | null
          journey_week_id: string
          morning_cho_pct: number | null
          night_cho_pct: number | null
          night_guidance: string | null
          notes: string | null
          post_training: string | null
          pre_training: string | null
        }
        Insert: {
          afternoon_cho_pct?: number | null
          ai_generated?: boolean | null
          cho_classification?: string | null
          cho_gkg?: number | null
          created_at?: string
          day_of_week: number
          distribution_rationale?: string | null
          id?: string
          intra_training?: string | null
          journey_week_id: string
          morning_cho_pct?: number | null
          night_cho_pct?: number | null
          night_guidance?: string | null
          notes?: string | null
          post_training?: string | null
          pre_training?: string | null
        }
        Update: {
          afternoon_cho_pct?: number | null
          ai_generated?: boolean | null
          cho_classification?: string | null
          cho_gkg?: number | null
          created_at?: string
          day_of_week?: number
          distribution_rationale?: string | null
          id?: string
          intra_training?: string | null
          journey_week_id?: string
          morning_cho_pct?: number | null
          night_cho_pct?: number | null
          night_guidance?: string | null
          notes?: string | null
          post_training?: string | null
          pre_training?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_day_dynamics_journey_week_id_fkey"
            columns: ["journey_week_id"]
            isOneToOne: false
            referencedRelation: "journey_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_phase_transitions: {
        Row: {
          athlete_periodization_id: string
          auto_adjustments: Json | null
          client_id: string
          created_at: string
          from_phase_id: string | null
          from_phase_name: string | null
          id: string
          notes: string | null
          to_phase_id: string | null
          to_phase_name: string | null
          transition_date: string
        }
        Insert: {
          athlete_periodization_id: string
          auto_adjustments?: Json | null
          client_id: string
          created_at?: string
          from_phase_id?: string | null
          from_phase_name?: string | null
          id?: string
          notes?: string | null
          to_phase_id?: string | null
          to_phase_name?: string | null
          transition_date?: string
        }
        Update: {
          athlete_periodization_id?: string
          auto_adjustments?: Json | null
          client_id?: string
          created_at?: string
          from_phase_id?: string | null
          from_phase_name?: string | null
          id?: string
          notes?: string | null
          to_phase_id?: string | null
          to_phase_name?: string | null
          transition_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_phase_transitions_athlete_periodization_id_fkey"
            columns: ["athlete_periodization_id"]
            isOneToOne: false
            referencedRelation: "athlete_periodization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_phase_transitions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_phase_transitions_from_phase_id_fkey"
            columns: ["from_phase_id"]
            isOneToOne: false
            referencedRelation: "journey_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_phase_transitions_to_phase_id_fkey"
            columns: ["to_phase_id"]
            isOneToOne: false
            referencedRelation: "journey_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_phases: {
        Row: {
          athlete_periodization_id: string
          beta_alanine: string | null
          body_comp_strategy: string | null
          caffeine: string | null
          cho_range: string | null
          client_id: string
          created_at: string
          creatine: string | null
          duration_weeks: number
          end_date: string | null
          id: string
          nitrate: string | null
          objective: string | null
          phase_name: string
          phase_order: number
          recovery_strategy: string | null
          start_date: string | null
          status: string
          strategic_notes: string | null
          supplement_base: string | null
          supplement_general: string | null
          train_low_strategy: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          athlete_periodization_id: string
          beta_alanine?: string | null
          body_comp_strategy?: string | null
          caffeine?: string | null
          cho_range?: string | null
          client_id: string
          created_at?: string
          creatine?: string | null
          duration_weeks?: number
          end_date?: string | null
          id?: string
          nitrate?: string | null
          objective?: string | null
          phase_name: string
          phase_order?: number
          recovery_strategy?: string | null
          start_date?: string | null
          status?: string
          strategic_notes?: string | null
          supplement_base?: string | null
          supplement_general?: string | null
          train_low_strategy?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          athlete_periodization_id?: string
          beta_alanine?: string | null
          body_comp_strategy?: string | null
          caffeine?: string | null
          cho_range?: string | null
          client_id?: string
          created_at?: string
          creatine?: string | null
          duration_weeks?: number
          end_date?: string | null
          id?: string
          nitrate?: string | null
          objective?: string | null
          phase_name?: string
          phase_order?: number
          recovery_strategy?: string | null
          start_date?: string | null
          status?: string
          strategic_notes?: string | null
          supplement_base?: string | null
          supplement_general?: string | null
          train_low_strategy?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_phases_athlete_periodization_id_fkey"
            columns: ["athlete_periodization_id"]
            isOneToOne: false
            referencedRelation: "athlete_periodization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_phases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_week_sessions: {
        Row: {
          carb_loading_enabled: boolean | null
          carb_loading_hours: number | null
          created_at: string
          day_of_week: number
          duration_minutes: number | null
          id: string
          intensity: string | null
          is_day_off: boolean | null
          is_long_run: boolean | null
          journey_week_id: string
          metabolic_objective: string | null
          modality: string | null
          priority: string | null
          shift: string | null
        }
        Insert: {
          carb_loading_enabled?: boolean | null
          carb_loading_hours?: number | null
          created_at?: string
          day_of_week: number
          duration_minutes?: number | null
          id?: string
          intensity?: string | null
          is_day_off?: boolean | null
          is_long_run?: boolean | null
          journey_week_id: string
          metabolic_objective?: string | null
          modality?: string | null
          priority?: string | null
          shift?: string | null
        }
        Update: {
          carb_loading_enabled?: boolean | null
          carb_loading_hours?: number | null
          created_at?: string
          day_of_week?: number
          duration_minutes?: number | null
          id?: string
          intensity?: string | null
          is_day_off?: boolean | null
          is_long_run?: boolean | null
          journey_week_id?: string
          metabolic_objective?: string | null
          modality?: string | null
          priority?: string | null
          shift?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_week_sessions_journey_week_id_fkey"
            columns: ["journey_week_id"]
            isOneToOne: false
            referencedRelation: "journey_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_weeks: {
        Row: {
          adjustment_log: Json | null
          client_id: string
          created_at: string
          id: string
          journey_phase_id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
          week_in_phase: number
          week_number: number
        }
        Insert: {
          adjustment_log?: Json | null
          client_id: string
          created_at?: string
          id?: string
          journey_phase_id: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          week_in_phase: number
          week_number: number
        }
        Update: {
          adjustment_log?: Json | null
          client_id?: string
          created_at?: string
          id?: string
          journey_phase_id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          week_in_phase?: number
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_weeks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_weeks_journey_phase_id_fkey"
            columns: ["journey_phase_id"]
            isOneToOne: false
            referencedRelation: "journey_phases"
            referencedColumns: ["id"]
          },
        ]
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
      metabolic_screening_responses: {
        Row: {
          ai_analysis: Json | null
          ai_analyzed_at: string | null
          client_id: string
          created_at: string
          id: string
          notes: string | null
          responses: Json
          score_assimilacao: number | null
          score_biotransformacao: number | null
          score_comunicacao: number | null
          score_defesa_reparo: number | null
          score_energia: number | null
          score_integridade_estrutural: number | null
          score_mental_emocional: number | null
          score_total: number | null
          score_transporte: number | null
          screening_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          responses?: Json
          score_assimilacao?: number | null
          score_biotransformacao?: number | null
          score_comunicacao?: number | null
          score_defesa_reparo?: number | null
          score_energia?: number | null
          score_integridade_estrutural?: number | null
          score_mental_emocional?: number | null
          score_total?: number | null
          score_transporte?: number | null
          screening_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          responses?: Json
          score_assimilacao?: number | null
          score_biotransformacao?: number | null
          score_comunicacao?: number | null
          score_defesa_reparo?: number | null
          score_energia?: number | null
          score_integridade_estrutural?: number | null
          score_mental_emocional?: number | null
          score_total?: number | null
          score_transporte?: number | null
          screening_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metabolic_screening_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      np_athlete_races: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          race_date: string
          race_distance_km: number
          race_name: string | null
          race_type: string
          target_time_minutes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          race_date: string
          race_distance_km: number
          race_name?: string | null
          race_type?: string
          target_time_minutes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          race_date?: string
          race_distance_km?: number
          race_name?: string | null
          race_type?: string
          target_time_minutes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "np_athlete_races_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      np_body_assessments: {
        Row: {
          abdomen: number | null
          abdominal: number | null
          assessment_date: string
          biceps: number | null
          calf: number | null
          chest: number | null
          client_id: string
          consultation_id: string
          created_at: string | null
          forearm: number | null
          height: number | null
          hip: number | null
          id: string
          left_arm: number | null
          left_calf: number | null
          left_thigh_max: number | null
          right_arm: number | null
          right_arm_contracted: number | null
          right_calf: number | null
          right_thigh_max: number | null
          subscapular: number | null
          suprailiac: number | null
          thigh: number | null
          triceps: number | null
          us_abdominal: number | null
          us_axillary: number | null
          us_biceps: number | null
          us_chest: number | null
          us_fat_kg: number | null
          us_fat_percentage: number | null
          us_lean_mass_kg: number | null
          us_lean_mass_percentage: number | null
          us_subscapular: number | null
          us_suprailiac: number | null
          us_thigh: number | null
          us_triceps: number | null
          waist: number | null
          weight: number | null
        }
        Insert: {
          abdomen?: number | null
          abdominal?: number | null
          assessment_date?: string
          biceps?: number | null
          calf?: number | null
          chest?: number | null
          client_id: string
          consultation_id: string
          created_at?: string | null
          forearm?: number | null
          height?: number | null
          hip?: number | null
          id?: string
          left_arm?: number | null
          left_calf?: number | null
          left_thigh_max?: number | null
          right_arm?: number | null
          right_arm_contracted?: number | null
          right_calf?: number | null
          right_thigh_max?: number | null
          subscapular?: number | null
          suprailiac?: number | null
          thigh?: number | null
          triceps?: number | null
          us_abdominal?: number | null
          us_axillary?: number | null
          us_biceps?: number | null
          us_chest?: number | null
          us_fat_kg?: number | null
          us_fat_percentage?: number | null
          us_lean_mass_kg?: number | null
          us_lean_mass_percentage?: number | null
          us_subscapular?: number | null
          us_suprailiac?: number | null
          us_thigh?: number | null
          us_triceps?: number | null
          waist?: number | null
          weight?: number | null
        }
        Update: {
          abdomen?: number | null
          abdominal?: number | null
          assessment_date?: string
          biceps?: number | null
          calf?: number | null
          chest?: number | null
          client_id?: string
          consultation_id?: string
          created_at?: string | null
          forearm?: number | null
          height?: number | null
          hip?: number | null
          id?: string
          left_arm?: number | null
          left_calf?: number | null
          left_thigh_max?: number | null
          right_arm?: number | null
          right_arm_contracted?: number | null
          right_calf?: number | null
          right_thigh_max?: number | null
          subscapular?: number | null
          suprailiac?: number | null
          thigh?: number | null
          triceps?: number | null
          us_abdominal?: number | null
          us_axillary?: number | null
          us_biceps?: number | null
          us_chest?: number | null
          us_fat_kg?: number | null
          us_fat_percentage?: number | null
          us_lean_mass_kg?: number | null
          us_lean_mass_percentage?: number | null
          us_subscapular?: number | null
          us_suprailiac?: number | null
          us_thigh?: number | null
          us_triceps?: number | null
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "np_body_assessments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "np_body_assessments_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "np_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      np_consultations: {
        Row: {
          activity_factor: number | null
          activity_factor_type: string | null
          calorimetry_value: number | null
          client_id: string
          consultation_date: string
          created_at: string | null
          fat_kg: number | null
          fat_percentage: number | null
          has_training_plan: boolean | null
          height: number | null
          id: string
          lean_mass_kg: number | null
          lean_mass_percentage: number | null
          manual_age: number | null
          manual_gender: string | null
          notes: string | null
          skinfold_sum: number | null
          sport_goal: string | null
          sport_modality: string | null
          target_race_date: string | null
          tmb_formula: string | null
          training_type: string | null
          updated_at: string | null
          user_id: string
          vct_friday: number | null
          vct_monday: number | null
          vct_saturday: number | null
          vct_sunday: number | null
          vct_thursday: number | null
          vct_tuesday: number | null
          vct_wednesday: number | null
          weight: number | null
        }
        Insert: {
          activity_factor?: number | null
          activity_factor_type?: string | null
          calorimetry_value?: number | null
          client_id: string
          consultation_date?: string
          created_at?: string | null
          fat_kg?: number | null
          fat_percentage?: number | null
          has_training_plan?: boolean | null
          height?: number | null
          id?: string
          lean_mass_kg?: number | null
          lean_mass_percentage?: number | null
          manual_age?: number | null
          manual_gender?: string | null
          notes?: string | null
          skinfold_sum?: number | null
          sport_goal?: string | null
          sport_modality?: string | null
          target_race_date?: string | null
          tmb_formula?: string | null
          training_type?: string | null
          updated_at?: string | null
          user_id: string
          vct_friday?: number | null
          vct_monday?: number | null
          vct_saturday?: number | null
          vct_sunday?: number | null
          vct_thursday?: number | null
          vct_tuesday?: number | null
          vct_wednesday?: number | null
          weight?: number | null
        }
        Update: {
          activity_factor?: number | null
          activity_factor_type?: string | null
          calorimetry_value?: number | null
          client_id?: string
          consultation_date?: string
          created_at?: string | null
          fat_kg?: number | null
          fat_percentage?: number | null
          has_training_plan?: boolean | null
          height?: number | null
          id?: string
          lean_mass_kg?: number | null
          lean_mass_percentage?: number | null
          manual_age?: number | null
          manual_gender?: string | null
          notes?: string | null
          skinfold_sum?: number | null
          sport_goal?: string | null
          sport_modality?: string | null
          target_race_date?: string | null
          tmb_formula?: string | null
          training_type?: string | null
          updated_at?: string | null
          user_id?: string
          vct_friday?: number | null
          vct_monday?: number | null
          vct_saturday?: number | null
          vct_sunday?: number | null
          vct_thursday?: number | null
          vct_tuesday?: number | null
          vct_wednesday?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "np_consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      np_daily_activities: {
        Row: {
          activity_name: string
          consultation_id: string
          created_at: string | null
          duration_hours: number
          id: string
          met_value: number
          order_index: number | null
        }
        Insert: {
          activity_name: string
          consultation_id: string
          created_at?: string | null
          duration_hours?: number
          id?: string
          met_value?: number
          order_index?: number | null
        }
        Update: {
          activity_name?: string
          consultation_id?: string
          created_at?: string | null
          duration_hours?: number
          id?: string
          met_value?: number
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "np_daily_activities_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "np_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      np_event_dispatches: {
        Row: {
          client_id: string
          error_message: string | null
          event_key: string
          event_type: string
          id: string
          race_id: string | null
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          client_id: string
          error_message?: string | null
          event_key: string
          event_type: string
          id?: string
          race_id?: string | null
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          client_id?: string
          error_message?: string | null
          event_key?: string
          event_type?: string
          id?: string
          race_id?: string | null
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "np_event_dispatches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "np_event_dispatches_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "np_athlete_races"
            referencedColumns: ["id"]
          },
        ]
      }
      np_evolution_summaries: {
        Row: {
          audience: string
          client_id: string
          created_at: string
          edited_content: string | null
          id: string
          logs_analyzed: number
          model: string
          phase: string | null
          race_id: string | null
          recommendations: Json
          summary_markdown: string
          user_id: string
          weeks_to_race: number | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          audience?: string
          client_id: string
          created_at?: string
          edited_content?: string | null
          id?: string
          logs_analyzed?: number
          model?: string
          phase?: string | null
          race_id?: string | null
          recommendations?: Json
          summary_markdown: string
          user_id: string
          weeks_to_race?: number | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          audience?: string
          client_id?: string
          created_at?: string
          edited_content?: string | null
          id?: string
          logs_analyzed?: number
          model?: string
          phase?: string | null
          race_id?: string | null
          recommendations?: Json
          summary_markdown?: string
          user_id?: string
          weeks_to_race?: number | null
          whatsapp_sent_at?: string | null
        }
        Relationships: []
      }
      np_gut_training_logs: {
        Row: {
          adherence_pct: number | null
          athlete_notes: string | null
          checkin_date: string
          cho_source: string | null
          client_id: string
          created_at: string
          current_cho_rate_g_h: number | null
          decision: string | null
          gi_bloating: number | null
          gi_cramps: number | null
          gi_diarrhea: number | null
          gi_nausea: number | null
          gi_score_global: number | null
          id: string
          next_cho_rate_g_h: number | null
          nutritionist_notes: string | null
          user_id: string
        }
        Insert: {
          adherence_pct?: number | null
          athlete_notes?: string | null
          checkin_date?: string
          cho_source?: string | null
          client_id: string
          created_at?: string
          current_cho_rate_g_h?: number | null
          decision?: string | null
          gi_bloating?: number | null
          gi_cramps?: number | null
          gi_diarrhea?: number | null
          gi_nausea?: number | null
          gi_score_global?: number | null
          id?: string
          next_cho_rate_g_h?: number | null
          nutritionist_notes?: string | null
          user_id: string
        }
        Update: {
          adherence_pct?: number | null
          athlete_notes?: string | null
          checkin_date?: string
          cho_source?: string | null
          client_id?: string
          created_at?: string
          current_cho_rate_g_h?: number | null
          decision?: string | null
          gi_bloating?: number | null
          gi_cramps?: number | null
          gi_diarrhea?: number | null
          gi_nausea?: number | null
          gi_score_global?: number | null
          id?: string
          next_cho_rate_g_h?: number | null
          nutritionist_notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "np_gut_training_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      np_lab_results: {
        Row: {
          client_id: string
          collection_date: string | null
          created_at: string | null
          exam_category: string | null
          exam_name: string
          id: string
          panel_name: string
          rcv_95: number | null
          ref_max: number | null
          ref_min: number | null
          result_text: string | null
          result_value: number | null
          unit: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          collection_date?: string | null
          created_at?: string | null
          exam_category?: string | null
          exam_name: string
          id?: string
          panel_name: string
          rcv_95?: number | null
          ref_max?: number | null
          ref_min?: number | null
          result_text?: string | null
          result_value?: number | null
          unit?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          collection_date?: string | null
          created_at?: string | null
          exam_category?: string | null
          exam_name?: string
          id?: string
          panel_name?: string
          rcv_95?: number | null
          ref_max?: number | null
          ref_min?: number | null
          result_text?: string | null
          result_value?: number | null
          unit?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "np_lab_results_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      np_periodization_checkin_links: {
        Row: {
          active: boolean
          client_id: string
          created_at: string
          expires_at: string | null
          id: string
          token: string
          updated_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          client_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          token: string
          updated_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          client_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          token?: string
          updated_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      np_periodization_checkins: {
        Row: {
          adherence_pct: number | null
          client_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          decision_note: string | null
          dynamic_form_id: string | null
          dynamic_responses: Json
          energy_score: number | null
          gi_score: number | null
          id: string
          link_id: string | null
          long_run_completed: boolean | null
          notes: string | null
          phase: string | null
          race_id: string | null
          sleep_score: number | null
          submitted_at: string
          symptoms: Json | null
          updated_at: string
          user_id: string
          weekly_mileage_km: number | null
          weight_kg: number | null
        }
        Insert: {
          adherence_pct?: number | null
          client_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_note?: string | null
          dynamic_form_id?: string | null
          dynamic_responses?: Json
          energy_score?: number | null
          gi_score?: number | null
          id?: string
          link_id?: string | null
          long_run_completed?: boolean | null
          notes?: string | null
          phase?: string | null
          race_id?: string | null
          sleep_score?: number | null
          submitted_at?: string
          symptoms?: Json | null
          updated_at?: string
          user_id: string
          weekly_mileage_km?: number | null
          weight_kg?: number | null
        }
        Update: {
          adherence_pct?: number | null
          client_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          decision_note?: string | null
          dynamic_form_id?: string | null
          dynamic_responses?: Json
          energy_score?: number | null
          gi_score?: number | null
          id?: string
          link_id?: string | null
          long_run_completed?: boolean | null
          notes?: string | null
          phase?: string | null
          race_id?: string | null
          sleep_score?: number | null
          submitted_at?: string
          symptoms?: Json | null
          updated_at?: string
          user_id?: string
          weekly_mileage_km?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "np_periodization_checkins_dynamic_form_id_fkey"
            columns: ["dynamic_form_id"]
            isOneToOne: false
            referencedRelation: "checkin_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "np_periodization_checkins_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "np_periodization_checkin_links"
            referencedColumns: ["id"]
          },
        ]
      }
      np_periodization_weeks: {
        Row: {
          caffeine_mg_kg: number | null
          carb_loading_type: string | null
          cho_gkg: number | null
          cho_percentage: number | null
          client_id: string
          competition_name: string | null
          created_at: string | null
          cycle_start_date: string | null
          daily_strategies: Json | null
          end_date: string | null
          energy_availability: number | null
          fat_gkg: number | null
          functional_supplements: string | null
          gi_tolerance_rating: number | null
          has_competition: boolean | null
          hydration_strategy: string | null
          id: string
          intra_cho_gh: number | null
          is_adjustment_week: boolean | null
          lab_exam_request: string | null
          lipid_percentage: number | null
          micro_adjustment_notes: string | null
          month_name: string | null
          nutritional_plan: string | null
          phase_name: string | null
          phase_objectives: string | null
          pre_training_cho_gkg: number | null
          protein_gkg: number | null
          protein_percentage: number | null
          race_simulation_notes: string | null
          sodium_strategy: string | null
          start_date: string | null
          sup_beta_alanine: boolean | null
          sup_bromelain: boolean | null
          sup_broncovaxon: boolean | null
          sup_caffeine: boolean | null
          sup_cherry_pure: boolean | null
          sup_creatine: boolean | null
          sup_curcumin: boolean | null
          sup_ganoderma: boolean | null
          sup_nac: boolean | null
          sup_nitrate: boolean | null
          sup_omega3: boolean | null
          sup_recovery: boolean | null
          sup_vitc_time_release: boolean | null
          sup_vitd: boolean | null
          supplement_notes: string | null
          updated_at: string | null
          user_id: string
          week_number: number
        }
        Insert: {
          caffeine_mg_kg?: number | null
          carb_loading_type?: string | null
          cho_gkg?: number | null
          cho_percentage?: number | null
          client_id: string
          competition_name?: string | null
          created_at?: string | null
          cycle_start_date?: string | null
          daily_strategies?: Json | null
          end_date?: string | null
          energy_availability?: number | null
          fat_gkg?: number | null
          functional_supplements?: string | null
          gi_tolerance_rating?: number | null
          has_competition?: boolean | null
          hydration_strategy?: string | null
          id?: string
          intra_cho_gh?: number | null
          is_adjustment_week?: boolean | null
          lab_exam_request?: string | null
          lipid_percentage?: number | null
          micro_adjustment_notes?: string | null
          month_name?: string | null
          nutritional_plan?: string | null
          phase_name?: string | null
          phase_objectives?: string | null
          pre_training_cho_gkg?: number | null
          protein_gkg?: number | null
          protein_percentage?: number | null
          race_simulation_notes?: string | null
          sodium_strategy?: string | null
          start_date?: string | null
          sup_beta_alanine?: boolean | null
          sup_bromelain?: boolean | null
          sup_broncovaxon?: boolean | null
          sup_caffeine?: boolean | null
          sup_cherry_pure?: boolean | null
          sup_creatine?: boolean | null
          sup_curcumin?: boolean | null
          sup_ganoderma?: boolean | null
          sup_nac?: boolean | null
          sup_nitrate?: boolean | null
          sup_omega3?: boolean | null
          sup_recovery?: boolean | null
          sup_vitc_time_release?: boolean | null
          sup_vitd?: boolean | null
          supplement_notes?: string | null
          updated_at?: string | null
          user_id: string
          week_number: number
        }
        Update: {
          caffeine_mg_kg?: number | null
          carb_loading_type?: string | null
          cho_gkg?: number | null
          cho_percentage?: number | null
          client_id?: string
          competition_name?: string | null
          created_at?: string | null
          cycle_start_date?: string | null
          daily_strategies?: Json | null
          end_date?: string | null
          energy_availability?: number | null
          fat_gkg?: number | null
          functional_supplements?: string | null
          gi_tolerance_rating?: number | null
          has_competition?: boolean | null
          hydration_strategy?: string | null
          id?: string
          intra_cho_gh?: number | null
          is_adjustment_week?: boolean | null
          lab_exam_request?: string | null
          lipid_percentage?: number | null
          micro_adjustment_notes?: string | null
          month_name?: string | null
          nutritional_plan?: string | null
          phase_name?: string | null
          phase_objectives?: string | null
          pre_training_cho_gkg?: number | null
          protein_gkg?: number | null
          protein_percentage?: number | null
          race_simulation_notes?: string | null
          sodium_strategy?: string | null
          start_date?: string | null
          sup_beta_alanine?: boolean | null
          sup_bromelain?: boolean | null
          sup_broncovaxon?: boolean | null
          sup_caffeine?: boolean | null
          sup_cherry_pure?: boolean | null
          sup_creatine?: boolean | null
          sup_curcumin?: boolean | null
          sup_ganoderma?: boolean | null
          sup_nac?: boolean | null
          sup_nitrate?: boolean | null
          sup_omega3?: boolean | null
          sup_recovery?: boolean | null
          sup_vitc_time_release?: boolean | null
          sup_vitd?: boolean | null
          supplement_notes?: string | null
          updated_at?: string | null
          user_id?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "np_periodization_weeks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      np_phase_protocols: {
        Row: {
          carboloading_active: boolean | null
          carboloading_checklist: Json | null
          carboloading_protocol: string | null
          cho_daily_range: string | null
          cho_intra_protocol: string | null
          cho_intra_target_g_h: number | null
          cho_pre_protocol: string | null
          client_id: string
          created_at: string
          current_phase: string | null
          gut_training_target_g_h: number | null
          id: string
          override_reason: string | null
          phase_override: string | null
          race_goal_id: string | null
          updated_at: string
          user_id: string
          weeks_to_race: number | null
        }
        Insert: {
          carboloading_active?: boolean | null
          carboloading_checklist?: Json | null
          carboloading_protocol?: string | null
          cho_daily_range?: string | null
          cho_intra_protocol?: string | null
          cho_intra_target_g_h?: number | null
          cho_pre_protocol?: string | null
          client_id: string
          created_at?: string
          current_phase?: string | null
          gut_training_target_g_h?: number | null
          id?: string
          override_reason?: string | null
          phase_override?: string | null
          race_goal_id?: string | null
          updated_at?: string
          user_id: string
          weeks_to_race?: number | null
        }
        Update: {
          carboloading_active?: boolean | null
          carboloading_checklist?: Json | null
          carboloading_protocol?: string | null
          cho_daily_range?: string | null
          cho_intra_protocol?: string | null
          cho_intra_target_g_h?: number | null
          cho_pre_protocol?: string | null
          client_id?: string
          created_at?: string
          current_phase?: string | null
          gut_training_target_g_h?: number | null
          id?: string
          override_reason?: string | null
          phase_override?: string | null
          race_goal_id?: string | null
          updated_at?: string
          user_id?: string
          weeks_to_race?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "np_phase_protocols_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "np_phase_protocols_race_goal_id_fkey"
            columns: ["race_goal_id"]
            isOneToOne: false
            referencedRelation: "np_athlete_races"
            referencedColumns: ["id"]
          },
        ]
      }
      np_protocol_defaults: {
        Row: {
          alerts_contraindications: string | null
          carboloading_duration_days: number | null
          carboloading_indicated: boolean | null
          carboloading_max_gkg: number | null
          carboloading_min_gkg: number | null
          carboloading_protocol: string | null
          cho_daily_range: string | null
          cho_intra_description: string | null
          cho_intra_max_g_h: number | null
          cho_intra_min_g_h: number | null
          cho_intra_source: string | null
          clinical_focus: string | null
          created_at: string
          distance_category: string
          gut_training_description: string | null
          id: string
          phase: string
          pre_training_protocol: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alerts_contraindications?: string | null
          carboloading_duration_days?: number | null
          carboloading_indicated?: boolean | null
          carboloading_max_gkg?: number | null
          carboloading_min_gkg?: number | null
          carboloading_protocol?: string | null
          cho_daily_range?: string | null
          cho_intra_description?: string | null
          cho_intra_max_g_h?: number | null
          cho_intra_min_g_h?: number | null
          cho_intra_source?: string | null
          clinical_focus?: string | null
          created_at?: string
          distance_category: string
          gut_training_description?: string | null
          id?: string
          phase: string
          pre_training_protocol?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alerts_contraindications?: string | null
          carboloading_duration_days?: number | null
          carboloading_indicated?: boolean | null
          carboloading_max_gkg?: number | null
          carboloading_min_gkg?: number | null
          carboloading_protocol?: string | null
          cho_daily_range?: string | null
          cho_intra_description?: string | null
          cho_intra_max_g_h?: number | null
          cho_intra_min_g_h?: number | null
          cho_intra_source?: string | null
          clinical_focus?: string | null
          created_at?: string
          distance_category?: string
          gut_training_description?: string | null
          id?: string
          phase?: string
          pre_training_protocol?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      np_running_schedule: {
        Row: {
          consultation_id: string
          created_at: string | null
          day_of_week: number
          duration_minutes: number | null
          id: string
          zone_id: string | null
        }
        Insert: {
          consultation_id: string
          created_at?: string | null
          day_of_week: number
          duration_minutes?: number | null
          id?: string
          zone_id?: string | null
        }
        Update: {
          consultation_id?: string
          created_at?: string | null
          day_of_week?: number
          duration_minutes?: number | null
          id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "np_running_schedule_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "np_consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "np_running_schedule_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "np_running_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      np_running_zones: {
        Row: {
          consultation_id: string
          created_at: string | null
          hr_zone: string | null
          id: string
          met_value: number
          order_index: number | null
          pace: string | null
          speed_kmh: string | null
          zone_name: string
        }
        Insert: {
          consultation_id: string
          created_at?: string | null
          hr_zone?: string | null
          id?: string
          met_value?: number
          order_index?: number | null
          pace?: string | null
          speed_kmh?: string | null
          zone_name: string
        }
        Update: {
          consultation_id?: string
          created_at?: string | null
          hr_zone?: string | null
          id?: string
          met_value?: number
          order_index?: number | null
          pace?: string | null
          speed_kmh?: string | null
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "np_running_zones_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "np_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      np_triathlon_schedule: {
        Row: {
          consultation_id: string
          created_at: string | null
          day_of_week: number
          duration_minutes: number | null
          id: string
          intensity: string | null
          met_value: number | null
          modality: string
        }
        Insert: {
          consultation_id: string
          created_at?: string | null
          day_of_week: number
          duration_minutes?: number | null
          id?: string
          intensity?: string | null
          met_value?: number | null
          modality: string
        }
        Update: {
          consultation_id?: string
          created_at?: string | null
          day_of_week?: number
          duration_minutes?: number | null
          id?: string
          intensity?: string | null
          met_value?: number | null
          modality?: string
        }
        Relationships: [
          {
            foreignKeyName: "np_triathlon_schedule_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "np_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_payment_settings: {
        Row: {
          anamnese_form_id: string | null
          created_at: string
          id: string
          mp_public_key: string | null
          reminder_days: number
          updated_at: string
          user_id: string
        }
        Insert: {
          anamnese_form_id?: string | null
          created_at?: string
          id?: string
          mp_public_key?: string | null
          reminder_days?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          anamnese_form_id?: string | null
          created_at?: string
          id?: string
          mp_public_key?: string | null
          reminder_days?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_payment_settings_anamnese_form_id_fkey"
            columns: ["anamnese_form_id"]
            isOneToOne: false
            referencedRelation: "anamnese_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_plans: {
        Row: {
          category: string
          checkin_frequency: string | null
          consultation_interval_weeks: number
          consultations_count: number
          created_at: string
          description: string | null
          duration_months: number
          id: string
          is_active: boolean
          name: string
          order_index: number
          payment_link: string | null
          periodicity: string
          price: number
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          checkin_frequency?: string | null
          consultation_interval_weeks?: number
          consultations_count?: number
          created_at?: string
          description?: string | null
          duration_months: number
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          payment_link?: string | null
          periodicity: string
          price?: number
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          checkin_frequency?: string | null
          consultation_interval_weeks?: number
          consultations_count?: number
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          payment_link?: string | null
          periodicity?: string
          price?: number
          slug?: string
          updated_at?: string
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
      periodiza_admin_instructions: {
        Row: {
          created_at: string
          id: string
          instructions: string
          is_default: boolean
          preset_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string
          is_default?: boolean
          preset_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string
          is_default?: boolean
          preset_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      periodiza_knowledge_base: {
        Row: {
          active: boolean
          collection: string | null
          content: string
          created_at: string
          id: string
          priority: number
          source_reference: string | null
          source_type: string
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          collection?: string | null
          content: string
          created_at?: string
          id?: string
          priority?: number
          source_reference?: string | null
          source_type?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          collection?: string | null
          content?: string
          created_at?: string
          id?: string
          priority?: number
          source_reference?: string | null
          source_type?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      periodiza_suggestions: {
        Row: {
          blocks: Json | null
          client_id: string
          consultation_id: string | null
          created_at: string
          gee_snapshot: Json | null
          human_readable: string | null
          id: string
          is_active: boolean
          manual_edits: Json | null
          monthly_adjustments: Json | null
          nutritionist_notes: Json | null
          periodization_start_date: string | null
          phase_plan: Json | null
          plan_adjustment_type: string | null
          suggestion_type: string
          taper_protocol: Json | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          blocks?: Json | null
          client_id: string
          consultation_id?: string | null
          created_at?: string
          gee_snapshot?: Json | null
          human_readable?: string | null
          id?: string
          is_active?: boolean
          manual_edits?: Json | null
          monthly_adjustments?: Json | null
          nutritionist_notes?: Json | null
          periodization_start_date?: string | null
          phase_plan?: Json | null
          plan_adjustment_type?: string | null
          suggestion_type?: string
          taper_protocol?: Json | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          blocks?: Json | null
          client_id?: string
          consultation_id?: string | null
          created_at?: string
          gee_snapshot?: Json | null
          human_readable?: string | null
          id?: string
          is_active?: boolean
          manual_edits?: Json | null
          monthly_adjustments?: Json | null
          nutritionist_notes?: Json | null
          periodization_start_date?: string | null
          phase_plan?: Json | null
          plan_adjustment_type?: string | null
          suggestion_type?: string
          taper_protocol?: Json | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "periodiza_suggestions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodiza_suggestions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "np_consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      periodization_method: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          method_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          method_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          method_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      periodization_method_log: {
        Row: {
          change_description: string
          changed_by: string
          created_at: string
          id: string
          method_id: string
          snapshot: Json | null
        }
        Insert: {
          change_description: string
          changed_by: string
          created_at?: string
          id?: string
          method_id: string
          snapshot?: Json | null
        }
        Update: {
          change_description?: string
          changed_by?: string
          created_at?: string
          id?: string
          method_id?: string
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "periodization_method_log_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "periodization_method"
            referencedColumns: ["id"]
          },
        ]
      }
      periodization_method_phases: {
        Row: {
          avoid_checklist: Json | null
          created_at: string
          do_checklist: Json | null
          functional_support: Json | null
          id: string
          is_active: boolean
          macro_targets: Json | null
          method_id: string
          phase_goal: string | null
          phase_name: string
          phase_order: number
          pre_intra_long_run: Json | null
          supplementation_daily: Json | null
          updated_at: string
        }
        Insert: {
          avoid_checklist?: Json | null
          created_at?: string
          do_checklist?: Json | null
          functional_support?: Json | null
          id?: string
          is_active?: boolean
          macro_targets?: Json | null
          method_id: string
          phase_goal?: string | null
          phase_name: string
          phase_order?: number
          pre_intra_long_run?: Json | null
          supplementation_daily?: Json | null
          updated_at?: string
        }
        Update: {
          avoid_checklist?: Json | null
          created_at?: string
          do_checklist?: Json | null
          functional_support?: Json | null
          id?: string
          is_active?: boolean
          macro_targets?: Json | null
          method_id?: string
          phase_goal?: string | null
          phase_name?: string
          phase_order?: number
          pre_intra_long_run?: Json | null
          supplementation_daily?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "periodization_method_phases_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "periodization_method"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_templates: {
        Row: {
          checkin_frequency: string | null
          consultation_count: number
          consultation_frequency: string | null
          created_at: string
          description: string | null
          has_checkin: boolean
          has_consultations: boolean
          id: string
          is_active: boolean
          name: string
          order_index: number
          plan_duration: string
          plan_type: string
          service_type: string
          suggested_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_frequency?: string | null
          consultation_count?: number
          consultation_frequency?: string | null
          created_at?: string
          description?: string | null
          has_checkin?: boolean
          has_consultations?: boolean
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          plan_duration?: string
          plan_type?: string
          service_type?: string
          suggested_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_frequency?: string | null
          consultation_count?: number
          consultation_frequency?: string | null
          created_at?: string
          description?: string | null
          has_checkin?: boolean
          has_consultations?: boolean
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          plan_duration?: string
          plan_type?: string
          service_type?: string
          suggested_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          max_advance_days: number
          min_advance_unit: string
          min_advance_value: number
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
          max_advance_days?: number
          min_advance_unit?: string
          min_advance_value?: number
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
          max_advance_days?: number
          min_advance_unit?: string
          min_advance_value?: number
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
      strategic_call_questions: {
        Row: {
          call_id: string
          created_at: string
          field_name: string | null
          id: string
          is_required: boolean
          options: Json | null
          order_index: number
          question_text: string
          question_type: string
          score_map: Json | null
        }
        Insert: {
          call_id: string
          created_at?: string
          field_name?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text: string
          question_type?: string
          score_map?: Json | null
        }
        Update: {
          call_id?: string
          created_at?: string
          field_name?: string | null
          id?: string
          is_required?: boolean
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: string
          score_map?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_call_questions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "strategic_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_call_responses: {
        Row: {
          answers: Json
          call_id: string
          classification: string | null
          id: string
          respondent_email: string | null
          respondent_name: string | null
          respondent_phone: string | null
          submitted_at: string
          total_score: number | null
          whatsapp_sent: boolean | null
        }
        Insert: {
          answers?: Json
          call_id: string
          classification?: string | null
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_phone?: string | null
          submitted_at?: string
          total_score?: number | null
          whatsapp_sent?: boolean | null
        }
        Update: {
          answers?: Json
          call_id?: string
          classification?: string | null
          id?: string
          respondent_email?: string | null
          respondent_name?: string | null
          respondent_phone?: string | null
          submitted_at?: string
          total_score?: number | null
          whatsapp_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_call_responses_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "strategic_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      strategic_calls: {
        Row: {
          admin_notify_phone: string | null
          button_color: string | null
          button_text: string | null
          closing_date: string | null
          created_at: string
          google_form_url: string | null
          id: string
          name: string
          page_image_url: string | null
          page_text: string | null
          page_title: string | null
          redirect_url: string | null
          slug: string
          status: string
          updated_at: string
          user_id: string
          whatsapp_message: string | null
        }
        Insert: {
          admin_notify_phone?: string | null
          button_color?: string | null
          button_text?: string | null
          closing_date?: string | null
          created_at?: string
          google_form_url?: string | null
          id?: string
          name: string
          page_image_url?: string | null
          page_text?: string | null
          page_title?: string | null
          redirect_url?: string | null
          slug: string
          status?: string
          updated_at?: string
          user_id: string
          whatsapp_message?: string | null
        }
        Update: {
          admin_notify_phone?: string | null
          button_color?: string | null
          button_text?: string | null
          closing_date?: string | null
          created_at?: string
          google_form_url?: string | null
          id?: string
          name?: string
          page_image_url?: string | null
          page_text?: string | null
          page_title?: string | null
          redirect_url?: string | null
          slug?: string
          status?: string
          updated_at?: string
          user_id?: string
          whatsapp_message?: string | null
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      target_races: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_gamification: {
        Row: {
          created_at: string
          current_streak: number
          last_completed_date: string | null
          level: number
          longest_streak: number
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_completed_date?: string | null
          level?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_completed_date?: string | null
          level?: number
          longest_streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
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
      task_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string
          day_of_week: number
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          is_archived: boolean
          is_pinned: boolean
          order_index: number
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_day_of_month: number | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_interval: number
          recurrence_type: string
          reminder_enabled: boolean
          reminder_method: string
          reminder_minutes_before: number
          reminder_sent_at: string | null
          source: Database["public"]["Enums"]["task_source"]
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          day_of_week: number
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          order_index?: number
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_day_of_month?: number | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: string
          reminder_enabled?: boolean
          reminder_method?: string
          reminder_minutes_before?: number
          reminder_sent_at?: string | null
          source?: Database["public"]["Enums"]["task_source"]
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          day_of_week?: number
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          order_index?: number
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_day_of_month?: number | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_interval?: number
          recurrence_type?: string
          reminder_enabled?: boolean
          reminder_method?: string
          reminder_minutes_before?: number
          reminder_sent_at?: string | null
          source?: Database["public"]["Enums"]["task_source"]
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_broadcast_recipients: {
        Row: {
          broadcast_id: string
          client_id: string | null
          contact_id: string | null
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string | null
          phone: string
          provider_response: Json | null
          recipient_name: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          broadcast_id: string
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          phone: string
          provider_response?: Json | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          broadcast_id?: string
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          phone?: string
          provider_response?: Json | null
          recipient_name?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_broadcast_recipients_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_broadcast_recipients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_broadcast_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_broadcasts: {
        Row: {
          body: string
          created_at: string
          failed_count: number | null
          id: string
          internal_title: string
          is_recurring: boolean | null
          last_recurrence_at: string | null
          media_type: string | null
          media_url: string | null
          parent_broadcast_id: string | null
          recurrence_days: number[] | null
          recurrence_end_date: string | null
          recurrence_time: string | null
          recurrence_type: string | null
          scheduled_at: string | null
          send_type: string
          sent_count: number | null
          status: string
          total_recipients: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          failed_count?: number | null
          id?: string
          internal_title: string
          is_recurring?: boolean | null
          last_recurrence_at?: string | null
          media_type?: string | null
          media_url?: string | null
          parent_broadcast_id?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_time?: string | null
          recurrence_type?: string | null
          scheduled_at?: string | null
          send_type?: string
          sent_count?: number | null
          status?: string
          total_recipients?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          failed_count?: number | null
          id?: string
          internal_title?: string
          is_recurring?: boolean | null
          last_recurrence_at?: string | null
          media_type?: string | null
          media_url?: string | null
          parent_broadcast_id?: string | null
          recurrence_days?: number[] | null
          recurrence_end_date?: string | null
          recurrence_time?: string | null
          recurrence_type?: string | null
          scheduled_at?: string | null
          send_type?: string
          sent_count?: number | null
          status?: string
          total_recipients?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_broadcasts_parent_broadcast_id_fkey"
            columns: ["parent_broadcast_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string
          source: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone: string
          source?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string
          source?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_message_logs: {
        Row: {
          appointment_id: string | null
          blocked_reason: string | null
          client_id: string | null
          consultation_schedule_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          message_type: string
          metadata: Json | null
          payload_preview: string | null
          status: string
          template_key: string | null
          to_phone: string
          triggered_by: string | null
          user_id: string
        }
        Insert: {
          appointment_id?: string | null
          blocked_reason?: string | null
          client_id?: string | null
          consultation_schedule_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type: string
          metadata?: Json | null
          payload_preview?: string | null
          status?: string
          template_key?: string | null
          to_phone: string
          triggered_by?: string | null
          user_id: string
        }
        Update: {
          appointment_id?: string | null
          blocked_reason?: string | null
          client_id?: string | null
          consultation_schedule_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          metadata?: Json | null
          payload_preview?: string | null
          status?: string
          template_key?: string | null
          to_phone?: string
          triggered_by?: string | null
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
      checkin_send_audit: {
        Row: {
          audit_status: string | null
          client_id: string | null
          client_name: string | null
          dispatch_id: string | null
          log_id: string | null
          log_status: string | null
          sent_at: string | null
          to_phone: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calc_task_level: { Args: { p_xp: number }; Returns: number }
      calculate_next_booking_send_date: {
        Args: { p_cadence_weeks: number; p_last_appointment_at: string }
        Returns: string
      }
      can_submit_checkin_response: {
        Args: { _client_id: string; _form_id: string }
        Returns: boolean
      }
      cancel_overdue_inactive_scheduled_checkins: {
        Args: never
        Returns: {
          cancelled: number
        }[]
      }
      cancel_public_booking_as_completed: {
        Args: { p_appointment_id: string; p_token: string }
        Returns: {
          appointment_id: string
        }[]
      }
      check_booking_send_duplicate: {
        Args: {
          _client_id: string
          _consultation_schedule_id?: string
          _template_key: string
        }
        Returns: {
          existing_log_id: string
          is_duplicate: boolean
          reason: string
        }[]
      }
      create_call_booking: {
        Args: {
          p_booking_date: string
          p_booking_time: string
          p_lead_email?: string
          p_lead_name?: string
          p_lead_phone?: string
          p_scheduling_link_id: string
          p_strategic_call_response_id?: string
        }
        Returns: string
      }
      create_checkin_dispatch_for_send: {
        Args: {
          p_client_id: string
          p_link_checkin: string
          p_source?: string
          p_user_id: string
        }
        Returns: string
      }
      create_public_booking_appointment: {
        Args: { p_date: string; p_time: string; p_token: string }
        Returns: {
          appointment_id: string
        }[]
      }
      create_public_lead_appointment: {
        Args: {
          p_date: string
          p_email: string
          p_name: string
          p_phone?: string
          p_slug: string
          p_time: string
        }
        Returns: {
          appointment_id: string
          client_id: string
          is_new_lead: boolean
        }[]
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_call_available_slots: {
        Args: { p_date: string; p_scheduling_link_id: string }
        Returns: {
          available: boolean
          slot_time: string
        }[]
      }
      get_np_checkin_context: {
        Args: { p_token: string }
        Returns: {
          admin_user_id: string
          checkin_form_id: string
          checkin_form_title: string
          client_id: string
          client_name: string
          link_id: string
          race_date: string
          race_name: string
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
      get_public_appointment_slots: {
        Args: { p_from_date?: string; p_to_date?: string; p_user_id: string }
        Returns: {
          appointment_date: string
          appointment_time: string
          duration_minutes: number
          status: string
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
      get_public_client_upcoming_appointments: {
        Args: { p_token: string }
        Returns: {
          appointment_date: string
          appointment_id: string
          appointment_time: string
          duration_minutes: number
          google_meet_link: string
          hours_until: number
          status: string
        }[]
      }
      get_public_scheduling_blocks: {
        Args: { p_from_date?: string; p_to_date?: string; p_user_id: string }
        Returns: {
          block_date: string
          block_type: string
          end_time: string
          start_time: string
        }[]
      }
      get_public_scheduling_settings_by_slug: {
        Args: { p_slug: string }
        Returns: {
          booking_link_slug: string
          buffer_minutes: number
          id: string
          max_advance_days: number
          min_advance_unit: string
          min_advance_value: number
          slot_duration_minutes: number
          user_id: string
          working_days: Json
          working_hours_end: string
          working_hours_start: string
        }[]
      }
      get_public_scheduling_settings_by_user: {
        Args: { p_user_id: string }
        Returns: {
          buffer_minutes: number
          id: string
          max_advance_days: number
          min_advance_unit: string
          min_advance_value: number
          slot_duration_minutes: number
          user_id: string
          working_days: Json
          working_hours_end: string
          working_hours_start: string
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
      is_client_eligible_for_booking: {
        Args: { _client_id: string }
        Returns: {
          eligible: boolean
          reason: string
        }[]
      }
      is_trainer_of_current_athlete: {
        Args: { _trainer_id: string }
        Returns: boolean
      }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_recurrence_date: {
        Args: {
          p_day_of_month: number
          p_days: number[]
          p_from: string
          p_interval: number
          p_type: string
        }
        Returns: string
      }
      preview_consultation_pipeline: {
        Args: {
          p_consultation_count: number
          p_consultation_frequency: string
          p_end_date?: string
          p_start_date: string
        }
        Returns: {
          exceeds_end_date: boolean
          scheduled_date: string
          send_link_date: string
          sequence_index: number
        }[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reconcile_scheduled_checkins: {
        Args: never
        Returns: {
          reconciled: number
        }[]
      }
      reschedule_public_booking_appointment: {
        Args: {
          p_appointment_id: string
          p_date: string
          p_time: string
          p_token: string
        }
        Returns: {
          appointment_id: string
        }[]
      }
      resolve_public_checkin_form: {
        Args: { p_form_id: string }
        Returns: {
          description: string
          id: string
          is_active: boolean
          redirected: boolean
          title: string
        }[]
      }
      seed_default_plan_templates: {
        Args: { p_user_id: string }
        Returns: undefined
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
      task_priority: "low" | "medium" | "high" | "urgent"
      task_source:
        | "manual"
        | "auto_anamnese"
        | "auto_checkin"
        | "auto_consultation"
        | "auto_diet"
      task_status: "pending" | "in_progress" | "done" | "overdue"
      task_type:
        | "meal_plan"
        | "checkin_response"
        | "consultation_prep"
        | "diet_adjustment"
        | "custom"
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
      task_priority: ["low", "medium", "high", "urgent"],
      task_source: [
        "manual",
        "auto_anamnese",
        "auto_checkin",
        "auto_consultation",
        "auto_diet",
      ],
      task_status: ["pending", "in_progress", "done", "overdue"],
      task_type: [
        "meal_plan",
        "checkin_response",
        "consultation_prep",
        "diet_adjustment",
        "custom",
      ],
    },
  },
} as const
