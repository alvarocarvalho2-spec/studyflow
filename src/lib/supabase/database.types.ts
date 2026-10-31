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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      attempt_answers: {
        Row: {
          attempt_id: string
          correct_option_label: string
          created_at: string
          explanation: string | null
          id: string
          is_correct: boolean
          question_position: number
          question_prompt: string
          quiz_id: string
          selected_option_label: string | null
          topic_label: string | null
          user_id: string
        }
        Insert: {
          attempt_id: string
          correct_option_label: string
          created_at?: string
          explanation?: string | null
          id?: string
          is_correct?: boolean
          question_position: number
          question_prompt: string
          quiz_id: string
          selected_option_label?: string | null
          topic_label?: string | null
          user_id?: string
        }
        Update: {
          attempt_id?: string
          correct_option_label?: string
          created_at?: string
          explanation?: string | null
          id?: string
          is_correct?: boolean
          question_position?: number
          question_prompt?: string
          quiz_id?: string
          selected_option_label?: string | null
          topic_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_owner_fk"
            columns: ["attempt_id", "quiz_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id", "quiz_id", "user_id"]
          },
        ]
      }
      question_options: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          question_id: string
          quiz_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position: number
          question_id: string
          quiz_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          question_id?: string
          quiz_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_owner_fk"
            columns: ["question_id", "quiz_id", "user_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id", "quiz_id", "user_id"]
          },
        ]
      }
      question_bank_options: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position: number
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_questions: {
        Row: {
          created_at: string
          difficulty: number
          id: string
          origin_exam: string | null
          origin_label: string
          origin_license: string | null
          origin_type: "original" | "official_adaptation"
          origin_url: string | null
          prompt: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: number
          id?: string
          origin_exam?: string | null
          origin_label?: string
          origin_license?: string | null
          origin_type?: "original" | "official_adaptation"
          origin_url?: string | null
          prompt: string
          topic_id: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          id?: string
          origin_exam?: string | null
          origin_label?: string
          origin_license?: string | null
          origin_type?: "original" | "official_adaptation"
          origin_url?: string | null
          prompt?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "question_bank_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank_subjects: {
        Row: {
          area: string
          created_at: string
          id: string
          name: string
          position: number
          slug: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          name: string
          position: number
          slug: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      question_bank_topics: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          slug: string
          subject_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position: number
          slug: string
          subject_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          slug?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "question_bank_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          position: number
          prompt: string
          quiz_id: string
          source_bank_question_id: string | null
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          position: number
          prompt: string
          quiz_id: string
          source_bank_question_id?: string | null
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          position?: number
          prompt?: string
          quiz_id?: string
          source_bank_question_id?: string | null
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_owner_fk"
            columns: ["quiz_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "questions_topic_owner_fk"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "questions_source_bank_question_id_fkey"
            columns: ["source_bank_question_id"]
            isOneToOne: false
            referencedRelation: "question_bank_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_reviews: {
        Row: {
          flashcard_id: string
          id: string
          interval_after_days: number
          interval_before_days: number
          next_review_at: string
          rating: number
          reviewed_at: string
          user_id: string
        }
        Insert: {
          flashcard_id: string
          id?: string
          interval_after_days?: number
          interval_before_days?: number
          next_review_at?: string
          rating: number
          reviewed_at?: string
          user_id?: string
        }
        Update: {
          flashcard_id?: string
          id?: string
          interval_after_days?: number
          interval_before_days?: number
          next_review_at?: string
          rating?: number
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_card_owner_fk"
            columns: ["flashcard_id", "user_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "flashcard_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          front: string
          id: string
          interval_days: number
          last_reviewed_at: string | null
          next_review_at: string
          repetitions: number
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          next_review_at?: string
          repetitions?: number
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          next_review_at?: string
          repetitions?: number
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_topic_owner_fk"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "flashcards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          max_flashcards: number
          max_saved_exams: number
          max_subjects: number
          plan: string
          updated_at: string
        }
        Insert: {
          max_flashcards: number
          max_saved_exams: number
          max_subjects: number
          plan: string
          updated_at?: string
        }
        Update: {
          max_flashcards?: number
          max_saved_exams?: number
          max_subjects?: number
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_catalog: {
        Row: {
          annual_price_cents: number
          benefits: string[]
          created_at: string
          currency: string
          description: string
          display_name: string
          display_order: number
          feature_permissions: Json
          monthly_price_cents: number
          plan: "free" | "pro"
          pricing_note: string
          updated_at: string
        }
        Insert: {
          annual_price_cents: number
          benefits: string[]
          created_at?: string
          currency?: string
          description: string
          display_name: string
          display_order: number
          feature_permissions: Json
          monthly_price_cents: number
          plan: "free" | "pro"
          pricing_note: string
          updated_at?: string
        }
        Update: {
          annual_price_cents?: number
          benefits?: string[]
          created_at?: string
          currency?: string
          description?: string
          display_name?: string
          display_order?: number
          feature_permissions?: Json
          monthly_price_cents?: number
          plan?: "free" | "pro"
          pricing_note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_catalog_plan_fkey"
            columns: ["plan"]
            isOneToOne: true
            referencedRelation: "plan_limits"
            referencedColumns: ["plan"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answered_count: number
          correct_count: number
          id: string
          quiz_id: string
          quiz_title: string
          score_percent: number
          submitted_at: string
          submission_answers: Json
          total_questions: number
          user_id: string
        }
        Insert: {
          answered_count?: number
          correct_count?: number
          id?: string
          quiz_id: string
          quiz_title: string
          score_percent?: number
          submitted_at?: string
          submission_answers: Json
          total_questions: number
          user_id?: string
        }
        Update: {
          answered_count?: number
          correct_count?: number
          id?: string
          quiz_id?: string
          quiz_title?: string
          score_percent?: number
          submitted_at?: string
          submission_answers?: Json
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_owner_fk"
            columns: ["quiz_id", "user_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          kind: "exam" | "mastery" | "custom"
          status: "active" | "completed"
          target_date: string | null
          title: string
          topic_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind: "exam" | "mastery" | "custom"
          status?: "active" | "completed"
          target_date?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: "exam" | "mastery" | "custom"
          status?: "active" | "completed"
          target_date?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_goals_topic_owner_fk"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "study_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          algorithm_version: string
          end_date: string
          generated_at: string
          id: string
          start_date: string
          status: "active" | "archived"
          summary: Json
          user_id: string
        }
        Insert: {
          algorithm_version?: string
          end_date: string
          generated_at?: string
          id?: string
          start_date: string
          status?: "active" | "archived"
          summary?: Json
          user_id?: string
        }
        Update: {
          algorithm_version?: string
          end_date?: string
          generated_at?: string
          id?: string
          start_date?: string
          status?: "active" | "archived"
          summary?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_interval: "monthly" | "annual"
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: "pro"
          provider: "stripe" | "mercado_pago" | "manual"
          provider_customer_ref: string | null
          provider_subscription_ref: string | null
          started_at: string | null
          status: "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "expired"
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval: "monthly" | "annual"
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: "pro"
          provider: "stripe" | "mercado_pago" | "manual"
          provider_customer_ref?: string | null
          provider_subscription_ref?: string | null
          started_at?: string | null
          status: "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "expired"
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: "monthly" | "annual"
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: "pro"
          provider?: "stripe" | "mercado_pago" | "manual"
          provider_customer_ref?: string | null
          provider_subscription_ref?: string | null
          started_at?: string | null
          status?: "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "expired"
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "plan_catalog"
            referencedColumns: ["plan"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_minutes: number
          goal_id: string | null
          id: string
          position: number
          priority_score: number
          recommendation_reason: string
          status: "scheduled" | "completed" | "replanned" | "skipped"
          study_plan_id: string
          task_date: string
          task_type: "study" | "review" | "practice"
          title: string
          topic_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_minutes: number
          goal_id?: string | null
          id?: string
          position: number
          priority_score: number
          recommendation_reason: string
          status?: "scheduled" | "completed" | "replanned" | "skipped"
          study_plan_id: string
          task_date: string
          task_type: "study" | "review" | "practice"
          title: string
          topic_id: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          goal_id?: string | null
          id?: string
          position?: number
          priority_score?: number
          recommendation_reason?: string
          status?: "scheduled" | "completed" | "replanned" | "skipped"
          study_plan_id?: string
          task_date?: string
          task_type?: "study" | "review" | "practice"
          title?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_tasks_goal_owner_fk"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "study_goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "planned_tasks_plan_owner_fk"
            columns: ["study_plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "planned_tasks_topic_owner_fk"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "planned_tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          finished_at: string | null
          id: string
          planned_minutes: number
          started_at: string
          status: "active" | "completed"
          topic_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          id?: string
          planned_minutes: number
          started_at?: string
          status?: "active" | "completed"
          topic_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          id?: string
          planned_minutes?: number
          started_at?: string
          status?: "active" | "completed"
          topic_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_topic_owner_fk"
            columns: ["topic_id", "user_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          created_at: string
          difficulty: number
          id: string
          name: string
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: number
          id?: string
          name: string
          subject_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          id?: string
          name?: string
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_subject_owner_fk"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "topics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          available_days: number[]
          created_at: string
          daily_available_minutes: number
          theme: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_days?: number[]
          created_at?: string
          daily_available_minutes?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_days?: number[]
          created_at?: string
          daily_available_minutes?: number
          theme?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_study_plan: {
        Args: { p_end_date: string; p_start_date: string; p_summary: Json; p_tasks: Json }
        Returns: string
      }
      load_quiz_editor: {
        Args: { p_quiz_id: string }
        Returns: Json
      }
      get_study_session_summary: {
        Args: Record<PropertyKey, never>
        Returns: { weekly_focus_seconds: number; weekly_session_count: number }[]
      }
      save_quiz: {
        Args: { p_description: string | null; p_questions: Json; p_quiz_id: string | null; p_title: string }
        Returns: string
      }
      submit_quiz_attempt: {
        Args: { p_answers: Json; p_quiz_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
