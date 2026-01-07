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
          client_id: string
          form_id: string
          id: string
          responses: Json
          submitted_at: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id: string
          form_id: string
          id?: string
          responses: Json
          submitted_at?: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_analyzed_at?: string | null
          client_id?: string
          form_id?: string
          id?: string
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
          duration_minutes: number
          id: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          client_id: string
          consultation_schedule_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          client_id?: string
          consultation_schedule_id?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          status?: string
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
      athlete_profiles: {
        Row: {
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
          athlete_status: string | null
          athlete_user_id: string | null
          checkin_frequency: string | null
          consultation_count: number | null
          consultation_frequency: string | null
          created_at: string
          email: string | null
          end_date: string
          first_consultation_date: string | null
          has_checkin: boolean
          has_consultations: boolean | null
          id: string
          is_active: boolean
          monthly_value: number
          name: string
          notes: string | null
          payment_date: string | null
          payment_type: string | null
          phone: string | null
          plan_duration: string | null
          plan_type: string
          registration_source: string | null
          service_type: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          athlete_status?: string | null
          athlete_user_id?: string | null
          checkin_frequency?: string | null
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          email?: string | null
          end_date: string
          first_consultation_date?: string | null
          has_checkin?: boolean
          has_consultations?: boolean | null
          id?: string
          is_active?: boolean
          monthly_value: number
          name: string
          notes?: string | null
          payment_date?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_duration?: string | null
          plan_type: string
          registration_source?: string | null
          service_type: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          athlete_status?: string | null
          athlete_user_id?: string | null
          checkin_frequency?: string | null
          consultation_count?: number | null
          consultation_frequency?: string | null
          created_at?: string
          email?: string | null
          end_date?: string
          first_consultation_date?: string | null
          has_checkin?: boolean
          has_consultations?: boolean | null
          id?: string
          is_active?: boolean
          monthly_value?: number
          name?: string
          notes?: string | null
          payment_date?: string | null
          payment_type?: string | null
          phone?: string | null
          plan_duration?: string | null
          plan_type?: string
          registration_source?: string | null
          service_type?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          due_date: string
          id: string
          paid_at: string | null
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
          paid_at?: string | null
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
          paid_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
