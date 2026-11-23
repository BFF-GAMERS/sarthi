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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_events: {
        Row: {
          actor_id: string | null
          application_id: string
          created_at: string
          from_state: Database["public"]["Enums"]["application_state"] | null
          id: string
          note: string | null
          to_state: Database["public"]["Enums"]["application_state"]
        }
        Insert: {
          actor_id?: string | null
          application_id: string
          created_at?: string
          from_state?: Database["public"]["Enums"]["application_state"] | null
          id?: string
          note?: string | null
          to_state: Database["public"]["Enums"]["application_state"]
        }
        Update: {
          actor_id?: string | null
          application_id?: string
          created_at?: string
          from_state?: Database["public"]["Enums"]["application_state"] | null
          id?: string
          note?: string | null
          to_state?: Database["public"]["Enums"]["application_state"]
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          cover_note: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          id: string
          match_breakdown: Json | null
          match_score: number | null
          opportunity_id: string
          passport_snapshot: Json | null
          profile_id: string
          resume_url: string | null
          state: Database["public"]["Enums"]["application_state"]
          state_changed_at: string
          submitted_at: string
          updated_at: string
          withdrawn_at: string | null
        }
        Insert: {
          cover_note?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          match_breakdown?: Json | null
          match_score?: number | null
          opportunity_id: string
          passport_snapshot?: Json | null
          profile_id: string
          resume_url?: string | null
          state?: Database["public"]["Enums"]["application_state"]
          state_changed_at?: string
          submitted_at?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Update: {
          cover_note?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          match_breakdown?: Json | null
          match_score?: number | null
          opportunity_id?: string
          passport_snapshot?: Json | null
          profile_id?: string
          resume_url?: string | null
          state?: Database["public"]["Enums"]["application_state"]
          state_changed_at?: string
          submitted_at?: string
          updated_at?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answer_keys: {
        Row: {
          answer: Json
          created_at: string
          question_id: string
        }
        Insert: {
          answer: Json
          created_at?: string
          question_id: string
        }
        Update: {
          answer?: Json
          created_at?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answer_keys_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts: {
        Row: {
          assessment_id: string
          created_at: string
          expires_at: string | null
          graded_at: string | null
          id: string
          passed: boolean | null
          profile_id: string
          score: number | null
          started_at: string
          state: Database["public"]["Enums"]["attempt_state"]
          submitted_at: string | null
        }
        Insert: {
          assessment_id: string
          created_at?: string
          expires_at?: string | null
          graded_at?: string | null
          id?: string
          passed?: boolean | null
          profile_id: string
          score?: number | null
          started_at?: string
          state?: Database["public"]["Enums"]["attempt_state"]
          submitted_at?: string | null
        }
        Update: {
          assessment_id?: string
          created_at?: string
          expires_at?: string | null
          graded_at?: string | null
          id?: string
          passed?: boolean | null
          profile_id?: string
          score?: number | null
          started_at?: string
          state?: Database["public"]["Enums"]["attempt_state"]
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          created_at: string
          difficulty: Database["public"]["Enums"]["skill_level"]
          explanation: string | null
          id: string
          kind: Database["public"]["Enums"]["question_kind"]
          options: Json
          points: number
          position: number
          prompt: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["skill_level"]
          explanation?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          options?: Json
          points?: number
          position: number
          prompt: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          difficulty?: Database["public"]["Enums"]["skill_level"]
          explanation?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["question_kind"]
          options?: Json
          points?: number
          position?: number
          prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_responses: {
        Row: {
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean | null
          points_awarded: number | null
          question_id: string
          response: Json
        }
        Insert: {
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id: string
          response: Json
        }
        Update: {
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          points_awarded?: number | null
          question_id?: string
          response?: Json
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          cooldown_hours: number
          course_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          max_attempts: number
          module_id: string | null
          pass_score: number
          skill_id: string
          target_level: Database["public"]["Enums"]["skill_level"]
          time_limit_minutes: number | null
          title: string
          updated_at: string
        }
        Insert: {
          cooldown_hours?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          max_attempts?: number
          module_id?: string | null
          pass_score?: number
          skill_id: string
          target_level?: Database["public"]["Enums"]["skill_level"]
          time_limit_minutes?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          cooldown_hours?: number
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          max_attempts?: number
          module_id?: string | null
          pass_score?: number
          skill_id?: string
          target_level?: Database["public"]["Enums"]["skill_level"]
          time_limit_minutes?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_submissions: {
        Row: {
          attachment_url: string | null
          body: string | null
          enrollment_id: string
          feedback: string | null
          grade: number | null
          graded_at: string | null
          graded_by: string | null
          id: string
          lesson_id: string
          submitted_at: string
        }
        Insert: {
          attachment_url?: string | null
          body?: string | null
          enrollment_id: string
          feedback?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          lesson_id: string
          submitted_at?: string
        }
        Update: {
          attachment_url?: string | null
          body?: string | null
          enrollment_id?: string
          feedback?: string | null
          grade?: number | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          lesson_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey"
            columns: ["graded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_submissions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: number
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: number
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: number
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          created_at: string
          end_minute: number
          id: string
          profile_id: string
          start_minute: number
          weekday: number
        }
        Insert: {
          created_at?: string
          end_minute: number
          id?: string
          profile_id: string
          start_minute: number
          weekday: number
        }
        Update: {
          created_at?: string
          end_minute?: number
          id?: string
          profile_id?: string
          start_minute?: number
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          created_at: string
          criteria: Json
          description: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          tier: string
        }
        Insert: {
          created_at?: string
          criteria: Json
          description: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          tier?: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          tier?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_goals: {
        Row: {
          created_at: string
          custom_title: string | null
          id: string
          motivation: string | null
          path_id: string | null
          profile_id: string
          state: Database["public"]["Enums"]["goal_state"]
          target_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_title?: string | null
          id?: string
          motivation?: string | null
          path_id?: string | null
          profile_id: string
          state?: Database["public"]["Enums"]["goal_state"]
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_title?: string | null
          id?: string
          motivation?: string | null
          path_id?: string | null
          profile_id?: string
          state?: Database["public"]["Enums"]["goal_state"]
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_goals_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "career_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_goals_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      career_path_skills: {
        Row: {
          path_id: string
          required_level: Database["public"]["Enums"]["skill_level"]
          skill_id: string
          stage: string
          weight: number
        }
        Insert: {
          path_id: string
          required_level?: Database["public"]["Enums"]["skill_level"]
          skill_id: string
          stage?: string
          weight?: number
        }
        Update: {
          path_id?: string
          required_level?: Database["public"]["Enums"]["skill_level"]
          skill_id?: string
          stage?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "career_path_skills_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "career_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_path_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      career_paths: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          slug: string
          summary: string | null
          title: string
          typical_titles: string[]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          slug: string
          summary?: string | null
          title: string
          typical_titles?: string[]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          slug?: string
          summary?: string | null
          title?: string
          typical_titles?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_paths_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      career_plan_items: {
        Row: {
          completed_at: string | null
          created_at: string
          goal_id: string
          id: string
          kind: Database["public"]["Enums"]["plan_item_kind"]
          position: number
          rationale: string | null
          ref_id: string | null
          skill_id: string | null
          state: Database["public"]["Enums"]["plan_item_state"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          goal_id: string
          id?: string
          kind: Database["public"]["Enums"]["plan_item_kind"]
          position?: number
          rationale?: string | null
          ref_id?: string | null
          skill_id?: string | null
          state?: Database["public"]["Enums"]["plan_item_state"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          goal_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["plan_item_kind"]
          position?: number
          rationale?: string | null
          ref_id?: string | null
          skill_id?: string | null
          state?: Database["public"]["Enums"]["plan_item_state"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_plan_items_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "career_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_plan_items_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_verifications: {
        Row: {
          certificate_id: string | null
          id: string
          serial_queried: string
          source: string
          verified_at: string
          was_found: boolean
          was_valid: boolean
        }
        Insert: {
          certificate_id?: string | null
          id?: string
          serial_queried: string
          source?: string
          verified_at?: string
          was_found: boolean
          was_valid: boolean
        }
        Update: {
          certificate_id?: string | null
          id?: string
          serial_queried?: string
          source?: string
          verified_at?: string
          was_found?: boolean
          was_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "certificate_verifications_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          assessment_id: string | null
          attempt_id: string | null
          course_id: string | null
          created_at: string
          enrollment_id: string | null
          expires_at: string | null
          id: string
          integrity_hash: string
          issued_at: string
          issuer: string
          profile_id: string
          recipient_name: string
          revoked_at: string | null
          revoked_reason: string | null
          score: number | null
          serial: string
          skill_id: string | null
          title: string
        }
        Insert: {
          assessment_id?: string | null
          attempt_id?: string | null
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string | null
          id?: string
          integrity_hash: string
          issued_at?: string
          issuer?: string
          profile_id: string
          recipient_name: string
          revoked_at?: string | null
          revoked_reason?: string | null
          score?: number | null
          serial: string
          skill_id?: string | null
          title: string
        }
        Update: {
          assessment_id?: string | null
          attempt_id?: string | null
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string | null
          id?: string
          integrity_hash?: string
          issued_at?: string
          issuer?: string
          profile_id?: string
          recipient_name?: string
          revoked_at?: string | null
          revoked_reason?: string | null
          score?: number | null
          serial?: string
          skill_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_feedback: {
        Row: {
          created_at: string
          helpful: boolean
          id: string
          kind: string
          note: string | null
          profile_id: string
        }
        Insert: {
          created_at?: string
          helpful: boolean
          id?: string
          kind: string
          note?: string | null
          profile_id: string
        }
        Update: {
          created_at?: string
          helpful?: boolean
          id?: string
          kind?: string
          note?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_feedback_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          hidden_at: string | null
          id: string
          is_accepted: boolean
          parent_id: string | null
          post_id: string
          score: number
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          is_accepted?: boolean
          parent_id?: string | null
          post_id: string
          score?: number
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          is_accepted?: boolean
          parent_id?: string | null
          post_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon: string | null
          id: string
          is_public: boolean
          member_count: number
          name: string
          post_count: number
          slug: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name: string
          post_count?: number
          slug: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name?: string
          post_count?: number
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "communities_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string
          profile_id: string
          role: string
        }
        Insert: {
          community_id: string
          joined_at?: string
          profile_id: string
          role?: string
        }
        Update: {
          community_id?: string
          joined_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          headquarters: string | null
          id: string
          industry: string | null
          is_platform: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          size_band: string | null
          slug: string
          tagline: string | null
          updated_at: string
          verified_at: string | null
          website_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          is_platform?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name: string
          size_band?: string | null
          slug: string
          tagline?: string | null
          updated_at?: string
          verified_at?: string | null
          website_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          headquarters?: string | null
          id?: string
          industry?: string | null
          is_platform?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          size_band?: string | null
          slug?: string
          tagline?: string | null
          updated_at?: string
          verified_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          profile_id: string
          role: string
        }
        Insert: {
          company_id: string
          created_at?: string
          profile_id: string
          role?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string
          name: string
          phone: string | null
          reason: string
          source_path: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          reason?: string
          source_path?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          reason?: string
          source_path?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          is_muted: boolean
          joined_at: string
          last_read_at: string
          left_at: string | null
          profile_id: string
        }
        Insert: {
          conversation_id: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          profile_id: string
        }
        Update: {
          conversation_id?: string
          is_muted?: boolean
          joined_at?: string
          last_read_at?: string
          left_at?: string | null
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at: string | null
          last_message_preview: string | null
          project_id: string | null
          swap_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          last_message_preview?: string | null
          project_id?: string | null
          swap_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          last_message_preview?: string | null
          project_id?: string | null
          swap_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_project_fk"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_swap_id_fkey"
            columns: ["swap_id"]
            isOneToOne: false
            referencedRelation: "skill_swaps"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          code: string
          discount_minor: number
          id: string
          profile_id: string
          redeemed_at: string
        }
        Insert: {
          code: string
          discount_minor: number
          id?: string
          profile_id: string
          redeemed_at?: string
        }
        Update: {
          code?: string
          discount_minor?: number
          id?: string
          profile_id?: string
          redeemed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "coupon_redemptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          amount_off_minor: number | null
          code: string
          created_at: string
          description: string | null
          expires_at: string | null
          is_active: boolean
          is_listed: boolean
          issued_to: string | null
          max_discount_minor: number | null
          max_per_profile: number
          max_redemptions: number | null
          min_spend_minor: number
          percent_off: number | null
          redemption_count: number
          source: string
          starts_at: string
        }
        Insert: {
          amount_off_minor?: number | null
          code: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          is_active?: boolean
          is_listed?: boolean
          issued_to?: string | null
          max_discount_minor?: number | null
          max_per_profile?: number
          max_redemptions?: number | null
          min_spend_minor?: number
          percent_off?: number | null
          redemption_count?: number
          source?: string
          starts_at?: string
        }
        Update: {
          amount_off_minor?: number | null
          code?: string
          created_at?: string
          description?: string | null
          expires_at?: string | null
          is_active?: boolean
          is_listed?: boolean
          issued_to?: string | null
          max_discount_minor?: number | null
          max_per_profile?: number
          max_redemptions?: number | null
          min_spend_minor?: number
          percent_off?: number | null
          redemption_count?: number
          source?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_issued_to_fkey"
            columns: ["issued_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          enrolled_at: string
          id: string
          last_activity_at: string
          lessons_completed: number
          payment_id: string | null
          profile_id: string
          progress_percent: number
          state: Database["public"]["Enums"]["enrollment_state"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          last_activity_at?: string
          lessons_completed?: number
          payment_id?: string | null
          profile_id: string
          progress_percent?: number
          state?: Database["public"]["Enums"]["enrollment_state"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          last_activity_at?: string
          lessons_completed?: number
          payment_id?: string | null
          profile_id?: string
          progress_percent?: number
          state?: Database["public"]["Enums"]["enrollment_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_payment_fk"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          position: number
          summary: string | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          position: number
          summary?: string | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          position?: number
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category_id: string
          city: string | null
          cover_url: string | null
          created_at: string
          creator_id: string | null
          currency: string
          description: string | null
          details: Json
          duration_minutes: number
          enrollment_count: number
          id: string
          is_free: boolean | null
          is_published: boolean
          level: Database["public"]["Enums"]["skill_level"]
          locale: string
          mode: string | null
          nsqf_level: number | null
          price_minor: number
          primary_skill_id: string | null
          published_at: string | null
          rating_avg: number | null
          rating_count: number
          region: string | null
          search_vector: unknown
          slug: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id: string
          city?: string | null
          cover_url?: string | null
          created_at?: string
          creator_id?: string | null
          currency?: string
          description?: string | null
          details?: Json
          duration_minutes?: number
          enrollment_count?: number
          id?: string
          is_free?: boolean | null
          is_published?: boolean
          level?: Database["public"]["Enums"]["skill_level"]
          locale?: string
          mode?: string | null
          nsqf_level?: number | null
          price_minor?: number
          primary_skill_id?: string | null
          published_at?: string | null
          rating_avg?: number | null
          rating_count?: number
          region?: string | null
          search_vector?: unknown
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          city?: string | null
          cover_url?: string | null
          created_at?: string
          creator_id?: string | null
          currency?: string
          description?: string | null
          details?: Json
          duration_minutes?: number
          enrollment_count?: number
          id?: string
          is_free?: boolean | null
          is_published?: boolean
          level?: Database["public"]["Enums"]["skill_level"]
          locale?: string
          mode?: string | null
          nsqf_level?: number | null
          price_minor?: number
          primary_skill_id?: string | null
          published_at?: string | null
          rating_avg?: number | null
          rating_count?: number
          region?: string | null
          search_vector?: unknown
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_primary_skill_id_fkey"
            columns: ["primary_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_earnings: {
        Row: {
          course_id: string | null
          created_at: string
          creator_id: string
          currency: string
          gross_minor: number
          id: string
          net_minor: number
          payment_id: string
          platform_fee_minor: number
          state: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          creator_id: string
          currency?: string
          gross_minor: number
          id?: string
          net_minor: number
          payment_id: string
          platform_fee_minor: number
          state?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          gross_minor?: number
          id?: string
          net_minor?: number
          payment_id?: string
          platform_fee_minor?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_earnings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_earnings_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_history: {
        Row: {
          at: string
          confidence: number
          created_at: string
          from_state: string
          id: string
          profile_id: string
          reason: string
          source: string
          to_state: string
        }
        Insert: {
          at?: string
          confidence?: number
          created_at?: string
          from_state: string
          id?: string
          profile_id: string
          reason: string
          source: string
          to_state: string
        }
        Update: {
          at?: string
          confidence?: number
          created_at?: string
          from_state?: string
          id?: string
          profile_id?: string
          reason?: string
          source?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_history_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_profiles: {
        Row: {
          action_counts: Json
          client_updated_at: string
          confidence: number
          domain_counts: Json
          locked: boolean
          meaningful_count: number
          mode: string
          profile_id: string
          scores: Json
          session_count: number
          state: string
          tier: number
          updated_at: string
        }
        Insert: {
          action_counts?: Json
          client_updated_at?: string
          confidence?: number
          domain_counts?: Json
          locked?: boolean
          meaningful_count?: number
          mode: string
          profile_id: string
          scores?: Json
          session_count?: number
          state: string
          tier?: number
          updated_at?: string
        }
        Update: {
          action_counts?: Json
          client_updated_at?: string
          confidence?: number
          domain_counts?: Json
          locked?: boolean
          meaningful_count?: number
          mode?: string
          profile_id?: string
          scores?: Json
          session_count?: number
          state?: string
          tier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          responded_at: string | null
          state: Database["public"]["Enums"]["follow_state"]
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          responded_at?: string | null
          state?: Database["public"]["Enums"]["follow_state"]
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          responded_at?: string | null
          state?: Database["public"]["Enums"]["follow_state"]
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          agenda: string | null
          application_id: string
          created_at: string
          duration_minutes: number
          id: string
          interviewer_id: string | null
          location: string | null
          mode: Database["public"]["Enums"]["work_mode"]
          outcome_note: string | null
          room_id: string
          scheduled_at: string | null
          state: Database["public"]["Enums"]["interview_state"]
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          application_id: string
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id?: string | null
          location?: string | null
          mode?: Database["public"]["Enums"]["work_mode"]
          outcome_note?: string | null
          room_id?: string
          scheduled_at?: string | null
          state?: Database["public"]["Enums"]["interview_state"]
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          application_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          interviewer_id?: string | null
          location?: string | null
          mode?: Database["public"]["Enums"]["work_mode"]
          outcome_note?: string | null
          room_id?: string
          scheduled_at?: string | null
          state?: Database["public"]["Enums"]["interview_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_alert_hits: {
        Row: {
          alert_id: string
          created_at: string
          opportunity_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          opportunity_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          opportunity_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_alert_hits_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "job_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_alerts: {
        Row: {
          city: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["opportunity_kind"] | null
          last_matched_at: string | null
          min_pay_minor: number | null
          profile_id: string
          skills: string[]
          work_mode: Database["public"]["Enums"]["work_mode"] | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          last_matched_at?: string | null
          min_pay_minor?: number | null
          profile_id: string
          skills?: string[]
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          last_matched_at?: string | null
          min_pay_minor?: number | null
          profile_id?: string
          skills?: string[]
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Relationships: [
          {
            foreignKeyName: "job_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      languages: {
        Row: {
          code: string
          direction: string
          is_interface_language: boolean
          name: string
          native_name: string
          sort_order: number
        }
        Insert: {
          code: string
          direction?: string
          is_interface_language?: boolean
          name: string
          native_name: string
          sort_order?: number
        }
        Update: {
          code?: string
          direction?: string
          is_interface_language?: boolean
          name?: string
          native_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      learning_preferences: {
        Row: {
          created_at: string
          formats: Database["public"]["Enums"]["learning_format"][]
          goal_statement: string | null
          in_person_ok: boolean
          max_travel_km: number | null
          pace: string
          profile_id: string
          session_minutes: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          formats?: Database["public"]["Enums"]["learning_format"][]
          goal_statement?: string | null
          in_person_ok?: boolean
          max_travel_km?: number | null
          pace?: string
          profile_id: string
          session_minutes?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          formats?: Database["public"]["Enums"]["learning_format"][]
          goal_statement?: string | null
          in_person_ok?: boolean
          max_travel_km?: number | null
          pace?: string
          profile_id?: string
          session_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_bookmarks: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_bookmarks_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_bookmarks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          body: string
          id: string
          lesson_id: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          body?: string
          id?: string
          lesson_id: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          lesson_id?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed_at: string | null
          enrollment_id: string
          id: string
          lesson_id: string
          seconds_spent: number
          state: Database["public"]["Enums"]["progress_state"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          enrollment_id: string
          id?: string
          lesson_id: string
          seconds_spent?: number
          state?: Database["public"]["Enums"]["progress_state"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          enrollment_id?: string
          id?: string
          lesson_id?: string
          seconds_spent?: number
          state?: Database["public"]["Enums"]["progress_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          assessment_id: string | null
          captions_url: string | null
          content: Json
          created_at: string
          duration_minutes: number
          id: string
          is_preview: boolean
          kind: Database["public"]["Enums"]["lesson_kind"]
          media_url: string | null
          module_id: string
          position: number
          title: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          assessment_id?: string | null
          captions_url?: string | null
          content?: Json
          created_at?: string
          duration_minutes?: number
          id?: string
          is_preview?: boolean
          kind?: Database["public"]["Enums"]["lesson_kind"]
          media_url?: string | null
          module_id: string
          position: number
          title: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string | null
          captions_url?: string | null
          content?: Json
          created_at?: string
          duration_minutes?: number
          id?: string
          is_preview?: boolean
          kind?: Database["public"]["Enums"]["lesson_kind"]
          media_url?: string | null
          module_id?: string
          position?: number
          title?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: Database["public"]["Enums"]["message_kind"]
          payload: Json | null
          reply_to_id: string | null
          sender_id: string | null
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          payload?: Json | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["message_kind"]
          payload?: Json | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          created_at: string
          expires_at: string | null
          id: string
          moderator_id: string
          note: string | null
          report_id: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_subject"]
        }
        Insert: {
          action: string
          created_at?: string
          expires_at?: string | null
          id?: string
          moderator_id: string
          note?: string | null
          report_id?: string | null
          target_id: string
          target_kind: Database["public"]["Enums"]["report_subject"]
        }
        Update: {
          action?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          moderator_id?: string
          note?: string | null
          report_id?: string | null
          target_id?: string
          target_kind?: Database["public"]["Enums"]["report_subject"]
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          data: Json
          entity_id: string | null
          entity_kind: string | null
          href: string | null
          id: string
          kind: string
          profile_id: string
          read_at: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_kind?: string | null
          href?: string | null
          id?: string
          kind: string
          profile_id: string
          read_at?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_kind?: string | null
          href?: string | null
          id?: string
          kind?: string
          profile_id?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          application_count: number
          apply_url: string | null
          application_deadline: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          currency: string
          description: string | null
          details: Json
          duration_weeks: number | null
          eligibility: string | null
          hours_per_week: number | null
          id: string
          is_paid: boolean
          is_published: boolean
          kind: Database["public"]["Enums"]["opportunity_kind"]
          location: string | null
          min_match_score: number
          openings: number
          posted_by: string | null
          published_at: string | null
          region: string | null
          responsibilities: string | null
          salary_max_minor: number | null
          salary_min_minor: number | null
          search_vector: unknown
          slug: string
          starts_on: string | null
          stipend_minor: number | null
          summary: string | null
          title: string
          updated_at: string
          work_mode: Database["public"]["Enums"]["work_mode"]
        }
        Insert: {
          application_count?: number
          apply_url?: string | null
          application_deadline?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          currency?: string
          description?: string | null
          details?: Json
          duration_weeks?: number | null
          eligibility?: string | null
          hours_per_week?: number | null
          id?: string
          is_paid?: boolean
          is_published?: boolean
          kind: Database["public"]["Enums"]["opportunity_kind"]
          location?: string | null
          min_match_score?: number
          openings?: number
          posted_by?: string | null
          published_at?: string | null
          region?: string | null
          responsibilities?: string | null
          salary_max_minor?: number | null
          salary_min_minor?: number | null
          search_vector?: unknown
          slug: string
          starts_on?: string | null
          stipend_minor?: number | null
          summary?: string | null
          title: string
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"]
        }
        Update: {
          application_count?: number
          apply_url?: string | null
          application_deadline?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          details?: Json
          duration_weeks?: number | null
          eligibility?: string | null
          hours_per_week?: number | null
          id?: string
          is_paid?: boolean
          is_published?: boolean
          kind?: Database["public"]["Enums"]["opportunity_kind"]
          location?: string | null
          min_match_score?: number
          openings?: number
          posted_by?: string | null
          published_at?: string | null
          region?: string | null
          responsibilities?: string | null
          salary_max_minor?: number | null
          salary_min_minor?: number | null
          search_vector?: unknown
          slug?: string
          starts_on?: string | null
          stipend_minor?: number | null
          summary?: string | null
          title?: string
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"]
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_skills: {
        Row: {
          is_required: boolean
          opportunity_id: string
          required_level: Database["public"]["Enums"]["skill_level"]
          skill_id: string
          weight: number
        }
        Insert: {
          is_required?: boolean
          opportunity_id: string
          required_level?: Database["public"]["Enums"]["skill_level"]
          skill_id: string
          weight?: number
        }
        Update: {
          is_required?: boolean
          opportunity_id?: string
          required_level?: Database["public"]["Enums"]["skill_level"]
          skill_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_skills_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "internships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_skills_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_skills_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      passport_views: {
        Row: {
          id: number
          profile_id: string
          source: string
          viewed_at: string
          viewer_company: string | null
          viewer_id: string | null
        }
        Insert: {
          id?: number
          profile_id: string
          source?: string
          viewed_at?: string
          viewer_company?: string | null
          viewer_id?: string | null
        }
        Update: {
          id?: number
          profile_id?: string
          source?: string
          viewed_at?: string
          viewer_company?: string | null
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "passport_views_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_views_viewer_company_fkey"
            columns: ["viewer_company"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passport_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          entity_id: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          meta: Json
          profile_id: string
          provider: string
          provider_ref: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          state: Database["public"]["Enums"]["payment_state"]
          updated_at: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          entity_id?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          meta?: Json
          profile_id: string
          provider: string
          provider_ref?: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          state?: Database["public"]["Enums"]["payment_state"]
          updated_at?: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          entity_id?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          meta?: Json
          profile_id?: string
          provider?: string
          provider_ref?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          state?: Database["public"]["Enums"]["payment_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          delta: number
          entity: string | null
          entity_id: string | null
          id: number
          profile_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          delta: number
          entity?: string | null
          entity_id?: string | null
          id?: number
          profile_id: string
          reason: string
        }
        Update: {
          created_at?: string
          delta?: number
          entity?: string | null
          entity_id?: string | null
          id?: number
          profile_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          accepted_answer_id: string | null
          author_id: string | null
          body: string | null
          comment_count: number
          community_id: string
          created_at: string
          hidden_at: string | null
          id: string
          is_locked: boolean
          is_pinned: boolean
          kind: Database["public"]["Enums"]["post_kind"]
          score: number
          search_vector: unknown
          skill_id: string | null
          tags: string[]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          accepted_answer_id?: string | null
          author_id?: string | null
          body?: string | null
          comment_count?: number
          community_id: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          kind?: Database["public"]["Enums"]["post_kind"]
          score?: number
          search_vector?: unknown
          skill_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          accepted_answer_id?: string | null
          author_id?: string | null
          body?: string | null
          comment_count?: number
          community_id?: string
          created_at?: string
          hidden_at?: string | null
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          kind?: Database["public"]["Enums"]["post_kind"]
          score?: number
          search_vector?: unknown
          skill_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_accepted_answer_fk"
            columns: ["accepted_answer_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_attempts: {
        Row: {
          attempts: number
          correct: number
          id: string
          lesson_id: string
          profile_id: string
          total: number
          updated_at: string
        }
        Insert: {
          attempts?: number
          correct?: number
          id?: string
          lesson_id: string
          profile_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          attempts?: number
          correct?: number
          id?: string
          lesson_id?: string
          profile_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_attempts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_privacy: {
        Row: {
          allow_messages_from_strangers: boolean
          created_at: string
          discoverable_by_companies: boolean
          profile_id: string
          show_activity: boolean
          show_courses: boolean
          show_languages: boolean
          show_projects: boolean
          show_region: boolean
          show_reviews: boolean
          show_skills: boolean
          updated_at: string
        }
        Insert: {
          allow_messages_from_strangers?: boolean
          created_at?: string
          discoverable_by_companies?: boolean
          profile_id: string
          show_activity?: boolean
          show_courses?: boolean
          show_languages?: boolean
          show_projects?: boolean
          show_region?: boolean
          show_reviews?: boolean
          show_skills?: boolean
          updated_at?: string
        }
        Update: {
          allow_messages_from_strangers?: boolean
          created_at?: string
          discoverable_by_companies?: boolean
          profile_id?: string
          show_activity?: boolean
          show_courses?: boolean
          show_languages?: boolean
          show_projects?: boolean
          show_region?: boolean
          show_reviews?: boolean
          show_skills?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_privacy_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country_code: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string
          handle: string
          headline: string | null
          id: string
          is_ai: boolean
          is_demo: boolean
          is_minor: boolean
          last_active_at: string
          onboarded_at: string | null
          onboarding_step: string
          profile_visibility: Database["public"]["Enums"]["visibility"]
          profile_type: string | null
          pronouns: string | null
          region: string | null
          timezone: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name: string
          handle: string
          headline?: string | null
          id: string
          is_ai?: boolean
          is_demo?: boolean
          is_minor?: boolean
          last_active_at?: string
          onboarded_at?: string | null
          onboarding_step?: string
          profile_visibility?: Database["public"]["Enums"]["visibility"]
          profile_type?: string | null
          pronouns?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country_code?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          handle?: string
          headline?: string | null
          id?: string
          is_ai?: boolean
          is_demo?: boolean
          is_minor?: boolean
          last_active_at?: string
          onboarded_at?: string | null
          onboarding_step?: string
          profile_visibility?: Database["public"]["Enums"]["visibility"]
          profile_type?: string | null
          pronouns?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          joined_at: string | null
          pitch: string | null
          profile_id: string
          project_id: string
          role: string
          state: Database["public"]["Enums"]["membership_state"]
        }
        Insert: {
          created_at?: string
          id?: string
          joined_at?: string | null
          pitch?: string | null
          profile_id: string
          project_id: string
          role?: string
          state?: Database["public"]["Enums"]["membership_state"]
        }
        Update: {
          created_at?: string
          id?: string
          joined_at?: string | null
          pitch?: string | null
          profile_id?: string
          project_id?: string
          role?: string
          state?: Database["public"]["Enums"]["membership_state"]
        }
        Relationships: [
          {
            foreignKeyName: "project_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_reviews: {
        Row: {
          created_at: string
          decision: Database["public"]["Enums"]["evidence_state"]
          feedback: string | null
          id: string
          rating: number
          reviewer_id: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          decision?: Database["public"]["Enums"]["evidence_state"]
          feedback?: string | null
          id?: string
          rating: number
          reviewer_id: string
          submission_id: string
        }
        Update: {
          created_at?: string
          decision?: Database["public"]["Enums"]["evidence_state"]
          feedback?: string | null
          id?: string
          rating?: number
          reviewer_id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "project_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_skills: {
        Row: {
          is_taught: boolean
          level: Database["public"]["Enums"]["skill_level"]
          project_id: string
          skill_id: string
        }
        Insert: {
          is_taught?: boolean
          level?: Database["public"]["Enums"]["skill_level"]
          project_id: string
          skill_id: string
        }
        Update: {
          is_taught?: boolean
          level?: Database["public"]["Enums"]["skill_level"]
          project_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_skills_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      project_submissions: {
        Row: {
          attachments: Json
          demo_url: string | null
          description: string | null
          id: string
          profile_id: string
          project_id: string
          repo_url: string | null
          state: Database["public"]["Enums"]["evidence_state"]
          submitted_at: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          demo_url?: string | null
          description?: string | null
          id?: string
          profile_id: string
          project_id: string
          repo_url?: string | null
          state?: Database["public"]["Enums"]["evidence_state"]
          submitted_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          demo_url?: string | null
          description?: string | null
          id?: string
          profile_id?: string
          project_id?: string
          repo_url?: string | null
          state?: Database["public"]["Enums"]["evidence_state"]
          submitted_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_submissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          category_id: string | null
          cover_url: string | null
          created_at: string
          deadline: string | null
          demo_url: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["skill_level"]
          estimated_hours: number | null
          id: string
          is_public: boolean
          max_members: number
          member_count: number
          owner_id: string
          repo_url: string | null
          search_vector: unknown
          slug: string
          state: Database["public"]["Enums"]["project_state"]
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          deadline?: string | null
          demo_url?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["skill_level"]
          estimated_hours?: number | null
          id?: string
          is_public?: boolean
          max_members?: number
          member_count?: number
          owner_id: string
          repo_url?: string | null
          search_vector?: unknown
          slug: string
          state?: Database["public"]["Enums"]["project_state"]
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          deadline?: string | null
          demo_url?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["skill_level"]
          estimated_hours?: number | null
          id?: string
          is_public?: boolean
          max_members?: number
          member_count?: number
          owner_id?: string
          repo_url?: string | null
          search_vector?: unknown
          slug?: string
          state?: Database["public"]["Enums"]["project_state"]
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          bucket: string
          created_at: string
          id: number
          profile_id: string | null
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: number
          profile_id?: string | null
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: number
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_limit_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          detail: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution: string | null
          state: Database["public"]["Enums"]["report_state"]
          subject_id: string
          subject_kind: Database["public"]["Enums"]["report_subject"]
          subject_owner_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          resolution?: string | null
          state?: Database["public"]["Enums"]["report_state"]
          subject_id: string
          subject_kind: Database["public"]["Enums"]["report_subject"]
          subject_owner_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          resolution?: string | null
          state?: Database["public"]["Enums"]["report_state"]
          subject_id?: string
          subject_kind?: Database["public"]["Enums"]["report_subject"]
          subject_owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_subject_owner_id_fkey"
            columns: ["subject_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reputation: {
        Row: {
          communication_avg: number | null
          no_show_count: number
          profile_id: string
          rating_avg: number | null
          rating_count: number
          reliability_avg: number | null
          reliability_score: number
          sessions_completed: number
          swaps_completed: number
          teaching_avg: number | null
          updated_at: string
        }
        Insert: {
          communication_avg?: number | null
          no_show_count?: number
          profile_id: string
          rating_avg?: number | null
          rating_count?: number
          reliability_avg?: number | null
          reliability_score?: number
          sessions_completed?: number
          swaps_completed?: number
          teaching_avg?: number | null
          updated_at?: string
        }
        Update: {
          communication_avg?: number | null
          no_show_count?: number
          profile_id?: string
          rating_avg?: number | null
          rating_count?: number
          reliability_avg?: number | null
          reliability_score?: number
          sessions_completed?: number
          swaps_completed?: number
          teaching_avg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reputation_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          communication: number | null
          created_at: string
          id: string
          is_public: boolean
          rating: number
          reliability: number | null
          reviewee_id: string
          reviewer_id: string
          session_id: string | null
          skill_id: string | null
          swap_id: string | null
          teaching_quality: number | null
          what_i_learned: string | null
        }
        Insert: {
          comment?: string | null
          communication?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          rating: number
          reliability?: number | null
          reviewee_id: string
          reviewer_id: string
          session_id?: string | null
          skill_id?: string | null
          swap_id?: string | null
          teaching_quality?: number | null
          what_i_learned?: string | null
        }
        Update: {
          comment?: string | null
          communication?: number | null
          created_at?: string
          id?: string
          is_public?: boolean
          rating?: number
          reliability?: number | null
          reviewee_id?: string
          reviewer_id?: string
          session_id?: string | null
          skill_id?: string | null
          swap_id?: string | null
          teaching_quality?: number | null
          what_i_learned?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_swap_id_fkey"
            columns: ["swap_id"]
            isOneToOne: false
            referencedRelation: "skill_swaps"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_offers: {
        Row: {
          amount_off_minor: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_discount_minor: number | null
          min_spend_minor: number
          percent_off: number | null
          points_cost: number
          slug: string
          sort_order: number
          title: string
          valid_days: number
        }
        Insert: {
          amount_off_minor?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_discount_minor?: number | null
          min_spend_minor?: number
          percent_off?: number | null
          points_cost: number
          slug: string
          sort_order?: number
          title: string
          valid_days?: number
        }
        Update: {
          amount_off_minor?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_discount_minor?: number | null
          min_spend_minor?: number
          percent_off?: number | null
          points_cost?: number
          slug?: string
          sort_order?: number
          title?: string
          valid_days?: number
        }
        Relationships: []
      }
      reward_wallets: {
        Row: {
          badge_count: number
          last_active_day: string | null
          level: number
          points_balance: number
          points_spent: number
          profile_id: string
          streak_days: number
          updated_at: string
          xp: number
        }
        Insert: {
          badge_count?: number
          last_active_day?: string | null
          level?: number
          points_balance?: number
          points_spent?: number
          profile_id: string
          streak_days?: number
          updated_at?: string
          xp?: number
        }
        Update: {
          badge_count?: number
          last_active_day?: string | null
          level?: number
          points_balance?: number
          points_spent?: number
          profile_id?: string
          streak_days?: number
          updated_at?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_wallets_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          profile_id: string
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          target_id: string
          target_kind: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          target_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendance: {
        Row: {
          joined_at: string | null
          left_at: string | null
          profile_id: string
          seconds_present: number
          session_id: string
        }
        Insert: {
          joined_at?: string | null
          left_at?: string | null
          profile_id: string
          seconds_present?: number
          session_id: string
        }
        Update: {
          joined_at?: string | null
          left_at?: string | null
          profile_id?: string
          seconds_present?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          agenda: string | null
          cancelled_by: string | null
          captions_enabled: boolean
          created_at: string
          duration_minutes: number
          ended_at: string | null
          format: Database["public"]["Enums"]["learning_format"]
          guest_id: string
          host_id: string
          id: string
          notes: string | null
          resources: Json
          room_id: string
          scheduled_start: string | null
          skill_id: string | null
          started_at: string | null
          state: Database["public"]["Enums"]["session_state"]
          swap_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          cancelled_by?: string | null
          captions_enabled?: boolean
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          format?: Database["public"]["Enums"]["learning_format"]
          guest_id: string
          host_id: string
          id?: string
          notes?: string | null
          resources?: Json
          room_id?: string
          scheduled_start?: string | null
          skill_id?: string | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["session_state"]
          swap_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          cancelled_by?: string | null
          captions_enabled?: boolean
          created_at?: string
          duration_minutes?: number
          ended_at?: string | null
          format?: Database["public"]["Enums"]["learning_format"]
          guest_id?: string
          host_id?: string
          id?: string
          notes?: string | null
          resources?: Json
          room_id?: string
          scheduled_start?: string | null
          skill_id?: string | null
          started_at?: string | null
          state?: Database["public"]["Enums"]["session_state"]
          swap_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_swap_id_fkey"
            columns: ["swap_id"]
            isOneToOne: false
            referencedRelation: "skill_swaps"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: number
          ip: string
          succeeded: boolean
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          ip: string
          succeeded?: boolean
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          ip?: string
          succeeded?: boolean
        }
        Relationships: []
      }
      skill_categories: {
        Row: {
          accent: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          accent?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          accent?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_evidence: {
        Row: {
          created_at: string
          detail: Json
          id: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          profile_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          skill_id: string
          source_id: string | null
          state: Database["public"]["Enums"]["evidence_state"]
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          kind: Database["public"]["Enums"]["evidence_kind"]
          profile_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill_id: string
          source_id?: string | null
          state?: Database["public"]["Enums"]["evidence_state"]
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          kind?: Database["public"]["Enums"]["evidence_kind"]
          profile_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          skill_id?: string
          source_id?: string | null
          state?: Database["public"]["Enums"]["evidence_state"]
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_evidence_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_evidence_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_evidence_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_passports: {
        Row: {
          created_at: string
          headline: string | null
          is_public: boolean
          profile_id: string
          published_at: string | null
          share_slug: string
          show_certificates: boolean
          show_courses: boolean
          show_experience: boolean
          show_projects: boolean
          show_reviews: boolean
          show_skills: boolean
          summary: string | null
          updated_at: string
          view_count: number
        }
        Insert: {
          created_at?: string
          headline?: string | null
          is_public?: boolean
          profile_id: string
          published_at?: string | null
          share_slug?: string
          show_certificates?: boolean
          show_courses?: boolean
          show_experience?: boolean
          show_projects?: boolean
          show_reviews?: boolean
          show_skills?: boolean
          summary?: string | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          created_at?: string
          headline?: string | null
          is_public?: boolean
          profile_id?: string
          published_at?: string | null
          share_slug?: string
          show_certificates?: boolean
          show_courses?: boolean
          show_experience?: boolean
          show_projects?: boolean
          show_reviews?: boolean
          show_skills?: boolean
          summary?: string | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_passports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_swaps: {
        Row: {
          cancel_reason: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          format: Database["public"]["Enums"]["learning_format"]
          id: string
          participant_a: string
          participant_b: string
          request_id: string | null
          sessions_completed: number
          sessions_planned: number
          skill_a_teaches: string | null
          skill_b_teaches: string
          started_at: string
          state: Database["public"]["Enums"]["swap_state"]
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["learning_format"]
          id?: string
          participant_a: string
          participant_b: string
          request_id?: string | null
          sessions_completed?: number
          sessions_planned?: number
          skill_a_teaches?: string | null
          skill_b_teaches: string
          started_at?: string
          state?: Database["public"]["Enums"]["swap_state"]
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          format?: Database["public"]["Enums"]["learning_format"]
          id?: string
          participant_a?: string
          participant_b?: string
          request_id?: string | null
          sessions_completed?: number
          sessions_planned?: number
          skill_a_teaches?: string | null
          skill_b_teaches?: string
          started_at?: string
          state?: Database["public"]["Enums"]["swap_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_swaps_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_swaps_participant_a_fkey"
            columns: ["participant_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_swaps_participant_b_fkey"
            columns: ["participant_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_swaps_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "swap_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_swaps_skill_a_teaches_fkey"
            columns: ["skill_a_teaches"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_swaps_skill_b_teaches_fkey"
            columns: ["skill_b_teaches"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          aliases: string[]
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_approved: boolean
          name: string
          search_vector: unknown
          slug: string
          suggested_by: string | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          aliases?: string[]
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          name: string
          search_vector?: unknown
          slug: string
          suggested_by?: string | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          aliases?: string[]
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          name?: string
          search_vector?: unknown
          slug?: string
          suggested_by?: string | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skills_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      swap_requests: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          match_breakdown: Json | null
          match_score: number | null
          message: string | null
          offered_skill_id: string | null
          proposed_format: Database["public"]["Enums"]["learning_format"]
          recipient_id: string
          requested_skill_id: string
          requester_id: string
          responded_at: string | null
          response_note: string | null
          state: Database["public"]["Enums"]["swap_request_state"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          match_breakdown?: Json | null
          match_score?: number | null
          message?: string | null
          offered_skill_id?: string | null
          proposed_format?: Database["public"]["Enums"]["learning_format"]
          recipient_id: string
          requested_skill_id: string
          requester_id: string
          responded_at?: string | null
          response_note?: string | null
          state?: Database["public"]["Enums"]["swap_request_state"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          match_breakdown?: Json | null
          match_score?: number | null
          message?: string | null
          offered_skill_id?: string | null
          proposed_format?: Database["public"]["Enums"]["learning_format"]
          recipient_id?: string
          requested_skill_id?: string
          requester_id?: string
          responded_at?: string | null
          response_note?: string | null
          state?: Database["public"]["Enums"]["swap_request_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "swap_requests_offered_skill_id_fkey"
            columns: ["offered_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_requested_skill_id_fkey"
            columns: ["requested_skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_completions: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          profile_id: string
          score: number | null
          state: string
          training_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          profile_id: string
          score?: number | null
          state?: string
          training_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          score?: number | null
          state?: string
          training_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_training_id_fkey"
            columns: ["training_id"]
            isOneToOne: false
            referencedRelation: "trainings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trainings: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          is_published: boolean
          position: number
          skill_id: string | null
          slug: string
          summary: string | null
          title: string
          track: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          id?: string
          is_published?: boolean
          position?: number
          skill_id?: string | null
          slug: string
          summary?: string | null
          title: string
          track?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          is_published?: boolean
          position?: number
          skill_id?: string | null
          slug?: string
          summary?: string | null
          title?: string
          track?: string
        }
        Relationships: [
          {
            foreignKeyName: "trainings_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          profile_id: string
          reason: string | null
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          profile_id: string
          reason?: string | null
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          profile_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_languages: {
        Row: {
          language_code: string
          proficiency: string
          profile_id: string
        }
        Insert: {
          language_code: string
          proficiency?: string
          profile_id: string
        }
        Update: {
          language_code?: string
          proficiency?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_languages_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_languages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          accessibility_mode: boolean
          captions_default: boolean
          communication_locales: string[]
          created_at: string
          dyslexia_font: boolean
          high_contrast: boolean
          interface_mode: Database["public"]["Enums"]["interface_mode"]
          keyboard_shortcuts: boolean
          locale: string
          profile_id: string
          reduced_motion: boolean
          screen_reader_hints: boolean
          swap_mode: string | null
          text_scale: number
          theme: string
          updated_at: string
          voice_navigation: boolean
        }
        Insert: {
          accessibility_mode?: boolean
          captions_default?: boolean
          communication_locales?: string[]
          created_at?: string
          dyslexia_font?: boolean
          high_contrast?: boolean
          interface_mode?: Database["public"]["Enums"]["interface_mode"]
          keyboard_shortcuts?: boolean
          locale?: string
          profile_id: string
          reduced_motion?: boolean
          screen_reader_hints?: boolean
          swap_mode?: string | null
          text_scale?: number
          theme?: string
          updated_at?: string
          voice_navigation?: boolean
        }
        Update: {
          accessibility_mode?: boolean
          captions_default?: boolean
          communication_locales?: string[]
          created_at?: string
          dyslexia_font?: boolean
          high_contrast?: boolean
          interface_mode?: Database["public"]["Enums"]["interface_mode"]
          keyboard_shortcuts?: boolean
          locale?: string
          profile_id?: string
          reduced_motion?: boolean
          screen_reader_hints?: boolean
          swap_mode?: string | null
          text_scale?: number
          theme?: string
          updated_at?: string
          voice_navigation?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_skills: {
        Row: {
          blurb: string | null
          can_teach: boolean
          created_at: string
          endorsement_count: number
          id: string
          level: Database["public"]["Enums"]["skill_level"]
          profile_id: string
          skill_id: string
          teaching_formats: Database["public"]["Enums"]["learning_format"][]
          updated_at: string
          verification_score: number | null
          verification_state: Database["public"]["Enums"]["verification_state"]
          verified_at: string | null
          years_experience: number | null
        }
        Insert: {
          blurb?: string | null
          can_teach?: boolean
          created_at?: string
          endorsement_count?: number
          id?: string
          level?: Database["public"]["Enums"]["skill_level"]
          profile_id: string
          skill_id: string
          teaching_formats?: Database["public"]["Enums"]["learning_format"][]
          updated_at?: string
          verification_score?: number | null
          verification_state?: Database["public"]["Enums"]["verification_state"]
          verified_at?: string | null
          years_experience?: number | null
        }
        Update: {
          blurb?: string | null
          can_teach?: boolean
          created_at?: string
          endorsement_count?: number
          id?: string
          level?: Database["public"]["Enums"]["skill_level"]
          profile_id?: string
          skill_id?: string
          teaching_formats?: Database["public"]["Enums"]["learning_format"][]
          updated_at?: string
          verification_score?: number | null
          verification_state?: Database["public"]["Enums"]["verification_state"]
          verified_at?: string | null
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decision_note: string | null
          id: string
          note: string | null
          profile_id: string
          reviewer_id: string | null
          skill_id: string
          state: Database["public"]["Enums"]["evidence_state"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          note?: string | null
          profile_id: string
          reviewer_id?: string | null
          skill_id: string
          state?: Database["public"]["Enums"]["evidence_state"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          note?: string | null
          profile_id?: string
          reviewer_id?: string | null
          skill_id?: string
          state?: Database["public"]["Enums"]["evidence_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verification_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verification_requests_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          profile_id: string
          target_id: string
          target_kind: Database["public"]["Enums"]["vote_target"]
          value: number
        }
        Insert: {
          created_at?: string
          profile_id: string
          target_id: string
          target_kind: Database["public"]["Enums"]["vote_target"]
          value: number
        }
        Update: {
          created_at?: string
          profile_id?: string
          target_id?: string
          target_kind?: Database["public"]["Enums"]["vote_target"]
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wanted_skills: {
        Row: {
          created_at: string
          current_level: Database["public"]["Enums"]["skill_level"]
          id: string
          motivation: string | null
          preferred_formats: Database["public"]["Enums"]["learning_format"][]
          priority: number
          profile_id: string
          skill_id: string
          target_level: Database["public"]["Enums"]["skill_level"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_level?: Database["public"]["Enums"]["skill_level"]
          id?: string
          motivation?: string | null
          preferred_formats?: Database["public"]["Enums"]["learning_format"][]
          priority?: number
          profile_id: string
          skill_id: string
          target_level?: Database["public"]["Enums"]["skill_level"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_level?: Database["public"]["Enums"]["skill_level"]
          id?: string
          motivation?: string | null
          preferred_formats?: Database["public"]["Enums"]["learning_format"][]
          priority?: number
          profile_id?: string
          skill_id?: string
          target_level?: Database["public"]["Enums"]["skill_level"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wanted_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wanted_skills_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      internships: {
        Row: {
          application_count: number | null
          application_deadline: string | null
          closed_at: string | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          duration_weeks: number | null
          eligibility: string | null
          hours_per_week: number | null
          id: string | null
          is_paid: boolean | null
          is_published: boolean | null
          kind: Database["public"]["Enums"]["opportunity_kind"] | null
          location: string | null
          min_match_score: number | null
          openings: number | null
          posted_by: string | null
          published_at: string | null
          responsibilities: string | null
          salary_max_minor: number | null
          salary_min_minor: number | null
          search_vector: unknown
          slug: string | null
          starts_on: string | null
          stipend_minor: number | null
          summary: string | null
          title: string | null
          updated_at: string | null
          work_mode: Database["public"]["Enums"]["work_mode"] | null
        }
        Insert: {
          application_count?: number | null
          application_deadline?: string | null
          closed_at?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          duration_weeks?: number | null
          eligibility?: string | null
          hours_per_week?: number | null
          id?: string | null
          is_paid?: boolean | null
          is_published?: boolean | null
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          location?: string | null
          min_match_score?: number | null
          openings?: number | null
          posted_by?: string | null
          published_at?: string | null
          responsibilities?: string | null
          salary_max_minor?: number | null
          salary_min_minor?: number | null
          search_vector?: unknown
          slug?: string | null
          starts_on?: string | null
          stipend_minor?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Update: {
          application_count?: number | null
          application_deadline?: string | null
          closed_at?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          duration_weeks?: number | null
          eligibility?: string | null
          hours_per_week?: number | null
          id?: string | null
          is_paid?: boolean | null
          is_published?: boolean | null
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          location?: string | null
          min_match_score?: number | null
          openings?: number | null
          posted_by?: string | null
          published_at?: string | null
          responsibilities?: string | null
          salary_max_minor?: number | null
          salary_min_minor?: number | null
          search_vector?: unknown
          slug?: string | null
          starts_on?: string | null
          stipend_minor?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          application_count: number | null
          application_deadline: string | null
          closed_at: string | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          duration_weeks: number | null
          eligibility: string | null
          hours_per_week: number | null
          id: string | null
          is_paid: boolean | null
          is_published: boolean | null
          kind: Database["public"]["Enums"]["opportunity_kind"] | null
          location: string | null
          min_match_score: number | null
          openings: number | null
          posted_by: string | null
          published_at: string | null
          responsibilities: string | null
          salary_max_minor: number | null
          salary_min_minor: number | null
          search_vector: unknown
          slug: string | null
          starts_on: string | null
          stipend_minor: number | null
          summary: string | null
          title: string | null
          updated_at: string | null
          work_mode: Database["public"]["Enums"]["work_mode"] | null
        }
        Insert: {
          application_count?: number | null
          application_deadline?: string | null
          closed_at?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          duration_weeks?: number | null
          eligibility?: string | null
          hours_per_week?: number | null
          id?: string | null
          is_paid?: boolean | null
          is_published?: boolean | null
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          location?: string | null
          min_match_score?: number | null
          openings?: number | null
          posted_by?: string | null
          published_at?: string | null
          responsibilities?: string | null
          salary_max_minor?: number | null
          salary_min_minor?: number | null
          search_vector?: unknown
          slug?: string | null
          starts_on?: string | null
          stipend_minor?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Update: {
          application_count?: number | null
          application_deadline?: string | null
          closed_at?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          duration_weeks?: number | null
          eligibility?: string | null
          hours_per_week?: number | null
          id?: string | null
          is_paid?: boolean | null
          is_published?: boolean | null
          kind?: Database["public"]["Enums"]["opportunity_kind"] | null
          location?: string | null
          min_match_score?: number | null
          openings?: number | null
          posted_by?: string | null
          published_at?: string | null
          responsibilities?: string | null
          salary_max_minor?: number | null
          salary_min_minor?: number | null
          search_vector?: unknown
          slug?: string | null
          starts_on?: string | null
          stipend_minor?: number | null
          summary?: string | null
          title?: string | null
          updated_at?: string | null
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_swap_request: {
        Args: { p_note?: string; p_request: string }
        Returns: {
          cancel_reason: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          format: Database["public"]["Enums"]["learning_format"]
          id: string
          participant_a: string
          participant_b: string
          request_id: string | null
          sessions_completed: number
          sessions_planned: number
          skill_a_teaches: string | null
          skill_b_teaches: string
          started_at: string
          state: Database["public"]["Enums"]["swap_state"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "skill_swaps"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_certify_skill: {
        Args: {
          p_master?: boolean
          p_note?: string
          p_profile: string
          p_skill: string
        }
        Returns: Json
      }
      admin_create_coupon: {
        Args: {
          p_amount_off_minor?: number
          p_code?: string
          p_description?: string
          p_is_listed?: boolean
          p_max_discount_minor?: number
          p_max_per_profile?: number
          p_max_redemptions?: number
          p_min_spend_minor?: number
          p_percent_off?: number
          p_valid_days?: number
        }
        Returns: Json
      }
      admin_delete_coupon: { Args: { p_code: string }; Returns: Json }
      admin_revoke_skill: {
        Args: { p_profile: string; p_skill: string }
        Returns: Json
      }
      admin_set_coupon_listed: {
        Args: { p_code: string; p_listed: boolean }
        Returns: undefined
      }
      analyse_career_gap: {
        Args: { p_path: string; p_profile: string }
        Returns: Json
      }
      assessment_standing: { Args: { p_assessment: string }; Returns: Json }
      audit: {
        Args: {
          p_action: string
          p_entity: string
          p_entity_id?: string
          p_meta?: Json
        }
        Returns: undefined
      }
      award_points: {
        Args: {
          p_delta: number
          p_entity?: string
          p_entity_id?: string
          p_profile: string
          p_reason: string
        }
        Returns: number
      }
      build_passport_snapshot: { Args: { p_profile: string }; Returns: Json }
      certificate_integrity_hash: {
        Args: {
          p_issued: string
          p_profile: string
          p_score: number
          p_serial: string
          p_title: string
        }
        Returns: string
      }
      claim_self_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      complete_onboarding: { Args: { p: Json }; Returns: Json }
      complete_session: {
        Args: { p_session: string }
        Returns: {
          agenda: string | null
          cancelled_by: string | null
          captions_enabled: boolean
          created_at: string
          duration_minutes: number
          ended_at: string | null
          format: Database["public"]["Enums"]["learning_format"]
          guest_id: string
          host_id: string
          id: string
          notes: string | null
          resources: Json
          room_id: string
          scheduled_start: string | null
          skill_id: string | null
          started_at: string | null
          state: Database["public"]["Enums"]["session_state"]
          swap_id: string | null
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      course_completion_state: {
        Args: { p_course_slug: string }
        Returns: Json
      }
      course_learning_state: { Args: { p_course_slug: string }; Returns: Json }
      create_demo_user: {
        Args: {
          p_display_name: string
          p_email: string
          p_handle: string
          p_password: string
        }
        Returns: string
      }
      decide_verification_request: {
        Args: {
          p_decision: Database["public"]["Enums"]["evidence_state"]
          p_note?: string
          p_request: string
        }
        Returns: Database["public"]["Enums"]["verification_state"]
      }
      drop_self_role: {
        Args: { p_role: Database["public"]["Enums"]["app_role"] }
        Returns: undefined
      }
      enroll_with_payment: {
        Args: {
          p_course_slug: string
          p_provider?: string
          p_provider_ref?: string
        }
        Returns: Json
      }
      evaluate_badges: { Args: { p_profile: string }; Returns: number }
      find_candidates_for_opportunity: {
        Args: { p_limit?: number; p_min_score?: number; p_opportunity: string }
        Returns: {
          breakdown: Json
          profile_id: string
          score: number
        }[]
      }
      find_opportunities_for_profile: {
        Args: {
          p_kind?: Database["public"]["Enums"]["opportunity_kind"]
          p_limit?: number
          p_min_score?: number
          p_profile?: string
        }
        Returns: {
          breakdown: Json
          opportunity_id: string
          score: number
        }[]
      }
      find_swap_matches: {
        Args: { p_limit?: number; p_min_score?: number; p_profile?: string }
        Returns: {
          breakdown: Json
          candidate_id: string
          is_mutual: boolean
          score: number
          they_teach_id: string
          you_teach_id: string
        }[]
      }
      find_trainers: {
        Args: { p_limit?: number; p_profile?: string; p_skill?: string }
        Returns: {
          breakdown: Json
          is_master: boolean
          is_mutual: boolean
          score: number
          skill_id: string
          trainer_id: string
        }[]
      }
      generate_career_plan: { Args: { p_goal: string }; Returns: number }
      generate_certificate_serial: { Args: never; Returns: string }
      generate_coupon_code: { Args: { p_prefix?: string }; Returns: string }
      get_shared_passport: {
        Args: { p_slug: string; p_source?: string }
        Returns: Json
      }
      grade_assessment_attempt: {
        Args: { p_attempt_id: string }
        Returns: {
          passed: boolean
          score: number
        }[]
      }
      handle_available: {
        Args: { p_handle: string }
        Returns: boolean
      }
      block_profile: {
        Args: { p_reason?: string; p_target: string }
        Returns: undefined
      }
      follow_counts: { Args: { p_profile: string }; Returns: Json }
      follow_list: { Args: { p_kind: string; p_profile: string }; Returns: Json }
      my_blocks: { Args: never; Returns: Json }
      pending_follow_requests: { Args: never; Returns: Json }
      profile_card: { Args: { p_handle: string }; Returns: Json }
      request_follow: {
        Args: { p_target: string }
        Returns: Database["public"]["Enums"]["follow_state"]
      }
      respond_to_follow: {
        Args: { p_accept: boolean; p_follower: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          target_role: Database["public"]["Enums"]["app_role"]
          who?: string
        }
        Returns: boolean
      }
      is_admin: { Args: { who?: string }; Returns: boolean }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_certified_in: {
        Args: { p_profile: string; p_skill: string }
        Returns: boolean
      }
      is_company_member: {
        Args: { p_company: string; who?: string }
        Returns: boolean
      }
      is_conversation_member: {
        Args: { p_conversation: string; who?: string }
        Returns: boolean
      }
      is_full_admin: { Args: { who?: string }; Returns: boolean }
      is_project_member: {
        Args: { p_project: string; who?: string }
        Returns: boolean
      }
      is_session_party: {
        Args: { p_session: string; who?: string }
        Returns: boolean
      }
      is_swap_participant: {
        Args: { p_swap: string; who?: string }
        Returns: boolean
      }
      issue_course_certificate: {
        Args: { p_enrollment: string }
        Returns: {
          assessment_id: string | null
          attempt_id: string | null
          course_id: string | null
          created_at: string
          enrollment_id: string | null
          expires_at: string | null
          id: string
          integrity_hash: string
          issued_at: string
          issuer: string
          profile_id: string
          recipient_name: string
          revoked_at: string | null
          revoked_reason: string | null
          score: number | null
          serial: string
          skill_id: string | null
          title: string
        }
        SetofOptions: {
          from: "*"
          to: "certificates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      learner_standing: { Args: { p_profile?: string }; Returns: Json }
      level_for_xp: { Args: { p_xp: number }; Returns: number }
      mark_conversation_read: {
        Args: { p_conversation: string }
        Returns: undefined
      }
      member_metrics: { Args: { p_profile?: string }; Returns: Json }
      notify: {
        Args: {
          p_actor?: string
          p_body?: string
          p_data?: Json
          p_entity_id?: string
          p_entity_kind?: string
          p_href?: string
          p_kind: string
          p_profile: string
          p_title: string
        }
        Returns: string
      }
      open_direct_conversation: { Args: { p_other: string }; Returns: string }
      platform_metrics: { Args: never; Returns: Json }
      price_coupon: {
        Args: { p_code: string; p_subtotal_minor: number }
        Returns: Json
      }
      profile_is_visible: { Args: { target: string }; Returns: boolean }
      prune_signup_attempts: { Args: never; Returns: undefined }
      purge_demo_accounts: { Args: never; Returns: number }
      recompute_course_progress: {
        Args: { p_enrollment: string }
        Returns: number
      }
      recompute_reputation: { Args: { p_profile: string }; Returns: undefined }
      recompute_skill_verification: {
        Args: { p_profile: string; p_skill: string }
        Returns: Database["public"]["Enums"]["verification_state"]
      }
      redeem_coupon: {
        Args: { p_code: string; p_discount_minor: number }
        Returns: undefined
      }
      redeem_reward: { Args: { p_offer: string }; Returns: Json }
      rotate_passport_link: { Args: never; Returns: string }
      score_profile_against_opportunity: {
        Args: { p_opportunity: string; p_profile: string }
        Returns: {
          breakdown: Json
          score: number
        }[]
      }
      seed_course_content: { Args: { p_curriculum: Json }; Returns: Json }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      skill_board: {
        Args: { p_limit?: number }
        Returns: {
          category: string
          courses: number
          id: string
          learners: number
          masters: number
          name: string
          slug: string
          trainers: number
        }[]
      }
      start_assessment_attempt: {
        Args: { p_assessment: string }
        Returns: {
          assessment_id: string
          created_at: string
          expires_at: string | null
          graded_at: string | null
          id: string
          passed: boolean | null
          profile_id: string
          score: number | null
          started_at: string
          state: Database["public"]["Enums"]["attempt_state"]
          submitted_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "assessment_attempts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_application: {
        Args: {
          p_cover_note?: string
          p_opportunity: string
          p_resume_url?: string
        }
        Returns: {
          cover_note: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          id: string
          match_breakdown: Json | null
          match_score: number | null
          opportunity_id: string
          passport_snapshot: Json | null
          profile_id: string
          resume_url: string | null
          state: Database["public"]["Enums"]["application_state"]
          state_changed_at: string
          submitted_at: string
          updated_at: string
          withdrawn_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      suggest_skill: {
        Args: { p_category?: string; p_name: string }
        Returns: {
          created: boolean
          id: string
          name: string
          slug: string
        }[]
      }
      universal_search: {
        Args: { p_kinds?: string[]; p_limit?: number; p_query: string }
        Returns: {
          href: string
          id: string
          kind: string
          meta: Json
          rank: number
          subtitle: string
          title: string
        }[]
      }
      verify_certificate: {
        Args: { p_serial: string }
        Returns: {
          found: boolean
          issued_at: string
          issuer: string
          reason: string
          recipient_name: string
          score: number
          serial: string
          skill_name: string
          title: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      follow_state: "pending" | "accepted"
      app_role:
        | "student"
        | "professional"
        | "mentor"
        | "course_creator"
        | "career_consultant"
        | "company_member"
        | "moderator"
        | "admin"
        | "biggerr"
        | "trainer"
        | "master_trainer"
      application_state:
        | "draft"
        | "submitted"
        | "under_review"
        | "shortlisted"
        | "interviewing"
        | "offered"
        | "hired"
        | "rejected"
        | "withdrawn"
      attempt_state:
        | "in_progress"
        | "submitted"
        | "graded"
        | "abandoned"
        | "expired"
      conversation_kind: "direct" | "swap" | "session" | "project" | "support"
      enrollment_state: "active" | "completed" | "cancelled" | "refunded"
      evidence_kind:
        | "assessment"
        | "course_completion"
        | "project"
        | "mentor_endorsement"
        | "internship"
        | "external_credential"
        | "admin_grant"
      evidence_state: "pending" | "accepted" | "rejected"
      goal_state: "active" | "achieved" | "paused" | "abandoned"
      interface_mode: "genz" | "millennial"
      interview_state:
        | "proposed"
        | "scheduled"
        | "completed"
        | "cancelled"
        | "no_show"
      learning_format: "chat" | "video" | "project" | "self_paced" | "in_person"
      lesson_kind:
        | "text"
        | "video"
        | "document"
        | "quiz"
        | "assignment"
        | "external"
        | "practice"
      membership_state: "applied" | "accepted" | "declined" | "left" | "removed"
      message_kind: "text" | "system" | "proposal" | "attachment"
      opportunity_kind: "internship" | "job"
      payment_purpose: "course" | "mentorship" | "certificate" | "subscription"
      payment_state:
        | "created"
        | "requires_action"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
        | "cancelled"
      plan_item_kind:
        | "skill"
        | "course"
        | "assessment"
        | "project"
        | "internship"
        | "job"
        | "session"
      plan_item_state: "todo" | "in_progress" | "done" | "skipped"
      post_kind:
        | "discussion"
        | "question"
        | "resource"
        | "showcase"
        | "challenge"
      progress_state: "not_started" | "in_progress" | "completed"
      project_state: "open" | "in_progress" | "completed" | "archived"
      question_kind:
        | "single_choice"
        | "multi_choice"
        | "true_false"
        | "short_text"
      report_state: "open" | "reviewing" | "actioned" | "dismissed"
      report_subject:
        | "profile"
        | "message"
        | "post"
        | "comment"
        | "course"
        | "project"
        | "company"
        | "session"
      session_state:
        | "proposed"
        | "scheduled"
        | "live"
        | "completed"
        | "cancelled"
        | "no_show"
      skill_level: "beginner" | "intermediate" | "advanced" | "expert"
      swap_request_state:
        | "pending"
        | "accepted"
        | "declined"
        | "withdrawn"
        | "expired"
      swap_state: "active" | "completed" | "cancelled"
      verification_state:
        | "self_declared"
        | "evidence_submitted"
        | "assessed"
        | "verified"
        | "expert_verified"
        | "revoked"
      visibility: "public" | "connections" | "private"
      vote_target: "post" | "comment"
      work_mode: "remote" | "hybrid" | "onsite"
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
    Enums: {
      app_role: [
        "student",
        "professional",
        "mentor",
        "course_creator",
        "career_consultant",
        "company_member",
        "moderator",
        "admin",
        "biggerr",
        "trainer",
        "master_trainer",
      ],
      application_state: [
        "draft",
        "submitted",
        "under_review",
        "shortlisted",
        "interviewing",
        "offered",
        "hired",
        "rejected",
        "withdrawn",
      ],
      attempt_state: [
        "in_progress",
        "submitted",
        "graded",
        "abandoned",
        "expired",
      ],
      conversation_kind: ["direct", "swap", "session", "project", "support"],
      enrollment_state: ["active", "completed", "cancelled", "refunded"],
      evidence_kind: [
        "assessment",
        "course_completion",
        "project",
        "mentor_endorsement",
        "internship",
        "external_credential",
        "admin_grant",
      ],
      evidence_state: ["pending", "accepted", "rejected"],
      goal_state: ["active", "achieved", "paused", "abandoned"],
      interface_mode: ["genz", "millennial"],
      interview_state: [
        "proposed",
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
      ],
      learning_format: ["chat", "video", "project", "self_paced", "in_person"],
      lesson_kind: [
        "text",
        "video",
        "document",
        "quiz",
        "assignment",
        "external",
        "practice",
      ],
      membership_state: ["applied", "accepted", "declined", "left", "removed"],
      message_kind: ["text", "system", "proposal", "attachment"],
      opportunity_kind: ["internship", "job"],
      payment_purpose: ["course", "mentorship", "certificate", "subscription"],
      payment_state: [
        "created",
        "requires_action",
        "processing",
        "succeeded",
        "failed",
        "refunded",
        "cancelled",
      ],
      plan_item_kind: [
        "skill",
        "course",
        "assessment",
        "project",
        "internship",
        "job",
        "session",
      ],
      plan_item_state: ["todo", "in_progress", "done", "skipped"],
      post_kind: [
        "discussion",
        "question",
        "resource",
        "showcase",
        "challenge",
      ],
      progress_state: ["not_started", "in_progress", "completed"],
      project_state: ["open", "in_progress", "completed", "archived"],
      question_kind: [
        "single_choice",
        "multi_choice",
        "true_false",
        "short_text",
      ],
      report_state: ["open", "reviewing", "actioned", "dismissed"],
      report_subject: [
        "profile",
        "message",
        "post",
        "comment",
        "course",
        "project",
        "company",
        "session",
      ],
      session_state: [
        "proposed",
        "scheduled",
        "live",
        "completed",
        "cancelled",
        "no_show",
      ],
      skill_level: ["beginner", "intermediate", "advanced", "expert"],
      swap_request_state: [
        "pending",
        "accepted",
        "declined",
        "withdrawn",
        "expired",
      ],
      swap_state: ["active", "completed", "cancelled"],
      verification_state: [
        "self_declared",
        "evidence_submitted",
        "assessed",
        "verified",
        "expert_verified",
        "revoked",
      ],
      visibility: ["public", "connections", "private"],
      vote_target: ["post", "comment"],
      work_mode: ["remote", "hybrid", "onsite"],
    },
  },
} as const
