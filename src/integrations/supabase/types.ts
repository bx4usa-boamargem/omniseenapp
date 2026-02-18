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
      activity_structure_templates: {
        Row: {
          activity_slug: string
          created_at: string | null
          display_name: string
          generation_prompt: string
          id: string
          required_sections: Json
          structure_type: string
          updated_at: string | null
          validation_rules: Json
        }
        Insert: {
          activity_slug: string
          created_at?: string | null
          display_name: string
          generation_prompt: string
          id?: string
          required_sections?: Json
          structure_type: string
          updated_at?: string | null
          validation_rules?: Json
        }
        Update: {
          activity_slug?: string
          created_at?: string | null
          display_name?: string
          generation_prompt?: string
          id?: string
          required_sections?: Json
          structure_type?: string
          updated_at?: string | null
          validation_rules?: Json
        }
        Relationships: []
      }
      admin_alert_history: {
        Row: {
          actual_cost: number
          alert_id: string | null
          id: string
          message: string | null
          threshold_cost: number
          triggered_at: string | null
        }
        Insert: {
          actual_cost: number
          alert_id?: string | null
          id?: string
          message?: string | null
          threshold_cost: number
          triggered_at?: string | null
        }
        Update: {
          actual_cost?: number
          alert_id?: string | null
          id?: string
          message?: string | null
          threshold_cost?: number
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "admin_cost_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_cost_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          notification_email: string | null
          threshold_usd: number
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          notification_email?: string | null
          threshold_usd: number
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          notification_email?: string | null
          threshold_usd?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_goals: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          goal_type: string
          id: string
          is_active: boolean | null
          period_end: string
          period_start: string
          period_type: string
          target_value: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          goal_type: string
          id?: string
          is_active?: boolean | null
          period_end: string
          period_start: string
          period_type: string
          target_value: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          goal_type?: string
          id?: string
          is_active?: boolean | null
          period_end?: string
          period_start?: string
          period_type?: string
          target_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      admin_health_alert_history: {
        Row: {
          alert_id: string | null
          current_value: number | null
          id: string
          message: string | null
          resolved_at: string | null
          resolved_by: string | null
          tenant_id: string | null
          triggered_at: string | null
        }
        Insert: {
          alert_id?: string | null
          current_value?: number | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string | null
          triggered_at?: string | null
        }
        Update: {
          alert_id?: string | null
          current_value?: number | null
          id?: string
          message?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          tenant_id?: string | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_health_alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "admin_health_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_health_alert_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_health_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          notification_email: string | null
          threshold_unit: string | null
          threshold_value: number
          updated_at: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notification_email?: string | null
          threshold_unit?: string | null
          threshold_value: number
          updated_at?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          notification_email?: string | null
          threshold_unit?: string | null
          threshold_value?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_content_cache: {
        Row: {
          blog_id: string | null
          cache_type: string
          content_hash: string
          cost_saved_usd: number | null
          created_at: string | null
          expires_at: string | null
          hits: number | null
          id: string
          model_used: string | null
          prompt_text: string | null
          response_data: Json
          tokens_saved: number | null
          user_id: string | null
        }
        Insert: {
          blog_id?: string | null
          cache_type: string
          content_hash: string
          cost_saved_usd?: number | null
          created_at?: string | null
          expires_at?: string | null
          hits?: number | null
          id?: string
          model_used?: string | null
          prompt_text?: string | null
          response_data: Json
          tokens_saved?: number | null
          user_id?: string | null
        }
        Update: {
          blog_id?: string | null
          cache_type?: string
          content_hash?: string
          cost_saved_usd?: number | null
          created_at?: string | null
          expires_at?: string | null
          hits?: number | null
          id?: string
          model_used?: string | null
          prompt_text?: string | null
          response_data?: Json
          tokens_saved?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_content_cache_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          blog_id: string | null
          cost_usd: number
          country: string | null
          created_at: string | null
          endpoint: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider: string
          success: boolean | null
          tokens_used: number | null
        }
        Insert: {
          blog_id?: string | null
          cost_usd?: number
          country?: string | null
          created_at?: string | null
          endpoint: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider: string
          success?: boolean | null
          tokens_used?: number | null
        }
        Update: {
          blog_id?: string | null
          cost_usd?: number
          country?: string | null
          created_at?: string | null
          endpoint?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider?: string
          success?: boolean | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      article_analytics: {
        Row: {
          article_id: string
          blog_id: string
          browser: string | null
          country: string | null
          created_at: string
          device: string | null
          id: string
          read_percentage: number | null
          scroll_depth: number | null
          scroll_positions: Json | null
          session_id: string
          source: string | null
          time_on_page: number | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          article_id: string
          blog_id: string
          browser?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          read_percentage?: number | null
          scroll_depth?: number | null
          scroll_positions?: Json | null
          session_id: string
          source?: string | null
          time_on_page?: number | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          article_id?: string
          blog_id?: string
          browser?: string | null
          country?: string | null
          created_at?: string
          device?: string | null
          id?: string
          read_percentage?: number | null
          scroll_depth?: number | null
          scroll_positions?: Json | null
          session_id?: string
          source?: string | null
          time_on_page?: number | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_analytics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_analytics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "article_analytics_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      article_broken_links: {
        Row: {
          anchor_text: string | null
          article_id: string
          blog_id: string
          created_at: string | null
          detected_at: string | null
          error_message: string | null
          fix_method: string | null
          fixed_at: string | null
          id: string
          is_fixed: boolean | null
          last_checked_at: string | null
          status_code: number | null
          url: string
        }
        Insert: {
          anchor_text?: string | null
          article_id: string
          blog_id: string
          created_at?: string | null
          detected_at?: string | null
          error_message?: string | null
          fix_method?: string | null
          fixed_at?: string | null
          id?: string
          is_fixed?: boolean | null
          last_checked_at?: string | null
          status_code?: number | null
          url: string
        }
        Update: {
          anchor_text?: string | null
          article_id?: string
          blog_id?: string
          created_at?: string | null
          detected_at?: string | null
          error_message?: string | null
          fix_method?: string | null
          fixed_at?: string | null
          id?: string
          is_fixed?: boolean | null
          last_checked_at?: string | null
          status_code?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_broken_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_broken_links_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      article_content_scores: {
        Row: {
          article_id: string | null
          breakdown: Json
          calculated_at: string | null
          comparison: Json
          content_version: number | null
          created_at: string | null
          h2_count: number | null
          id: string
          image_count: number | null
          meets_market_standards: boolean | null
          paragraph_count: number | null
          recommendations: Json | null
          semantic_coverage: number | null
          serp_analysis_id: string | null
          total_score: number
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          article_id?: string | null
          breakdown?: Json
          calculated_at?: string | null
          comparison?: Json
          content_version?: number | null
          created_at?: string | null
          h2_count?: number | null
          id?: string
          image_count?: number | null
          meets_market_standards?: boolean | null
          paragraph_count?: number | null
          recommendations?: Json | null
          semantic_coverage?: number | null
          serp_analysis_id?: string | null
          total_score: number
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          article_id?: string | null
          breakdown?: Json
          calculated_at?: string | null
          comparison?: Json
          content_version?: number | null
          created_at?: string | null
          h2_count?: number | null
          id?: string
          image_count?: number | null
          meets_market_standards?: boolean | null
          paragraph_count?: number | null
          recommendations?: Json | null
          semantic_coverage?: number | null
          serp_analysis_id?: string | null
          total_score?: number
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "article_content_scores_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_content_scores_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: true
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "article_content_scores_serp_analysis_id_fkey"
            columns: ["serp_analysis_id"]
            isOneToOne: false
            referencedRelation: "serp_analysis_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      article_conversion_metrics: {
        Row: {
          article_id: string
          blog_id: string
          conversion_intent_count: number | null
          conversion_visibility_count: number | null
          created_at: string | null
          date: string
          id: string
          intent_value: number | null
          reads_total: number | null
          total_value: number | null
          updated_at: string | null
          views_total: number | null
          visibility_value: number | null
        }
        Insert: {
          article_id: string
          blog_id: string
          conversion_intent_count?: number | null
          conversion_visibility_count?: number | null
          created_at?: string | null
          date?: string
          id?: string
          intent_value?: number | null
          reads_total?: number | null
          total_value?: number | null
          updated_at?: string | null
          views_total?: number | null
          visibility_value?: number | null
        }
        Update: {
          article_id?: string
          blog_id?: string
          conversion_intent_count?: number | null
          conversion_visibility_count?: number | null
          created_at?: string | null
          date?: string
          id?: string
          intent_value?: number | null
          reads_total?: number | null
          total_value?: number | null
          updated_at?: string | null
          views_total?: number | null
          visibility_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "article_conversion_metrics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_conversion_metrics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "article_conversion_metrics_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      article_internal_links: {
        Row: {
          anchor_text: string
          id: string
          inserted_at: string | null
          source_article_id: string
          target_article_id: string
        }
        Insert: {
          anchor_text: string
          id?: string
          inserted_at?: string | null
          source_article_id: string
          target_article_id: string
        }
        Update: {
          anchor_text?: string
          id?: string
          inserted_at?: string | null
          source_article_id?: string
          target_article_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_internal_links_source_article_id_fkey"
            columns: ["source_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_internal_links_source_article_id_fkey"
            columns: ["source_article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "article_internal_links_target_article_id_fkey"
            columns: ["target_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_internal_links_target_article_id_fkey"
            columns: ["target_article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      article_opportunities: {
        Row: {
          blog_id: string
          competitor_id: string | null
          competitor_name: string | null
          converted_article_id: string | null
          converted_at: string | null
          created_at: string | null
          funnel_stage: string | null
          goal: string | null
          high_score_alert_sent: boolean | null
          id: string
          intel_week_id: string | null
          origin: string | null
          performance_boost: number | null
          relevance_factors: Json | null
          relevance_score: number | null
          source: string | null
          source_urls: string[] | null
          status: string | null
          suggested_keywords: string[] | null
          suggested_outline: Json | null
          suggested_title: string
          territory_id: string | null
          trend_source: string | null
          updated_at: string | null
          why_now: string | null
        }
        Insert: {
          blog_id: string
          competitor_id?: string | null
          competitor_name?: string | null
          converted_article_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          funnel_stage?: string | null
          goal?: string | null
          high_score_alert_sent?: boolean | null
          id?: string
          intel_week_id?: string | null
          origin?: string | null
          performance_boost?: number | null
          relevance_factors?: Json | null
          relevance_score?: number | null
          source?: string | null
          source_urls?: string[] | null
          status?: string | null
          suggested_keywords?: string[] | null
          suggested_outline?: Json | null
          suggested_title: string
          territory_id?: string | null
          trend_source?: string | null
          updated_at?: string | null
          why_now?: string | null
        }
        Update: {
          blog_id?: string
          competitor_id?: string | null
          competitor_name?: string | null
          converted_article_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          funnel_stage?: string | null
          goal?: string | null
          high_score_alert_sent?: boolean | null
          id?: string
          intel_week_id?: string | null
          origin?: string | null
          performance_boost?: number | null
          relevance_factors?: Json | null
          relevance_score?: number | null
          source?: string | null
          source_urls?: string[] | null
          status?: string | null
          suggested_keywords?: string[] | null
          suggested_outline?: Json | null
          suggested_title?: string
          territory_id?: string | null
          trend_source?: string | null
          updated_at?: string | null
          why_now?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_opportunities_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_opportunities_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_opportunities_converted_article_id_fkey"
            columns: ["converted_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_opportunities_converted_article_id_fkey"
            columns: ["converted_article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "article_opportunities_intel_week_id_fkey"
            columns: ["intel_week_id"]
            isOneToOne: false
            referencedRelation: "market_intel_weekly"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_opportunities_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      article_queue: {
        Row: {
          article_goal: string | null
          article_id: string | null
          blog_id: string
          chunk_content: string | null
          created_at: string | null
          error_message: string | null
          funnel_mode: string | null
          funnel_stage: string | null
          generation_source: string | null
          id: string
          keywords: string[] | null
          persona_id: string | null
          scheduled_for: string | null
          status: string | null
          suggested_theme: string
          updated_at: string | null
        }
        Insert: {
          article_goal?: string | null
          article_id?: string | null
          blog_id: string
          chunk_content?: string | null
          created_at?: string | null
          error_message?: string | null
          funnel_mode?: string | null
          funnel_stage?: string | null
          generation_source?: string | null
          id?: string
          keywords?: string[] | null
          persona_id?: string | null
          scheduled_for?: string | null
          status?: string | null
          suggested_theme: string
          updated_at?: string | null
        }
        Update: {
          article_goal?: string | null
          article_id?: string | null
          blog_id?: string
          chunk_content?: string | null
          created_at?: string | null
          error_message?: string | null
          funnel_mode?: string | null
          funnel_stage?: string | null
          generation_source?: string | null
          id?: string
          keywords?: string[] | null
          persona_id?: string | null
          scheduled_for?: string | null
          status?: string | null
          suggested_theme?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_queue_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_queue_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "article_queue_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_queue_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      article_revisions: {
        Row: {
          article_id: string
          created_at: string | null
          field_changed: string
          id: string
          new_value: string | null
          optimization_type: string | null
          original_value: string | null
          score_after: number | null
          score_before: number | null
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          optimization_type?: string | null
          original_value?: string | null
          score_after?: number | null
          score_before?: number | null
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          optimization_type?: string | null
          original_value?: string | null
          score_after?: number | null
          score_before?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_revisions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      article_translations: {
        Row: {
          article_id: string
          content: string | null
          created_at: string | null
          excerpt: string | null
          faq: Json | null
          id: string
          is_reviewed: boolean | null
          language_code: string
          meta_description: string | null
          title: string
          translated_at: string | null
          translated_by: string | null
          updated_at: string | null
        }
        Insert: {
          article_id: string
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          faq?: Json | null
          id?: string
          is_reviewed?: boolean | null
          language_code: string
          meta_description?: string | null
          title: string
          translated_at?: string | null
          translated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          article_id?: string
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          faq?: Json | null
          id?: string
          is_reviewed?: boolean | null
          language_code?: string
          meta_description?: string | null
          title?: string
          translated_at?: string | null
          translated_by?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "article_translations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_translations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      article_versions: {
        Row: {
          article_id: string
          change_description: string | null
          change_reason: string | null
          change_source: string | null
          change_type: string
          changed_by: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          excerpt: string | null
          faq: Json | null
          id: string
          keywords: string[] | null
          layer_type: string | null
          meta_description: string | null
          score_at_save: number | null
          title: string
          version_number: number
          word_count: number | null
        }
        Insert: {
          article_id: string
          change_description?: string | null
          change_reason?: string | null
          change_source?: string | null
          change_type: string
          changed_by?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          faq?: Json | null
          id?: string
          keywords?: string[] | null
          layer_type?: string | null
          meta_description?: string | null
          score_at_save?: number | null
          title: string
          version_number?: number
          word_count?: number | null
        }
        Update: {
          article_id?: string
          change_description?: string | null
          change_reason?: string | null
          change_source?: string | null
          change_type?: string
          changed_by?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          faq?: Json | null
          id?: string
          keywords?: string[] | null
          layer_type?: string | null
          meta_description?: string | null
          score_at_save?: number | null
          title?: string
          version_number?: number
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      articles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          article_goal: string | null
          article_structure_type: string | null
          blog_id: string
          category: string | null
          content: string | null
          content_hash: string | null
          content_images: Json | null
          content_version: number | null
          conversion_intent_count: number | null
          conversion_visibility_count: number | null
          created_at: string
          cta: Json | null
          excerpt: string | null
          external_post_id: string | null
          external_post_url: string | null
          faq: Json | null
          featured_image_alt: string | null
          featured_image_url: string | null
          funnel_mode: string | null
          funnel_stage: string | null
          generation_progress: number | null
          generation_source: string | null
          generation_stage: string | null
          highlights: Json | null
          id: string
          images_completed: number | null
          images_pending: boolean | null
          images_total: number | null
          keywords: string[] | null
          last_content_change_at: string | null
          last_score_change_reason: string | null
          last_user_action: string | null
          last_user_action_at: string | null
          meta_description: string | null
          mini_case: Json | null
          niche_locked: boolean | null
          niche_profile_id: string | null
          opportunity_id: string | null
          pdf_generated_at: string | null
          pdf_url: string | null
          publication_target: string | null
          publication_url: string | null
          published_at: string | null
          quality_gate_attempts: number | null
          quality_gate_status: string | null
          reading_time: number | null
          ready_for_publish_at: string | null
          scheduled_at: string | null
          score_locked: boolean | null
          serp_enhanced: boolean | null
          serp_enhanced_at: string | null
          serp_hash_at_calculation: string | null
          share_count: number | null
          slug: string
          social_share_count: Json | null
          source_payload: Json | null
          status: string | null
          tags: string[] | null
          target_persona_id: string | null
          territory_id: string | null
          title: string
          title_fingerprint: string | null
          updated_at: string
          view_count: number | null
          whatsapp: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          article_goal?: string | null
          article_structure_type?: string | null
          blog_id: string
          category?: string | null
          content?: string | null
          content_hash?: string | null
          content_images?: Json | null
          content_version?: number | null
          conversion_intent_count?: number | null
          conversion_visibility_count?: number | null
          created_at?: string
          cta?: Json | null
          excerpt?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          faq?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          funnel_mode?: string | null
          funnel_stage?: string | null
          generation_progress?: number | null
          generation_source?: string | null
          generation_stage?: string | null
          highlights?: Json | null
          id?: string
          images_completed?: number | null
          images_pending?: boolean | null
          images_total?: number | null
          keywords?: string[] | null
          last_content_change_at?: string | null
          last_score_change_reason?: string | null
          last_user_action?: string | null
          last_user_action_at?: string | null
          meta_description?: string | null
          mini_case?: Json | null
          niche_locked?: boolean | null
          niche_profile_id?: string | null
          opportunity_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          publication_target?: string | null
          publication_url?: string | null
          published_at?: string | null
          quality_gate_attempts?: number | null
          quality_gate_status?: string | null
          reading_time?: number | null
          ready_for_publish_at?: string | null
          scheduled_at?: string | null
          score_locked?: boolean | null
          serp_enhanced?: boolean | null
          serp_enhanced_at?: string | null
          serp_hash_at_calculation?: string | null
          share_count?: number | null
          slug: string
          social_share_count?: Json | null
          source_payload?: Json | null
          status?: string | null
          tags?: string[] | null
          target_persona_id?: string | null
          territory_id?: string | null
          title: string
          title_fingerprint?: string | null
          updated_at?: string
          view_count?: number | null
          whatsapp?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          article_goal?: string | null
          article_structure_type?: string | null
          blog_id?: string
          category?: string | null
          content?: string | null
          content_hash?: string | null
          content_images?: Json | null
          content_version?: number | null
          conversion_intent_count?: number | null
          conversion_visibility_count?: number | null
          created_at?: string
          cta?: Json | null
          excerpt?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          faq?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          funnel_mode?: string | null
          funnel_stage?: string | null
          generation_progress?: number | null
          generation_source?: string | null
          generation_stage?: string | null
          highlights?: Json | null
          id?: string
          images_completed?: number | null
          images_pending?: boolean | null
          images_total?: number | null
          keywords?: string[] | null
          last_content_change_at?: string | null
          last_score_change_reason?: string | null
          last_user_action?: string | null
          last_user_action_at?: string | null
          meta_description?: string | null
          mini_case?: Json | null
          niche_locked?: boolean | null
          niche_profile_id?: string | null
          opportunity_id?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          publication_target?: string | null
          publication_url?: string | null
          published_at?: string | null
          quality_gate_attempts?: number | null
          quality_gate_status?: string | null
          reading_time?: number | null
          ready_for_publish_at?: string | null
          scheduled_at?: string | null
          score_locked?: boolean | null
          serp_enhanced?: boolean | null
          serp_enhanced_at?: string | null
          serp_hash_at_calculation?: string | null
          share_count?: number | null
          slug?: string
          social_share_count?: Json | null
          source_payload?: Json | null
          status?: string | null
          tags?: string[] | null
          target_persona_id?: string | null
          territory_id?: string | null
          title?: string
          title_fingerprint?: string | null
          updated_at?: string
          view_count?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_niche_profile_id_fkey"
            columns: ["niche_profile_id"]
            isOneToOne: false
            referencedRelation: "niche_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "article_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_target_persona_id_fkey"
            columns: ["target_persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_notifications: {
        Row: {
          article_id: string | null
          blog_id: string
          created_at: string | null
          id: string
          message: string | null
          notification_type: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          article_id?: string | null
          blog_id: string
          created_at?: string | null
          id?: string
          message?: string | null
          notification_type: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          article_id?: string | null
          blog_id?: string
          created_at?: string | null
          id?: string
          message?: string | null
          notification_type?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_notifications_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_notifications_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "automation_notifications_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_automation: {
        Row: {
          articles_per_period: number | null
          auto_fix_enabled: boolean | null
          auto_publish: boolean | null
          auto_publish_enabled: boolean | null
          autopilot_bottom: number | null
          autopilot_middle: number | null
          autopilot_top: number | null
          blog_id: string
          content_type: string | null
          created_at: string | null
          frequency: string | null
          funnel_autopilot: boolean | null
          generate_images: boolean | null
          id: string
          is_active: boolean | null
          max_auto_fix_attempts: number | null
          min_word_count: number | null
          mode: string | null
          niche_keywords: string[] | null
          preferred_days: string[] | null
          preferred_time: string | null
          publish_delay_hours: number | null
          quality_gate_enabled: boolean | null
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          articles_per_period?: number | null
          auto_fix_enabled?: boolean | null
          auto_publish?: boolean | null
          auto_publish_enabled?: boolean | null
          autopilot_bottom?: number | null
          autopilot_middle?: number | null
          autopilot_top?: number | null
          blog_id: string
          content_type?: string | null
          created_at?: string | null
          frequency?: string | null
          funnel_autopilot?: boolean | null
          generate_images?: boolean | null
          id?: string
          is_active?: boolean | null
          max_auto_fix_attempts?: number | null
          min_word_count?: number | null
          mode?: string | null
          niche_keywords?: string[] | null
          preferred_days?: string[] | null
          preferred_time?: string | null
          publish_delay_hours?: number | null
          quality_gate_enabled?: boolean | null
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          articles_per_period?: number | null
          auto_fix_enabled?: boolean | null
          auto_publish?: boolean | null
          auto_publish_enabled?: boolean | null
          autopilot_bottom?: number | null
          autopilot_middle?: number | null
          autopilot_top?: number | null
          blog_id?: string
          content_type?: string | null
          created_at?: string | null
          frequency?: string | null
          funnel_autopilot?: boolean | null
          generate_images?: boolean | null
          id?: string
          is_active?: boolean | null
          max_auto_fix_attempts?: number | null
          min_word_count?: number | null
          mode?: string | null
          niche_keywords?: string[] | null
          preferred_days?: string[] | null
          preferred_time?: string | null
          publish_delay_hours?: number | null
          quality_gate_enabled?: boolean | null
          tone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_automation_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          blog_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_categories_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_config: {
        Row: {
          auto_boost_on_publish: boolean | null
          blog_id: string | null
          created_at: string | null
          id: string
          max_word_count: number | null
          min_word_count: number | null
          minimum_score_to_publish: number | null
          require_featured_image: boolean | null
          serp_cache_ttl_hours: number | null
          updated_at: string | null
        }
        Insert: {
          auto_boost_on_publish?: boolean | null
          blog_id?: string | null
          created_at?: string | null
          id?: string
          max_word_count?: number | null
          min_word_count?: number | null
          minimum_score_to_publish?: number | null
          require_featured_image?: boolean | null
          serp_cache_ttl_hours?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_boost_on_publish?: boolean | null
          blog_id?: string | null
          created_at?: string | null
          id?: string
          max_word_count?: number | null
          min_word_count?: number | null
          minimum_score_to_publish?: number | null
          require_featured_image?: boolean | null
          serp_cache_ttl_hours?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_config_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_contact_buttons: {
        Row: {
          blog_id: string
          button_type: string
          created_at: string | null
          email_subject: string | null
          id: string
          label: string | null
          sort_order: number | null
          value: string
          whatsapp_message: string | null
        }
        Insert: {
          blog_id: string
          button_type: string
          created_at?: string | null
          email_subject?: string | null
          id?: string
          label?: string | null
          sort_order?: number | null
          value: string
          whatsapp_message?: string | null
        }
        Update: {
          blog_id?: string
          button_type?: string
          created_at?: string | null
          email_subject?: string | null
          id?: string
          label?: string | null
          sort_order?: number | null
          value?: string
          whatsapp_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_contact_buttons_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_feature_flags: {
        Row: {
          blog_id: string
          created_at: string | null
          flag_name: string
          id: string
          is_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          flag_name: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          flag_name?: string
          id?: string
          is_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_feature_flags_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_traffic: {
        Row: {
          avg_time_on_site: number | null
          blog_id: string
          bounce_rate: number | null
          created_at: string
          date: string
          direct_visits: number | null
          email_visits: number | null
          id: string
          organic_visits: number | null
          referral_visits: number | null
          social_visits: number | null
          total_visits: number | null
          unique_visitors: number | null
          updated_at: string
        }
        Insert: {
          avg_time_on_site?: number | null
          blog_id: string
          bounce_rate?: number | null
          created_at?: string
          date: string
          direct_visits?: number | null
          email_visits?: number | null
          id?: string
          organic_visits?: number | null
          referral_visits?: number | null
          social_visits?: number | null
          total_visits?: number | null
          unique_visitors?: number | null
          updated_at?: string
        }
        Update: {
          avg_time_on_site?: number | null
          blog_id?: string
          bounce_rate?: number | null
          created_at?: string
          date?: string
          direct_visits?: number | null
          email_visits?: number | null
          id?: string
          organic_visits?: number | null
          referral_visits?: number | null
          social_visits?: number | null
          total_visits?: number | null
          unique_visitors?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_traffic_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      blogs: {
        Row: {
          author_bio: string | null
          author_linkedin: string | null
          author_name: string | null
          author_photo_url: string | null
          banner_description: string | null
          banner_enabled: boolean | null
          banner_image_url: string | null
          banner_link_url: string | null
          banner_mobile_image_url: string | null
          banner_overlay_opacity: number | null
          banner_title: string | null
          brand_description: string | null
          brand_display_mode: string | null
          city: string | null
          color_palette: Json | null
          created_at: string
          cta_text: string | null
          cta_type: string | null
          cta_url: string | null
          custom_domain: string | null
          dark_primary_color: string | null
          dark_secondary_color: string | null
          description: string | null
          domain_verification_token: string | null
          domain_verified: boolean | null
          favicon_url: string | null
          footer_text: string | null
          header_cta_text: string | null
          header_cta_url: string | null
          hero_background_color: string | null
          id: string
          integration_type: string | null
          is_active: boolean | null
          layout_template: string | null
          logo_background_color: string | null
          logo_negative_background_color: string | null
          logo_negative_url: string | null
          logo_url: string | null
          name: string
          niche_profile_id: string | null
          onboarding_completed: boolean | null
          platform_subdomain: string | null
          primary_color: string | null
          public_blog_enabled: boolean | null
          script_body: string | null
          script_footer: string | null
          script_head: string | null
          seasonal_template: string | null
          seasonal_template_expires_at: string | null
          secondary_color: string | null
          show_categories_footer: boolean | null
          show_powered_by: boolean | null
          show_search: boolean | null
          slug: string
          tenant_id: string | null
          theme_mode: string | null
          tracking_config: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          author_bio?: string | null
          author_linkedin?: string | null
          author_name?: string | null
          author_photo_url?: string | null
          banner_description?: string | null
          banner_enabled?: boolean | null
          banner_image_url?: string | null
          banner_link_url?: string | null
          banner_mobile_image_url?: string | null
          banner_overlay_opacity?: number | null
          banner_title?: string | null
          brand_description?: string | null
          brand_display_mode?: string | null
          city?: string | null
          color_palette?: Json | null
          created_at?: string
          cta_text?: string | null
          cta_type?: string | null
          cta_url?: string | null
          custom_domain?: string | null
          dark_primary_color?: string | null
          dark_secondary_color?: string | null
          description?: string | null
          domain_verification_token?: string | null
          domain_verified?: boolean | null
          favicon_url?: string | null
          footer_text?: string | null
          header_cta_text?: string | null
          header_cta_url?: string | null
          hero_background_color?: string | null
          id?: string
          integration_type?: string | null
          is_active?: boolean | null
          layout_template?: string | null
          logo_background_color?: string | null
          logo_negative_background_color?: string | null
          logo_negative_url?: string | null
          logo_url?: string | null
          name: string
          niche_profile_id?: string | null
          onboarding_completed?: boolean | null
          platform_subdomain?: string | null
          primary_color?: string | null
          public_blog_enabled?: boolean | null
          script_body?: string | null
          script_footer?: string | null
          script_head?: string | null
          seasonal_template?: string | null
          seasonal_template_expires_at?: string | null
          secondary_color?: string | null
          show_categories_footer?: boolean | null
          show_powered_by?: boolean | null
          show_search?: boolean | null
          slug: string
          tenant_id?: string | null
          theme_mode?: string | null
          tracking_config?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          author_bio?: string | null
          author_linkedin?: string | null
          author_name?: string | null
          author_photo_url?: string | null
          banner_description?: string | null
          banner_enabled?: boolean | null
          banner_image_url?: string | null
          banner_link_url?: string | null
          banner_mobile_image_url?: string | null
          banner_overlay_opacity?: number | null
          banner_title?: string | null
          brand_description?: string | null
          brand_display_mode?: string | null
          city?: string | null
          color_palette?: Json | null
          created_at?: string
          cta_text?: string | null
          cta_type?: string | null
          cta_url?: string | null
          custom_domain?: string | null
          dark_primary_color?: string | null
          dark_secondary_color?: string | null
          description?: string | null
          domain_verification_token?: string | null
          domain_verified?: boolean | null
          favicon_url?: string | null
          footer_text?: string | null
          header_cta_text?: string | null
          header_cta_url?: string | null
          hero_background_color?: string | null
          id?: string
          integration_type?: string | null
          is_active?: boolean | null
          layout_template?: string | null
          logo_background_color?: string | null
          logo_negative_background_color?: string | null
          logo_negative_url?: string | null
          logo_url?: string | null
          name?: string
          niche_profile_id?: string | null
          onboarding_completed?: boolean | null
          platform_subdomain?: string | null
          primary_color?: string | null
          public_blog_enabled?: boolean | null
          script_body?: string | null
          script_footer?: string | null
          script_head?: string | null
          seasonal_template?: string | null
          seasonal_template_expires_at?: string | null
          secondary_color?: string | null
          show_categories_footer?: boolean | null
          show_powered_by?: boolean | null
          show_search?: boolean | null
          slug?: string
          tenant_id?: string | null
          theme_mode?: string | null
          tracking_config?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blogs_niche_profile_id_fkey"
            columns: ["niche_profile_id"]
            isOneToOne: false
            referencedRelation: "niche_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blogs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_agent_config: {
        Row: {
          agent_avatar_url: string | null
          agent_name: string | null
          agent_stripe_subscription_id: string | null
          agent_subscription_started_at: string | null
          agent_subscription_status: string | null
          blog_id: string
          conversion_goals: string[] | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          max_tokens_per_day: number | null
          monthly_price_usd: number | null
          personality_traits: string[] | null
          proactive_delay_seconds: number | null
          tokens_reset_at: string | null
          tokens_used_today: number | null
          updated_at: string | null
          webhook_secret: string | null
          webhook_url: string | null
          welcome_message: string | null
        }
        Insert: {
          agent_avatar_url?: string | null
          agent_name?: string | null
          agent_stripe_subscription_id?: string | null
          agent_subscription_started_at?: string | null
          agent_subscription_status?: string | null
          blog_id: string
          conversion_goals?: string[] | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          max_tokens_per_day?: number | null
          monthly_price_usd?: number | null
          personality_traits?: string[] | null
          proactive_delay_seconds?: number | null
          tokens_reset_at?: string | null
          tokens_used_today?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
          welcome_message?: string | null
        }
        Update: {
          agent_avatar_url?: string | null
          agent_name?: string | null
          agent_stripe_subscription_id?: string | null
          agent_subscription_started_at?: string | null
          agent_subscription_status?: string | null
          blog_id?: string
          conversion_goals?: string[] | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          max_tokens_per_day?: number | null
          monthly_price_usd?: number | null
          personality_traits?: string[] | null
          proactive_delay_seconds?: number | null
          tokens_reset_at?: string | null
          tokens_used_today?: number | null
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_agent_config_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_agent_conversations: {
        Row: {
          article_id: string | null
          blog_id: string
          created_at: string | null
          id: string
          last_message_at: string | null
          lead_captured: boolean | null
          messages: Json | null
          session_id: string
          tokens_used: number | null
          visitor_id: string
        }
        Insert: {
          article_id?: string | null
          blog_id: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lead_captured?: boolean | null
          messages?: Json | null
          session_id: string
          tokens_used?: number | null
          visitor_id: string
        }
        Update: {
          article_id?: string | null
          blog_id?: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lead_captured?: boolean | null
          messages?: Json | null
          session_id?: string
          tokens_used?: number | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_agent_conversations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_agent_conversations_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "brand_agent_conversations_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_agent_leads: {
        Row: {
          article_id: string | null
          article_title: string | null
          blog_id: string
          conversation_id: string | null
          created_at: string | null
          email: string | null
          id: string
          interest_summary: string | null
          lead_score: number | null
          name: string | null
          phone: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          webhook_response: Json | null
          webhook_sent_at: string | null
          whatsapp: string | null
        }
        Insert: {
          article_id?: string | null
          article_title?: string | null
          blog_id: string
          conversation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interest_summary?: string | null
          lead_score?: number | null
          name?: string | null
          phone?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          webhook_response?: Json | null
          webhook_sent_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          article_id?: string | null
          article_title?: string | null
          blog_id?: string
          conversation_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          interest_summary?: string | null
          lead_score?: number | null
          name?: string | null
          phone?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          webhook_response?: Json | null
          webhook_sent_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_agent_leads_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_agent_leads_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "brand_agent_leads_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_agent_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "brand_agent_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_agent_usage_monthly: {
        Row: {
          blog_id: string | null
          created_at: string | null
          id: string
          month: string
          total_conversations: number | null
          total_cost_usd: number | null
          total_leads_captured: number | null
          total_messages: number | null
          total_tokens_used: number | null
        }
        Insert: {
          blog_id?: string | null
          created_at?: string | null
          id?: string
          month: string
          total_conversations?: number | null
          total_cost_usd?: number | null
          total_leads_captured?: number | null
          total_messages?: number | null
          total_tokens_used?: number | null
        }
        Update: {
          blog_id?: string | null
          created_at?: string | null
          id?: string
          month?: string
          total_conversations?: number | null
          total_cost_usd?: number | null
          total_leads_captured?: number | null
          total_messages?: number | null
          total_tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_agent_usage_monthly_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          average_margin: number | null
          average_ticket: number | null
          blog_id: string
          brand_keywords: string[] | null
          business_economics_configured: boolean | null
          city: string | null
          closing_rate: number | null
          company_name: string | null
          concepts: string[] | null
          country: string | null
          created_at: string
          currency: string | null
          custom_opportunity_value: number | null
          default_template_id: string | null
          desires: string[] | null
          id: string
          is_library_enabled: boolean | null
          language: string | null
          long_description: string | null
          niche: string | null
          niche_profile_id: string | null
          pain_points: string[] | null
          project_name: string | null
          services: string | null
          target_audience: string | null
          tone_of_voice: string | null
          updated_at: string
          value_per_intent: number | null
          value_per_visibility: number | null
          whatsapp: string | null
          whatsapp_lead_template: string | null
        }
        Insert: {
          average_margin?: number | null
          average_ticket?: number | null
          blog_id: string
          brand_keywords?: string[] | null
          business_economics_configured?: boolean | null
          city?: string | null
          closing_rate?: number | null
          company_name?: string | null
          concepts?: string[] | null
          country?: string | null
          created_at?: string
          currency?: string | null
          custom_opportunity_value?: number | null
          default_template_id?: string | null
          desires?: string[] | null
          id?: string
          is_library_enabled?: boolean | null
          language?: string | null
          long_description?: string | null
          niche?: string | null
          niche_profile_id?: string | null
          pain_points?: string[] | null
          project_name?: string | null
          services?: string | null
          target_audience?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          value_per_intent?: number | null
          value_per_visibility?: number | null
          whatsapp?: string | null
          whatsapp_lead_template?: string | null
        }
        Update: {
          average_margin?: number | null
          average_ticket?: number | null
          blog_id?: string
          brand_keywords?: string[] | null
          business_economics_configured?: boolean | null
          city?: string | null
          closing_rate?: number | null
          company_name?: string | null
          concepts?: string[] | null
          country?: string | null
          created_at?: string
          currency?: string | null
          custom_opportunity_value?: number | null
          default_template_id?: string | null
          desires?: string[] | null
          id?: string
          is_library_enabled?: boolean | null
          language?: string | null
          long_description?: string | null
          niche?: string | null
          niche_profile_id?: string | null
          pain_points?: string[] | null
          project_name?: string | null
          services?: string | null
          target_audience?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          value_per_intent?: number | null
          value_per_visibility?: number | null
          whatsapp?: string | null
          whatsapp_lead_template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profile_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profile_default_template_id_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "editorial_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profile_niche_profile_id_fkey"
            columns: ["niche_profile_id"]
            isOneToOne: false
            referencedRelation: "niche_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_article_drafts: {
        Row: {
          blog_id: string
          created_at: string | null
          current_input: string | null
          generated_article: Json | null
          id: string
          is_ready_to_generate: boolean | null
          messages: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          current_input?: string | null
          generated_article?: Json | null
          id?: string
          is_ready_to_generate?: boolean | null
          messages?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          current_input?: string | null
          generated_article?: Json | null
          id?: string
          is_ready_to_generate?: boolean | null
          messages?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_article_drafts_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_reviews: {
        Row: {
          article_id: string
          blog_id: string
          client_email: string | null
          client_name: string | null
          comments: Json | null
          created_at: string | null
          expires_at: string | null
          id: string
          reviewed_at: string | null
          share_token: string
          status: string | null
        }
        Insert: {
          article_id: string
          blog_id: string
          client_email?: string | null
          client_name?: string | null
          comments?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          share_token: string
          status?: string | null
        }
        Update: {
          article_id?: string
          blog_id?: string
          client_email?: string | null
          client_name?: string | null
          comments?: Json | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          share_token?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_reviews_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_reviews_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "client_reviews_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_strategy: {
        Row: {
          acao_desejada: string | null
          blog_id: string | null
          canal_cta: string | null
          created_at: string | null
          desejo_principal: string | null
          diferenciais: string[] | null
          dor_principal: string | null
          empresa_nome: string | null
          id: string
          nivel_conhecimento: string | null
          nivel_consciencia: string | null
          o_que_oferece: string | null
          principais_beneficios: string[] | null
          regiao_atuacao: string | null
          tipo_negocio: string | null
          tipo_publico: string | null
          updated_at: string | null
        }
        Insert: {
          acao_desejada?: string | null
          blog_id?: string | null
          canal_cta?: string | null
          created_at?: string | null
          desejo_principal?: string | null
          diferenciais?: string[] | null
          dor_principal?: string | null
          empresa_nome?: string | null
          id?: string
          nivel_conhecimento?: string | null
          nivel_consciencia?: string | null
          o_que_oferece?: string | null
          principais_beneficios?: string[] | null
          regiao_atuacao?: string | null
          tipo_negocio?: string | null
          tipo_publico?: string | null
          updated_at?: string | null
        }
        Update: {
          acao_desejada?: string | null
          blog_id?: string | null
          canal_cta?: string | null
          created_at?: string | null
          desejo_principal?: string | null
          diferenciais?: string[] | null
          dor_principal?: string | null
          empresa_nome?: string | null
          id?: string
          nivel_conhecimento?: string | null
          nivel_consciencia?: string | null
          o_que_oferece?: string | null
          principais_beneficios?: string[] | null
          regiao_atuacao?: string | null
          tipo_negocio?: string | null
          tipo_publico?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_strategy_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      cluster_articles: {
        Row: {
          article_id: string | null
          cluster_id: string
          created_at: string
          id: string
          internal_links: Json | null
          is_pillar: boolean | null
          status: string | null
          suggested_keywords: string[] | null
          suggested_title: string | null
        }
        Insert: {
          article_id?: string | null
          cluster_id: string
          created_at?: string
          id?: string
          internal_links?: Json | null
          is_pillar?: boolean | null
          status?: string | null
          suggested_keywords?: string[] | null
          suggested_title?: string | null
        }
        Update: {
          article_id?: string | null
          cluster_id?: string
          created_at?: string
          id?: string
          internal_links?: Json | null
          is_pillar?: boolean | null
          status?: string | null
          suggested_keywords?: string[] | null
          suggested_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cluster_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cluster_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "cluster_articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "content_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_credential_access_log: {
        Row: {
          access_type: string
          accessed_at: string | null
          accessed_by: string | null
          id: string
          integration_id: string | null
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          access_type: string
          accessed_at?: string | null
          accessed_by?: string | null
          id?: string
          integration_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          access_type?: string
          accessed_at?: string | null
          accessed_by?: string | null
          id?: string
          integration_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_credential_access_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "cms_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_credential_access_log_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "cms_integrations_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_integrations: {
        Row: {
          access_token_encrypted: string | null
          api_key: string | null
          api_key_encrypted: string | null
          api_secret: string | null
          api_secret_encrypted: string | null
          auth_type: string | null
          auto_publish: boolean | null
          blog_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_status: string | null
          platform: string
          refresh_token_encrypted: string | null
          site_url: string
          token_expires_at: string | null
          updated_at: string | null
          username: string | null
          wordpress_site_id: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          api_key?: string | null
          api_key_encrypted?: string | null
          api_secret?: string | null
          api_secret_encrypted?: string | null
          auth_type?: string | null
          auto_publish?: boolean | null
          blog_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          platform: string
          refresh_token_encrypted?: string | null
          site_url: string
          token_expires_at?: string | null
          updated_at?: string | null
          username?: string | null
          wordpress_site_id?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          api_key?: string | null
          api_key_encrypted?: string | null
          api_secret?: string | null
          api_secret_encrypted?: string | null
          auth_type?: string | null
          auto_publish?: boolean | null
          blog_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          platform?: string
          refresh_token_encrypted?: string | null
          site_url?: string
          token_expires_at?: string | null
          updated_at?: string | null
          username?: string | null
          wordpress_site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_integrations_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_publish_logs: {
        Row: {
          action: string
          article_id: string
          created_at: string | null
          error_message: string | null
          external_id: string | null
          external_url: string | null
          id: string
          integration_id: string
          status: string
        }
        Insert: {
          action: string
          article_id: string
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          integration_id: string
          status: string
        }
        Update: {
          action?: string
          article_id?: string
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          integration_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_publish_logs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_publish_logs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "cms_publish_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "cms_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cms_publish_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "cms_integrations_decrypted"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          blog_id: string
          created_at: string
          favicon_url: string | null
          id: string
          is_active: boolean | null
          keywords_ranked: number | null
          monthly_clicks: number | null
          name: string
          top_articles: number | null
          traffic_value_brl: number | null
          updated_at: string
          url: string
        }
        Insert: {
          blog_id: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          is_active?: boolean | null
          keywords_ranked?: number | null
          monthly_clicks?: number | null
          name: string
          top_articles?: number | null
          traffic_value_brl?: number | null
          updated_at?: string
          url: string
        }
        Update: {
          blog_id?: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          is_active?: boolean | null
          keywords_ranked?: number | null
          monthly_clicks?: number | null
          name?: string
          top_articles?: number | null
          traffic_value_brl?: number | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_metrics_daily: {
        Row: {
          blog_id: string | null
          converted_to_articles: number | null
          created_at: string | null
          date: string
          estimated_value_usd: number | null
          high_score_opportunities: number | null
          id: string
          low_score_opportunities: number | null
          medium_score_opportunities: number | null
          published_articles: number | null
          total_opportunities: number | null
          total_shares: number | null
          total_views: number | null
        }
        Insert: {
          blog_id?: string | null
          converted_to_articles?: number | null
          created_at?: string | null
          date?: string
          estimated_value_usd?: number | null
          high_score_opportunities?: number | null
          id?: string
          low_score_opportunities?: number | null
          medium_score_opportunities?: number | null
          published_articles?: number | null
          total_opportunities?: number | null
          total_shares?: number | null
          total_views?: number | null
        }
        Update: {
          blog_id?: string | null
          converted_to_articles?: number | null
          created_at?: string | null
          date?: string
          estimated_value_usd?: number | null
          high_score_opportunities?: number | null
          id?: string
          low_score_opportunities?: number | null
          medium_score_opportunities?: number | null
          published_articles?: number | null
          total_opportunities?: number | null
          total_shares?: number | null
          total_views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultant_metrics_daily_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      consumption_logs: {
        Row: {
          action_description: string | null
          action_type: string
          blog_id: string | null
          created_at: string | null
          estimated_cost_usd: number
          id: string
          images_generated: number | null
          input_tokens: number | null
          metadata: Json | null
          model_used: string | null
          output_tokens: number | null
          user_id: string
        }
        Insert: {
          action_description?: string | null
          action_type: string
          blog_id?: string | null
          created_at?: string | null
          estimated_cost_usd?: number
          id?: string
          images_generated?: number | null
          input_tokens?: number | null
          metadata?: Json | null
          model_used?: string | null
          output_tokens?: number | null
          user_id: string
        }
        Update: {
          action_description?: string | null
          action_type?: string
          blog_id?: string | null
          created_at?: string | null
          estimated_cost_usd?: number
          id?: string
          images_generated?: number | null
          input_tokens?: number | null
          metadata?: Json | null
          model_used?: string | null
          output_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumption_logs_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_blocks: {
        Row: {
          active: boolean | null
          block_key: string
          compatible_structures: string[] | null
          constraints_json: Json | null
          created_at: string | null
          display_name: string
          id: string
          niche: string
          prompt_snippet: string
        }
        Insert: {
          active?: boolean | null
          block_key: string
          compatible_structures?: string[] | null
          constraints_json?: Json | null
          created_at?: string | null
          display_name: string
          id?: string
          niche?: string
          prompt_snippet: string
        }
        Update: {
          active?: boolean | null
          block_key?: string
          compatible_structures?: string[] | null
          constraints_json?: Json | null
          created_at?: string | null
          display_name?: string
          id?: string
          niche?: string
          prompt_snippet?: string
        }
        Relationships: []
      }
      content_clusters: {
        Row: {
          blog_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          pillar_keyword: string
          status: string | null
          updated_at: string
        }
        Insert: {
          blog_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pillar_keyword: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          blog_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pillar_keyword?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_clusters_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      content_preferences: {
        Row: {
          ai_model_image: string | null
          ai_model_text: string | null
          anticipate_scheduling: boolean | null
          auto_approve: boolean | null
          blog_id: string
          competitor_citation: string | null
          created_at: string | null
          cta_text: string | null
          default_instructions: string | null
          default_word_count: number | null
          grammatical_person: string | null
          id: string
          image_style: string | null
          include_faq: boolean | null
          mention_project: boolean | null
          post_interval_hours: number | null
          primary_color: string | null
          primary_color_light: string | null
          updated_at: string | null
          use_ai_images: boolean | null
          use_external_data: boolean | null
          use_own_images: boolean | null
          use_stock_images: boolean | null
          writing_style: string | null
        }
        Insert: {
          ai_model_image?: string | null
          ai_model_text?: string | null
          anticipate_scheduling?: boolean | null
          auto_approve?: boolean | null
          blog_id: string
          competitor_citation?: string | null
          created_at?: string | null
          cta_text?: string | null
          default_instructions?: string | null
          default_word_count?: number | null
          grammatical_person?: string | null
          id?: string
          image_style?: string | null
          include_faq?: boolean | null
          mention_project?: boolean | null
          post_interval_hours?: number | null
          primary_color?: string | null
          primary_color_light?: string | null
          updated_at?: string | null
          use_ai_images?: boolean | null
          use_external_data?: boolean | null
          use_own_images?: boolean | null
          use_stock_images?: boolean | null
          writing_style?: string | null
        }
        Update: {
          ai_model_image?: string | null
          ai_model_text?: string | null
          anticipate_scheduling?: boolean | null
          auto_approve?: boolean | null
          blog_id?: string
          competitor_citation?: string | null
          created_at?: string | null
          cta_text?: string | null
          default_instructions?: string | null
          default_word_count?: number | null
          grammatical_person?: string | null
          id?: string
          image_style?: string | null
          include_faq?: boolean | null
          mention_project?: boolean | null
          post_interval_hours?: number | null
          primary_color?: string | null
          primary_color_light?: string | null
          updated_at?: string | null
          use_ai_images?: boolean | null
          use_external_data?: boolean | null
          use_own_images?: boolean | null
          use_stock_images?: boolean | null
          writing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_preferences_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_templates: {
        Row: {
          blog_id: string
          config: Json
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          blog_id: string
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          blog_id?: string
          config?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_templates_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      ebook_leads: {
        Row: {
          blog_id: string
          created_at: string | null
          downloaded_at: string | null
          ebook_id: string
          email: string
          id: string
          ip_address: string | null
          name: string
          source: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          whatsapp: string | null
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          downloaded_at?: string | null
          ebook_id: string
          email: string
          id?: string
          ip_address?: string | null
          name: string
          source?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          downloaded_at?: string | null
          ebook_id?: string
          email?: string
          id?: string
          ip_address?: string | null
          name?: string
          source?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ebook_leads_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebook_leads_ebook_id_fkey"
            columns: ["ebook_id"]
            isOneToOne: false
            referencedRelation: "ebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      ebooks: {
        Row: {
          accent_color: string | null
          access_type: string | null
          author: string | null
          blog_id: string
          content: string | null
          content_images: Json | null
          cover_image_url: string | null
          created_at: string
          cta_body: string | null
          cta_button_link: string | null
          cta_button_text: string | null
          cta_title: string | null
          custom_thank_you_message: string | null
          download_count: number | null
          error_message: string | null
          id: string
          is_public: boolean | null
          landing_page_description: string | null
          light_color: string | null
          logo_url: string | null
          pdf_url: string | null
          require_email: boolean | null
          require_whatsapp: boolean | null
          show_author: boolean | null
          slug: string | null
          source_article_id: string | null
          status: string | null
          title: string
          updated_at: string
          view_count: number | null
          word_count_target: number | null
        }
        Insert: {
          accent_color?: string | null
          access_type?: string | null
          author?: string | null
          blog_id: string
          content?: string | null
          content_images?: Json | null
          cover_image_url?: string | null
          created_at?: string
          cta_body?: string | null
          cta_button_link?: string | null
          cta_button_text?: string | null
          cta_title?: string | null
          custom_thank_you_message?: string | null
          download_count?: number | null
          error_message?: string | null
          id?: string
          is_public?: boolean | null
          landing_page_description?: string | null
          light_color?: string | null
          logo_url?: string | null
          pdf_url?: string | null
          require_email?: boolean | null
          require_whatsapp?: boolean | null
          show_author?: boolean | null
          slug?: string | null
          source_article_id?: string | null
          status?: string | null
          title: string
          updated_at?: string
          view_count?: number | null
          word_count_target?: number | null
        }
        Update: {
          accent_color?: string | null
          access_type?: string | null
          author?: string | null
          blog_id?: string
          content?: string | null
          content_images?: Json | null
          cover_image_url?: string | null
          created_at?: string
          cta_body?: string | null
          cta_button_link?: string | null
          cta_button_text?: string | null
          cta_title?: string | null
          custom_thank_you_message?: string | null
          download_count?: number | null
          error_message?: string | null
          id?: string
          is_public?: boolean | null
          landing_page_description?: string | null
          light_color?: string | null
          logo_url?: string | null
          pdf_url?: string | null
          require_email?: boolean | null
          require_whatsapp?: boolean | null
          show_author?: boolean | null
          slug?: string | null
          source_article_id?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          view_count?: number | null
          word_count_target?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ebooks_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebooks_source_article_id_fkey"
            columns: ["source_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebooks_source_article_id_fkey"
            columns: ["source_article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      editorial_templates: {
        Row: {
          blog_id: string
          category_default: string | null
          company_name: string | null
          content_focus: string | null
          created_at: string
          cta_template: string | null
          id: string
          image_guidelines: Json | null
          is_default: boolean | null
          mandatory_structure: Json | null
          name: string
          seo_settings: Json | null
          target_niche: string | null
          title_guidelines: string | null
          tone_rules: string | null
          updated_at: string
        }
        Insert: {
          blog_id: string
          category_default?: string | null
          company_name?: string | null
          content_focus?: string | null
          created_at?: string
          cta_template?: string | null
          id?: string
          image_guidelines?: Json | null
          is_default?: boolean | null
          mandatory_structure?: Json | null
          name: string
          seo_settings?: Json | null
          target_niche?: string | null
          title_guidelines?: string | null
          tone_rules?: string | null
          updated_at?: string
        }
        Update: {
          blog_id?: string
          category_default?: string | null
          company_name?: string | null
          content_focus?: string | null
          created_at?: string
          cta_template?: string | null
          id?: string
          image_guidelines?: Json | null
          is_default?: boolean | null
          mandatory_structure?: Json | null
          name?: string
          seo_settings?: Json | null
          target_niche?: string | null
          title_guidelines?: string | null
          tone_rules?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_templates_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          blog_id: string | null
          brevo_message_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          language: string
          status: string
          subject: string | null
          template: string
          to_email: string
          to_name: string | null
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          blog_id?: string | null
          brevo_message_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          language?: string
          status?: string
          subject?: string | null
          template: string
          to_email: string
          to_name?: string | null
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          blog_id?: string | null
          brevo_message_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          language?: string
          status?: string
          subject?: string | null
          template?: string
          to_email?: string
          to_name?: string | null
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_events: {
        Row: {
          article_id: string | null
          blog_id: string | null
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          session_id: string
          visitor_id: string | null
        }
        Insert: {
          article_id?: string | null
          blog_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          session_id: string
          visitor_id?: string | null
        }
        Update: {
          article_id?: string | null
          blog_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          session_id?: string
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_events_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_events_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "funnel_events_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_goals: {
        Row: {
          alert_threshold: number | null
          blog_id: string
          created_at: string | null
          id: string
          stage: string
          target_value: number
          updated_at: string | null
        }
        Insert: {
          alert_threshold?: number | null
          blog_id: string
          created_at?: string | null
          id?: string
          stage: string
          target_value: number
          updated_at?: string | null
        }
        Update: {
          alert_threshold?: number | null
          blog_id?: string
          created_at?: string | null
          id?: string
          stage?: string
          target_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_goals_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_rate_limits: {
        Row: {
          blog_id: string
          created_at: string | null
          id: string
          requests_count: number | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          id?: string
          requests_count?: number | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          id?: string
          requests_count?: number | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_rate_limits_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      global_comm_config: {
        Row: {
          config_key: string
          created_at: string | null
          id: string
          is_active: boolean | null
          message_template: string
          placeholders: Json
          updated_at: string | null
          whatsapp_base_url: string
        }
        Insert: {
          config_key: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_template: string
          placeholders?: Json
          updated_at?: string | null
          whatsapp_base_url?: string
        }
        Update: {
          config_key?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          message_template?: string
          placeholders?: Json
          updated_at?: string | null
          whatsapp_base_url?: string
        }
        Relationships: []
      }
      gsc_alert_history: {
        Row: {
          alert_id: string | null
          blog_id: string
          change_percent: number | null
          current_value: number | null
          id: string
          message: string | null
          metric_type: string
          previous_value: number | null
          query_or_page: string | null
          triggered_at: string
        }
        Insert: {
          alert_id?: string | null
          blog_id: string
          change_percent?: number | null
          current_value?: number | null
          id?: string
          message?: string | null
          metric_type: string
          previous_value?: number | null
          query_or_page?: string | null
          triggered_at?: string
        }
        Update: {
          alert_id?: string | null
          blog_id?: string
          change_percent?: number | null
          current_value?: number | null
          id?: string
          message?: string | null
          metric_type?: string
          previous_value?: number | null
          query_or_page?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_alert_history_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "gsc_ranking_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsc_alert_history_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_analytics_history: {
        Row: {
          blog_id: string
          clicks: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          position: number | null
        }
        Insert: {
          blog_id: string
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          position?: number | null
        }
        Update: {
          blog_id?: string
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gsc_analytics_history_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_connections: {
        Row: {
          access_token: string | null
          blog_id: string
          connected_at: string | null
          created_at: string
          google_email: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          refresh_token: string | null
          site_url: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          blog_id: string
          connected_at?: string | null
          created_at?: string
          google_email?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token?: string | null
          site_url: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          blog_id?: string
          connected_at?: string | null
          created_at?: string
          google_email?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          refresh_token?: string | null
          site_url?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_connections_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_pages_history: {
        Row: {
          blog_id: string
          clicks: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          page_url: string
          position: number | null
        }
        Insert: {
          blog_id: string
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          page_url: string
          position?: number | null
        }
        Update: {
          blog_id?: string
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          page_url?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gsc_pages_history_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_queries_history: {
        Row: {
          blog_id: string
          clicks: number | null
          created_at: string
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          position: number | null
          query: string
        }
        Insert: {
          blog_id: string
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          position?: number | null
          query: string
        }
        Update: {
          blog_id?: string
          clicks?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          position?: number | null
          query?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_queries_history_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_ranking_alerts: {
        Row: {
          alert_type: string
          blog_id: string
          created_at: string
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          notification_email: string | null
          threshold_percent: number
          updated_at: string
        }
        Insert: {
          alert_type: string
          blog_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          notification_email?: string | null
          threshold_percent?: number
          updated_at?: string
        }
        Update: {
          alert_type?: string
          blog_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          notification_email?: string | null
          threshold_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_ranking_alerts_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          category: string
          content: string
          created_at: string | null
          header_gif_url: string | null
          icon: string
          id: string
          is_published: boolean | null
          language: string | null
          order_index: number | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          header_gif_url?: string | null
          icon: string
          id?: string
          is_published?: boolean | null
          language?: string | null
          order_index?: number | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          header_gif_url?: string | null
          icon?: string
          id?: string
          is_published?: boolean | null
          language?: string | null
          order_index?: number | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      help_faqs: {
        Row: {
          answer: string
          category: string
          created_at: string | null
          helpful_count: number | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          language: string | null
          order_index: number | null
          question: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          category: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          language?: string | null
          order_index?: number | null
          question: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          language?: string | null
          order_index?: number | null
          question?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      indexnow_submissions: {
        Row: {
          article_id: string
          blog_id: string
          id: string
          response_body: string | null
          response_status: number | null
          search_engine: string
          submitted_at: string | null
          url_submitted: string
        }
        Insert: {
          article_id: string
          blog_id: string
          id?: string
          response_body?: string | null
          response_status?: number | null
          search_engine: string
          submitted_at?: string | null
          url_submitted: string
        }
        Update: {
          article_id?: string
          blog_id?: string
          id?: string
          response_body?: string | null
          response_status?: number | null
          search_engine?: string
          submitted_at?: string | null
          url_submitted?: string
        }
        Relationships: [
          {
            foreignKeyName: "indexnow_submissions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indexnow_submissions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "indexnow_submissions_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_analyses: {
        Row: {
          analyzed_at: string
          blog_id: string
          created_at: string
          difficulty: number | null
          id: string
          keyword: string
          search_volume: number | null
          source: string | null
          suggestions: Json | null
        }
        Insert: {
          analyzed_at?: string
          blog_id: string
          created_at?: string
          difficulty?: number | null
          id?: string
          keyword: string
          search_volume?: number | null
          source?: string | null
          suggestions?: Json | null
        }
        Update: {
          analyzed_at?: string
          blog_id?: string
          created_at?: string
          difficulty?: number | null
          id?: string
          keyword?: string
          search_volume?: number | null
          source?: string | null
          suggestions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "keyword_analyses_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_events: {
        Row: {
          browser: string | null
          country: string | null
          created_at: string | null
          device: string | null
          event_data: Json | null
          event_type: string
          id: string
          page_section: string | null
          session_id: string
          source: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          browser?: string | null
          country?: string | null
          created_at?: string | null
          device?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_section?: string | null
          session_id: string
          source?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          browser?: string | null
          country?: string | null
          created_at?: string | null
          device?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_section?: string | null
          session_id?: string
          source?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          blog_id: string
          created_at: string
          featured_image_url: string | null
          generation_source: string | null
          id: string
          page_data: Json
          published_at: string | null
          seo_analyzed_at: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_metrics: Json | null
          seo_recommendations: Json | null
          seo_score: number | null
          seo_title: string | null
          slug: string
          status: string
          template_type: string | null
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          blog_id: string
          created_at?: string
          featured_image_url?: string | null
          generation_source?: string | null
          id?: string
          page_data?: Json
          published_at?: string | null
          seo_analyzed_at?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_metrics?: Json | null
          seo_recommendations?: Json | null
          seo_score?: number | null
          seo_title?: string | null
          slug: string
          status?: string
          template_type?: string | null
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          blog_id?: string
          created_at?: string
          featured_image_url?: string | null
          generation_source?: string | null
          id?: string
          page_data?: Json
          published_at?: string | null
          seo_analyzed_at?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_metrics?: Json | null
          seo_recommendations?: Json | null
          seo_score?: number | null
          seo_title?: string | null
          slug?: string
          status?: string
          template_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      link_click_events: {
        Row: {
          blog_id: string
          browser: string | null
          country: string | null
          created_at: string | null
          device: string | null
          event_type: string
          id: string
          referrer: string | null
          session_id: string | null
          source: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string | null
        }
        Insert: {
          blog_id: string
          browser?: string | null
          country?: string | null
          created_at?: string | null
          device?: string | null
          event_type: string
          id?: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Update: {
          blog_id?: string
          browser?: string | null
          country?: string | null
          created_at?: string | null
          device?: string | null
          event_type?: string
          id?: string
          referrer?: string | null
          session_id?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_click_events_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      linking_settings: {
        Row: {
          auto_linking_enabled: boolean | null
          blog_id: string
          created_at: string | null
          id: string
          last_sync_at: string | null
          manual_urls: string[] | null
          sitemap_urls: string[] | null
        }
        Insert: {
          auto_linking_enabled?: boolean | null
          blog_id: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          manual_urls?: string[] | null
          sitemap_urls?: string[] | null
        }
        Update: {
          auto_linking_enabled?: boolean | null
          blog_id?: string
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          manual_urls?: string[] | null
          sitemap_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "linking_settings_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: true
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      market_intel_weekly: {
        Row: {
          analysis_period: string | null
          blog_id: string
          business_context: Json | null
          competitor_gaps: Json | null
          content_ideas: Json | null
          country: string
          created_at: string | null
          generated_at: string | null
          id: string
          keywords: Json | null
          market_snapshot: string | null
          query_cost_usd: number | null
          questions: Json | null
          raw_response: Json | null
          source: string | null
          sources_count: number | null
          territory_id: string | null
          trends: Json | null
          week_of: string
        }
        Insert: {
          analysis_period?: string | null
          blog_id: string
          business_context?: Json | null
          competitor_gaps?: Json | null
          content_ideas?: Json | null
          country?: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          keywords?: Json | null
          market_snapshot?: string | null
          query_cost_usd?: number | null
          questions?: Json | null
          raw_response?: Json | null
          source?: string | null
          sources_count?: number | null
          territory_id?: string | null
          trends?: Json | null
          week_of: string
        }
        Update: {
          analysis_period?: string | null
          blog_id?: string
          business_context?: Json | null
          competitor_gaps?: Json | null
          content_ideas?: Json | null
          country?: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          keywords?: Json | null
          market_snapshot?: string | null
          query_cost_usd?: number | null
          questions?: Json | null
          raw_response?: Json | null
          source?: string | null
          sources_count?: number | null
          territory_id?: string | null
          trends?: Json | null
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_intel_weekly_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_intel_weekly_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      model_pricing: {
        Row: {
          cost_per_1k_input_tokens: number
          cost_per_1k_output_tokens: number
          cost_per_image: number
          created_at: string | null
          id: string
          is_active: boolean | null
          model_name: string
          model_provider: string
          updated_at: string | null
        }
        Insert: {
          cost_per_1k_input_tokens?: number
          cost_per_1k_output_tokens?: number
          cost_per_image?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model_name: string
          model_provider: string
          updated_at?: string | null
        }
        Update: {
          cost_per_1k_input_tokens?: number
          cost_per_1k_output_tokens?: number
          cost_per_image?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          model_name?: string
          model_provider?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      niche_guard_logs: {
        Row: {
          action_type: string
          article_id: string | null
          blocked_reason: string | null
          blocked_terms: string[] | null
          blog_id: string | null
          created_at: string | null
          id: string
          niche_profile_id: string | null
          original_value: Json | null
          source_function: string
        }
        Insert: {
          action_type: string
          article_id?: string | null
          blocked_reason?: string | null
          blocked_terms?: string[] | null
          blog_id?: string | null
          created_at?: string | null
          id?: string
          niche_profile_id?: string | null
          original_value?: Json | null
          source_function: string
        }
        Update: {
          action_type?: string
          article_id?: string | null
          blocked_reason?: string | null
          blocked_terms?: string[] | null
          blog_id?: string | null
          created_at?: string | null
          id?: string
          niche_profile_id?: string | null
          original_value?: Json | null
          source_function?: string
        }
        Relationships: [
          {
            foreignKeyName: "niche_guard_logs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "niche_guard_logs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "niche_guard_logs_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "niche_guard_logs_niche_profile_id_fkey"
            columns: ["niche_profile_id"]
            isOneToOne: false
            referencedRelation: "niche_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      niche_profiles: {
        Row: {
          allowed_entities: string[]
          created_at: string | null
          created_by: string | null
          description: string | null
          display_name: string
          forbidden_entities: string[]
          id: string
          image_style: string | null
          intent: string
          max_h2: number
          max_words: number
          min_h2: number
          min_images: number
          min_paragraphs: number
          min_score: number
          min_words: number
          name: string
          required_terms: string[] | null
          seed_keywords: string[]
          target_score: number
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_entities?: string[]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name: string
          forbidden_entities?: string[]
          id?: string
          image_style?: string | null
          intent?: string
          max_h2?: number
          max_words?: number
          min_h2?: number
          min_images?: number
          min_paragraphs?: number
          min_score?: number
          min_words?: number
          name: string
          required_terms?: string[] | null
          seed_keywords?: string[]
          target_score?: number
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_entities?: string[]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_name?: string
          forbidden_entities?: string[]
          id?: string
          image_style?: string | null
          intent?: string
          max_h2?: number
          max_words?: number
          min_h2?: number
          min_images?: number
          min_paragraphs?: number
          min_score?: number
          min_words?: number
          name?: string
          required_terms?: string[] | null
          seed_keywords?: string[]
          target_score?: number
          tone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      omnicore_articles: {
        Row: {
          article_id: string
          created_at: string | null
          id: string
          omnicore_opportunity_id: string | null
          outline_id: string | null
          signal_id: string | null
          status: string | null
          word_count: number
          writer_model: string
        }
        Insert: {
          article_id: string
          created_at?: string | null
          id?: string
          omnicore_opportunity_id?: string | null
          outline_id?: string | null
          signal_id?: string | null
          status?: string | null
          word_count?: number
          writer_model: string
        }
        Update: {
          article_id?: string
          created_at?: string | null
          id?: string
          omnicore_opportunity_id?: string | null
          outline_id?: string | null
          signal_id?: string | null
          status?: string | null
          word_count?: number
          writer_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnicore_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnicore_articles_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "omnicore_articles_omnicore_opportunity_id_fkey"
            columns: ["omnicore_opportunity_id"]
            isOneToOne: false
            referencedRelation: "omnicore_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnicore_articles_outline_id_fkey"
            columns: ["outline_id"]
            isOneToOne: false
            referencedRelation: "omnicore_outlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnicore_articles_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "omnicore_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      omnicore_opportunities: {
        Row: {
          angle: string | null
          blog_id: string
          created_at: string | null
          id: string
          intent: string | null
          opportunity_id: string | null
          primary_kw: string | null
          secondary_kw: string[] | null
          signal_id: string | null
          slug: string | null
          status: string | null
          territory: string
          title: string
        }
        Insert: {
          angle?: string | null
          blog_id: string
          created_at?: string | null
          id?: string
          intent?: string | null
          opportunity_id?: string | null
          primary_kw?: string | null
          secondary_kw?: string[] | null
          signal_id?: string | null
          slug?: string | null
          status?: string | null
          territory: string
          title: string
        }
        Update: {
          angle?: string | null
          blog_id?: string
          created_at?: string | null
          id?: string
          intent?: string | null
          opportunity_id?: string | null
          primary_kw?: string | null
          secondary_kw?: string[] | null
          signal_id?: string | null
          slug?: string | null
          status?: string | null
          territory?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnicore_opportunities_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnicore_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "article_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnicore_opportunities_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "omnicore_signals"
            referencedColumns: ["id"]
          },
        ]
      }
      omnicore_outlines: {
        Row: {
          created_at: string | null
          id: string
          omnicore_opportunity_id: string
          outline: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          omnicore_opportunity_id: string
          outline: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          omnicore_opportunity_id?: string
          outline?: Json
        }
        Relationships: [
          {
            foreignKeyName: "omnicore_outlines_omnicore_opportunity_id_fkey"
            columns: ["omnicore_opportunity_id"]
            isOneToOne: false
            referencedRelation: "omnicore_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      omnicore_reviews: {
        Row: {
          approved: boolean | null
          created_at: string | null
          id: string
          issues: Json | null
          omnicore_article_id: string
          qa_model: string | null
          score: number | null
          suggestions: Json | null
          word_count_validated: number | null
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          id?: string
          issues?: Json | null
          omnicore_article_id: string
          qa_model?: string | null
          score?: number | null
          suggestions?: Json | null
          word_count_validated?: number | null
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          id?: string
          issues?: Json | null
          omnicore_article_id?: string
          qa_model?: string | null
          score?: number | null
          suggestions?: Json | null
          word_count_validated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "omnicore_reviews_omnicore_article_id_fkey"
            columns: ["omnicore_article_id"]
            isOneToOne: false
            referencedRelation: "omnicore_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      omnicore_signals: {
        Row: {
          blog_id: string
          created_at: string | null
          id: string
          intent: string | null
          niche: string
          sources: Json | null
          territory: string
          topic: string
          volume_hint: string | null
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          id?: string
          intent?: string | null
          niche: string
          sources?: Json | null
          territory: string
          topic: string
          volume_hint?: string | null
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          id?: string
          intent?: string | null
          niche?: string
          sources?: Json | null
          territory?: string
          topic?: string
          volume_hint?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omnicore_signals_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_notification_history: {
        Row: {
          blog_id: string
          id: string
          message: string | null
          notification_type: string
          opportunity_id: string
          read_at: string | null
          sent_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          blog_id: string
          id?: string
          message?: string | null
          notification_type: string
          opportunity_id: string
          read_at?: string | null
          sent_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          blog_id?: string
          id?: string
          message?: string | null
          notification_type?: string
          opportunity_id?: string
          read_at?: string | null
          sent_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_notification_history_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_notification_history_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "article_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_notifications: {
        Row: {
          blog_id: string
          created_at: string | null
          daily_digest: boolean | null
          digest_time: string | null
          email_address: string | null
          high_score_threshold: number | null
          id: string
          min_relevance_score: number | null
          notification_frequency: string | null
          notify_email: boolean | null
          notify_high_score_only: boolean | null
          notify_in_app: boolean | null
          notify_whatsapp: boolean | null
          updated_at: string | null
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          daily_digest?: boolean | null
          digest_time?: string | null
          email_address?: string | null
          high_score_threshold?: number | null
          id?: string
          min_relevance_score?: number | null
          notification_frequency?: string | null
          notify_email?: boolean | null
          notify_high_score_only?: boolean | null
          notify_in_app?: boolean | null
          notify_whatsapp?: boolean | null
          updated_at?: string | null
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          daily_digest?: boolean | null
          digest_time?: string | null
          email_address?: string | null
          high_score_threshold?: number | null
          id?: string
          min_relevance_score?: number | null
          notification_frequency?: string | null
          notify_email?: boolean | null
          notify_high_score_only?: boolean | null
          notify_in_app?: boolean | null
          notify_whatsapp?: boolean | null
          updated_at?: string | null
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_notifications_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_learning_log: {
        Row: {
          analysis_period_end: string
          analysis_period_start: string
          applied_at: string | null
          blog_id: string
          decision_rationale: string | null
          id: string
          new_distribution: Json
          performance_data: Json
          previous_distribution: Json
        }
        Insert: {
          analysis_period_end: string
          analysis_period_start: string
          applied_at?: string | null
          blog_id: string
          decision_rationale?: string | null
          id?: string
          new_distribution: Json
          performance_data: Json
          previous_distribution: Json
        }
        Update: {
          analysis_period_end?: string
          analysis_period_start?: string
          applied_at?: string | null
          blog_id?: string
          decision_rationale?: string | null
          id?: string
          new_distribution?: Json
          performance_data?: Json
          previous_distribution?: Json
        }
        Relationships: [
          {
            foreignKeyName: "performance_learning_log_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          age_range: string | null
          blog_id: string
          challenges: string[] | null
          created_at: string
          description: string | null
          goals: string[] | null
          id: string
          name: string
          objections: string[] | null
          preferred_channels: string[] | null
          problems: string[] | null
          profession: string | null
          solutions: string[] | null
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          blog_id: string
          challenges?: string[] | null
          created_at?: string
          description?: string | null
          goals?: string[] | null
          id?: string
          name: string
          objections?: string[] | null
          preferred_channels?: string[] | null
          problems?: string[] | null
          profession?: string | null
          solutions?: string[] | null
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          blog_id?: string
          challenges?: string[] | null
          created_at?: string
          description?: string | null
          goals?: string[] | null
          id?: string
          name?: string
          objections?: string[] | null
          preferred_channels?: string[] | null
          problems?: string[] | null
          profession?: string | null
          solutions?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          articles_per_month: number
          blogs_limit: number
          created_at: string
          custom_domain_enabled: boolean | null
          features: Json
          id: string
          keywords_limit: number
          monthly_price_brl: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          team_members: number
          yearly_price_brl: number
        }
        Insert: {
          articles_per_month?: number
          blogs_limit?: number
          created_at?: string
          custom_domain_enabled?: boolean | null
          features?: Json
          id?: string
          keywords_limit?: number
          monthly_price_brl?: number
          plan: Database["public"]["Enums"]["subscription_plan"]
          team_members?: number
          yearly_price_brl?: number
        }
        Update: {
          articles_per_month?: number
          blogs_limit?: number
          created_at?: string
          custom_domain_enabled?: boolean | null
          features?: Json
          id?: string
          keywords_limit?: number
          monthly_price_brl?: number
          plan?: Database["public"]["Enums"]["subscription_plan"]
          team_members?: number
          yearly_price_brl?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          blog_objective: string | null
          company_name: string | null
          created_at: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          onboarding_progress: Json | null
          phone: string | null
          preferred_language: string | null
          referral_source: string | null
          updated_at: string
          user_id: string
          user_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          blog_objective?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          phone?: string | null
          preferred_language?: string | null
          referral_source?: string | null
          updated_at?: string
          user_id: string
          user_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          blog_objective?: string | null
          company_name?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          onboarding_progress?: Json | null
          phone?: string | null
          preferred_language?: string | null
          referral_source?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
        }
        Relationships: []
      }
      prompt_type_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          prompt_content: Json
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          prompt_content: Json
          version?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          prompt_content?: Json
          version?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quality_gate_audits: {
        Row: {
          approved: boolean
          article_id: string
          attempt_number: number | null
          auto_fix_applied: boolean | null
          auto_fix_changes: Json | null
          blog_id: string
          compliance_passed: boolean | null
          failures: Json | null
          fix_suggestions: Json | null
          id: string
          risk_level: string | null
          seo_score: number | null
          similarity_score: number | null
          validated_at: string | null
          validator_version: string | null
          warnings: Json | null
          word_count: number | null
        }
        Insert: {
          approved: boolean
          article_id: string
          attempt_number?: number | null
          auto_fix_applied?: boolean | null
          auto_fix_changes?: Json | null
          blog_id: string
          compliance_passed?: boolean | null
          failures?: Json | null
          fix_suggestions?: Json | null
          id?: string
          risk_level?: string | null
          seo_score?: number | null
          similarity_score?: number | null
          validated_at?: string | null
          validator_version?: string | null
          warnings?: Json | null
          word_count?: number | null
        }
        Update: {
          approved?: boolean
          article_id?: string
          attempt_number?: number | null
          auto_fix_applied?: boolean | null
          auto_fix_changes?: Json | null
          blog_id?: string
          compliance_passed?: boolean | null
          failures?: Json | null
          fix_suggestions?: Json | null
          id?: string
          risk_level?: string | null
          seo_score?: number | null
          similarity_score?: number | null
          validated_at?: string | null
          validator_version?: string | null
          warnings?: Json | null
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_gate_audits_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_gate_audits_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "quality_gate_audits_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_goal_alerts: {
        Row: {
          article_id: string | null
          created_at: string | null
          current_value: number
          goal_id: string | null
          id: string
          message: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          article_id?: string | null
          created_at?: string | null
          current_value: number
          goal_id?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          article_id?: string | null
          created_at?: string | null
          current_value?: number
          goal_id?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_goal_alerts_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_goal_alerts_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "reading_goal_alerts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "reading_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_goals: {
        Row: {
          alert_threshold: number
          blog_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          metric_type: string
          notify_email: boolean | null
          notify_in_app: boolean | null
          target_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_threshold: number
          blog_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metric_type: string
          notify_email?: boolean | null
          notify_in_app?: boolean | null
          target_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_threshold?: number
          blog_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          metric_type?: string
          notify_email?: boolean | null
          notify_in_app?: boolean | null
          target_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_goals_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      real_leads: {
        Row: {
          article_id: string | null
          blog_id: string
          contact_data: Json | null
          created_at: string | null
          id: string
          lead_type: string
          session_id: string | null
          source_url: string | null
          visitor_id: string | null
        }
        Insert: {
          article_id?: string | null
          blog_id: string
          contact_data?: Json | null
          created_at?: string | null
          id?: string
          lead_type: string
          session_id?: string | null
          source_url?: string | null
          visitor_id?: string | null
        }
        Update: {
          article_id?: string | null
          blog_id?: string
          contact_data?: Json | null
          created_at?: string | null
          id?: string
          lead_type?: string
          session_id?: string | null
          source_url?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "real_leads_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "real_leads_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
          {
            foreignKeyName: "real_leads_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_conversions: {
        Row: {
          commission_amount_cents: number
          converted_at: string
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_due_date: string
          referral_id: string
          referred_user_id: string
          status: string
          subscription_amount_cents: number
          subscription_id: string | null
          subscription_plan: string | null
        }
        Insert: {
          commission_amount_cents: number
          converted_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_due_date: string
          referral_id: string
          referred_user_id: string
          status?: string
          subscription_amount_cents: number
          subscription_id?: string | null
          subscription_plan?: string | null
        }
        Update: {
          commission_amount_cents?: number
          converted_at?: string
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_due_date?: string
          referral_id?: string
          referred_user_id?: string
          status?: string
          subscription_amount_cents?: number
          subscription_id?: string | null
          subscription_plan?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_conversions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          commission_percentage: number
          id: string
          is_program_active: boolean
          minimum_payout_cents: number
          payment_deadline_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_percentage?: number
          id?: string
          is_program_active?: boolean
          minimum_payout_cents?: number
          payment_deadline_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_percentage?: number
          id?: string
          is_program_active?: boolean
          minimum_payout_cents?: number
          payment_deadline_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      referrals: {
        Row: {
          click_count: number | null
          created_at: string
          id: string
          is_active: boolean | null
          referral_code: string
          referrer_user_id: string
        }
        Insert: {
          click_count?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          referral_code: string
          referrer_user_id: string
        }
        Update: {
          click_count?: number | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          referral_code?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      score_change_log: {
        Row: {
          article_id: string
          change_reason: string
          content_version: number | null
          created_at: string | null
          id: string
          metadata: Json | null
          new_score: number | null
          old_score: number | null
          triggered_by: string
        }
        Insert: {
          article_id: string
          change_reason: string
          content_version?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_score?: number | null
          old_score?: number | null
          triggered_by: string
        }
        Update: {
          article_id?: string
          change_reason?: string
          content_version?: number | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          new_score?: number | null
          old_score?: number | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_change_log_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_change_log_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      section_analytics: {
        Row: {
          article_id: string | null
          created_at: string | null
          entered_at: string | null
          id: string
          section_id: string
          section_index: number
          section_title: string
          session_id: string
          time_in_view: number | null
        }
        Insert: {
          article_id?: string | null
          created_at?: string | null
          entered_at?: string | null
          id?: string
          section_id: string
          section_index: number
          section_title: string
          session_id: string
          time_in_view?: number | null
        }
        Update: {
          article_id?: string | null
          created_at?: string | null
          entered_at?: string | null
          id?: string
          section_id?: string
          section_index?: number
          section_title?: string
          session_id?: string
          time_in_view?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "section_analytics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_analytics_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      seo_ai_runs: {
        Row: {
          action: string
          after: Json | null
          after_score: number | null
          article_id: string
          before: Json | null
          before_score: number | null
          created_at: string | null
          error_message: string | null
          id: string
          keyword_density_after: Json | null
          keyword_density_before: Json | null
          model: string | null
          provider: string
          status: string
          word_count_after: number | null
          word_count_before: number | null
        }
        Insert: {
          action: string
          after?: Json | null
          after_score?: number | null
          article_id: string
          before?: Json | null
          before_score?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          keyword_density_after?: Json | null
          keyword_density_before?: Json | null
          model?: string | null
          provider: string
          status: string
          word_count_after?: number | null
          word_count_before?: number | null
        }
        Update: {
          action?: string
          after?: Json | null
          after_score?: number | null
          article_id?: string
          before?: Json | null
          before_score?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          keyword_density_after?: Json | null
          keyword_density_before?: Json | null
          model?: string | null
          provider?: string
          status?: string
          word_count_after?: number | null
          word_count_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seo_ai_runs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_ai_runs_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "elite_engine_analytics"
            referencedColumns: ["article_id"]
          },
        ]
      }
      seo_daily_snapshots: {
        Row: {
          articles_above_80: number | null
          articles_below_60: number | null
          avg_score: number
          blog_id: string
          created_at: string | null
          id: string
          optimizations_count: number | null
          snapshot_date: string
          total_articles: number
        }
        Insert: {
          articles_above_80?: number | null
          articles_below_60?: number | null
          avg_score: number
          blog_id: string
          created_at?: string | null
          id?: string
          optimizations_count?: number | null
          snapshot_date: string
          total_articles?: number
        }
        Update: {
          articles_above_80?: number | null
          articles_below_60?: number | null
          avg_score?: number
          blog_id?: string
          created_at?: string | null
          id?: string
          optimizations_count?: number | null
          snapshot_date?: string
          total_articles?: number
        }
        Relationships: [
          {
            foreignKeyName: "seo_daily_snapshots_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_weekly_reports: {
        Row: {
          articles_below_60: number | null
          articles_improved: number | null
          avg_seo_score: number | null
          blog_id: string
          created_at: string | null
          id: string
          score_change: number | null
          sent_at: string | null
          top_suggestions: Json | null
          total_articles: number | null
          user_id: string
          weak_articles: Json | null
          week_end: string
          week_start: string
        }
        Insert: {
          articles_below_60?: number | null
          articles_improved?: number | null
          avg_seo_score?: number | null
          blog_id: string
          created_at?: string | null
          id?: string
          score_change?: number | null
          sent_at?: string | null
          top_suggestions?: Json | null
          total_articles?: number | null
          user_id: string
          weak_articles?: Json | null
          week_end: string
          week_start: string
        }
        Update: {
          articles_below_60?: number | null
          articles_improved?: number | null
          avg_seo_score?: number | null
          blog_id?: string
          created_at?: string | null
          id?: string
          score_change?: number | null
          sent_at?: string | null
          top_suggestions?: Json | null
          total_articles?: number | null
          user_id?: string
          weak_articles?: Json | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_weekly_reports_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      serp_analysis_cache: {
        Row: {
          analyzed_at: string | null
          avg_h2: number | null
          avg_images: number | null
          avg_words: number | null
          blog_id: string | null
          common_terms: string[] | null
          competitors_count: number | null
          created_at: string | null
          expires_at: string | null
          id: string
          keyword: string
          keyword_frequency_map: Json | null
          keyword_presence: Json | null
          matrix: Json
          max_h2: number | null
          max_images: number | null
          max_words: number | null
          meta_patterns: Json | null
          min_h2: number | null
          min_images: number | null
          min_words: number | null
          niche_profile_id: string | null
          scrape_method: string | null
          serp_hash: string | null
          territory: string | null
        }
        Insert: {
          analyzed_at?: string | null
          avg_h2?: number | null
          avg_images?: number | null
          avg_words?: number | null
          blog_id?: string | null
          common_terms?: string[] | null
          competitors_count?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          keyword: string
          keyword_frequency_map?: Json | null
          keyword_presence?: Json | null
          matrix: Json
          max_h2?: number | null
          max_images?: number | null
          max_words?: number | null
          meta_patterns?: Json | null
          min_h2?: number | null
          min_images?: number | null
          min_words?: number | null
          niche_profile_id?: string | null
          scrape_method?: string | null
          serp_hash?: string | null
          territory?: string | null
        }
        Update: {
          analyzed_at?: string | null
          avg_h2?: number | null
          avg_images?: number | null
          avg_words?: number | null
          blog_id?: string | null
          common_terms?: string[] | null
          competitors_count?: number | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          keyword?: string
          keyword_frequency_map?: Json | null
          keyword_presence?: Json | null
          matrix?: Json
          max_h2?: number | null
          max_images?: number | null
          max_words?: number | null
          meta_patterns?: Json | null
          min_h2?: number | null
          min_images?: number | null
          min_words?: number | null
          niche_profile_id?: string | null
          scrape_method?: string | null
          serp_hash?: string | null
          territory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "serp_analysis_cache_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "serp_analysis_cache_niche_profile_id_fkey"
            columns: ["niche_profile_id"]
            isOneToOne: false
            referencedRelation: "niche_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          billing_required: boolean | null
          canceled_at: string | null
          created_at: string
          created_by_admin: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          internal_notes: string | null
          is_internal_account: boolean | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          billing_required?: boolean | null
          canceled_at?: string | null
          created_at?: string
          created_by_admin?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          internal_notes?: string | null
          is_internal_account?: boolean | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          billing_required?: boolean | null
          canceled_at?: string | null
          created_at?: string
          created_by_admin?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          internal_notes?: string | null
          is_internal_account?: boolean | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_activity_log: {
        Row: {
          action: string
          blog_id: string
          created_at: string | null
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          blog_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          blog_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_activity_log_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          blog_id: string
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: string
          token: string
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role?: string
          token: string
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          accepted_at: string | null
          blog_id: string
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          role: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          blog_id: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          blog_id?: string
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      template_analytics: {
        Row: {
          avg_time_on_page: number | null
          blog_id: string
          bounce_rate: number | null
          clicks: number | null
          conversions: number | null
          created_at: string | null
          cta_clicks: number | null
          date: string
          id: string
          template_id: string
          views: number | null
        }
        Insert: {
          avg_time_on_page?: number | null
          blog_id: string
          bounce_rate?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          cta_clicks?: number | null
          date?: string
          id?: string
          template_id: string
          views?: number | null
        }
        Update: {
          avg_time_on_page?: number | null
          blog_id?: string
          bounce_rate?: number | null
          clicks?: number | null
          conversions?: number | null
          created_at?: string | null
          cta_clicks?: number | null
          date?: string
          id?: string
          template_id?: string
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "template_analytics_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          blog_id: string | null
          created_at: string | null
          dns_status: Json | null
          domain: string
          domain_type: string
          error_message: string | null
          id: string
          is_primary: boolean | null
          status: string | null
          tenant_id: string | null
          updated_at: string | null
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          blog_id?: string | null
          created_at?: string | null
          dns_status?: Json | null
          domain: string
          domain_type?: string
          error_message?: string | null
          id?: string
          is_primary?: boolean | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          blog_id?: string | null
          created_at?: string | null
          dns_status?: Json | null
          domain?: string
          domain_type?: string
          error_message?: string | null
          id?: string
          is_primary?: boolean | null
          status?: string | null
          tenant_id?: string | null
          updated_at?: string | null
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          role: string | null
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string | null
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          role?: string | null
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          account_type: string | null
          billing_email: string | null
          billing_required: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          owner_user_id: string | null
          plan: Database["public"]["Enums"]["subscription_plan"] | null
          settings: Json | null
          slug: string
          status: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          billing_email?: string | null
          billing_required?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          settings?: Json | null
          slug: string
          status?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          billing_email?: string | null
          billing_required?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"] | null
          settings?: Json | null
          slug?: string
          status?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      territories: {
        Row: {
          blog_id: string
          city: string | null
          country: string
          created_at: string | null
          id: string
          is_active: boolean | null
          lat: number | null
          lng: number | null
          neighborhood_tags: string[] | null
          official_name: string | null
          place_id: string | null
          radius_km: number | null
          state: string | null
          updated_at: string | null
          validated_at: string | null
        }
        Insert: {
          blog_id: string
          city?: string | null
          country: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          neighborhood_tags?: string[] | null
          official_name?: string | null
          place_id?: string | null
          radius_km?: number | null
          state?: string | null
          updated_at?: string | null
          validated_at?: string | null
        }
        Update: {
          blog_id?: string
          city?: string | null
          country?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          neighborhood_tags?: string[] | null
          official_name?: string | null
          place_id?: string | null
          radius_km?: number | null
          state?: string | null
          updated_at?: string | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territories_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_tracking: {
        Row: {
          articles_generated: number | null
          articles_limit: number | null
          blogs_count: number | null
          blogs_limit: number | null
          created_at: string | null
          ebooks_generated: number | null
          ebooks_limit: number | null
          id: string
          images_generated: number | null
          keywords_limit: number | null
          keywords_used: number | null
          month: string
          radar_searches_used: number | null
          team_members_count: number | null
          team_members_limit: number | null
          territories_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          articles_generated?: number | null
          articles_limit?: number | null
          blogs_count?: number | null
          blogs_limit?: number | null
          created_at?: string | null
          ebooks_generated?: number | null
          ebooks_limit?: number | null
          id?: string
          images_generated?: number | null
          keywords_limit?: number | null
          keywords_used?: number | null
          month: string
          radar_searches_used?: number | null
          team_members_count?: number | null
          team_members_limit?: number | null
          territories_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          articles_generated?: number | null
          articles_limit?: number | null
          blogs_count?: number | null
          blogs_limit?: number | null
          created_at?: string | null
          ebooks_generated?: number | null
          ebooks_limit?: number | null
          id?: string
          images_generated?: number | null
          keywords_limit?: number | null
          keywords_used?: number | null
          month?: string
          radar_searches_used?: number | null
          team_members_count?: number | null
          team_members_limit?: number | null
          territories_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          blog_id: string | null
          id: string
          notified: boolean | null
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          blog_id?: string | null
          id?: string
          notified?: boolean | null
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          blog_id?: string | null
          id?: string
          notified?: boolean | null
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_library: {
        Row: {
          blog_id: string
          created_at: string
          description: string | null
          file_name: string
          file_url: string
          id: string
          is_active: boolean | null
          type: string
        }
        Insert: {
          blog_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_url: string
          id?: string
          is_active?: boolean | null
          type: string
        }
        Update: {
          blog_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_url?: string
          id?: string
          is_active?: boolean | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_library_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      weekly_report_settings: {
        Row: {
          blog_id: string | null
          created_at: string | null
          email_address: string
          id: string
          include_opportunities: boolean | null
          include_performance: boolean | null
          include_recommendations: boolean | null
          is_enabled: boolean | null
          last_sent_at: string | null
          send_day: number | null
          send_hour: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blog_id?: string | null
          created_at?: string | null
          email_address: string
          id?: string
          include_opportunities?: boolean | null
          include_performance?: boolean | null
          include_recommendations?: boolean | null
          is_enabled?: boolean | null
          last_sent_at?: string | null
          send_day?: number | null
          send_hour?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blog_id?: string | null
          created_at?: string | null
          email_address?: string
          id?: string
          include_opportunities?: boolean | null
          include_performance?: boolean | null
          include_recommendations?: boolean | null
          is_enabled?: boolean | null
          last_sent_at?: string | null
          send_day?: number | null
          send_hour?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_report_settings_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cms_integrations_decrypted: {
        Row: {
          access_token: string | null
          api_key: string | null
          api_secret: string | null
          auth_type: string | null
          auto_publish: boolean | null
          blog_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_status: string | null
          platform: string | null
          refresh_token: string | null
          site_url: string | null
          token_expires_at: string | null
          updated_at: string | null
          username: string | null
          wordpress_site_id: string | null
        }
        Insert: {
          access_token?: never
          api_key?: never
          api_secret?: never
          auth_type?: string | null
          auto_publish?: boolean | null
          blog_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          platform?: string | null
          refresh_token?: never
          site_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          username?: string | null
          wordpress_site_id?: string | null
        }
        Update: {
          access_token?: never
          api_key?: never
          api_secret?: never
          auth_type?: string | null
          auto_publish?: boolean | null
          blog_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          platform?: string | null
          refresh_token?: never
          site_url?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
          username?: string | null
          wordpress_site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_integrations_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      elite_engine_analytics: {
        Row: {
          angle: string | null
          article_goal: string | null
          article_id: string | null
          blocks_hash: string | null
          blocks_used: string[] | null
          blog_id: string | null
          city: string | null
          city_size: string | null
          collision_avoided: boolean | null
          collision_scope: string | null
          created_at: string | null
          density_strategy: string | null
          engine_version: string | null
          funnel_mode: string | null
          geo_language_style: string | null
          h2_pattern_hash: string | null
          high_similarity_warning: boolean | null
          niche: string | null
          rhythm_profile: string | null
          similarity_score: number | null
          structure_hash: string | null
          structure_type: string | null
          style_mode: string | null
          variant: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      elite_engine_angle_distribution: {
        Row: {
          angle: string | null
          blog_id: string | null
          count: number | null
          niche: string | null
          percentage: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      elite_engine_collision_rate: {
        Row: {
          blog_id: string | null
          city: string | null
          collision_rate: number | null
          collisions_avoided: number | null
          niche: string | null
          total_articles: number | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
      elite_engine_structure_distribution: {
        Row: {
          blog_id: string | null
          count: number | null
          percentage: number | null
          structure_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_blog_id_fkey"
            columns: ["blog_id"]
            isOneToOne: false
            referencedRelation: "blogs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_payment_due_date: {
        Args: { start_date: string }
        Returns: string
      }
      check_article_rate_limit: {
        Args: { p_blog_id: string; p_user_id: string }
        Returns: boolean
      }
      claim_queue_items: {
        Args: { p_limit?: number }
        Returns: {
          article_goal: string
          blog_id: string
          chunk_content: string
          funnel_mode: string
          funnel_stage: string
          generation_source: string
          id: string
          keywords: string[]
          persona_id: string
          suggested_theme: string
        }[]
      }
      decrypt_credential: {
        Args: { ciphertext: string; key_id: string }
        Returns: string
      }
      encrypt_credential: {
        Args: { key_id: string; plaintext: string }
        Returns: string
      }
      generate_referral_code: { Args: never; Returns: string }
      get_user_tenant_ids: { Args: never; Returns: string[] }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { role_name: string }; Returns: boolean }
      increment_intent_count: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      increment_share_count: {
        Args: { article_id: string }
        Returns: undefined
      }
      increment_view_count: { Args: { article_id: string }; Returns: undefined }
      increment_visibility_count: {
        Args: { p_article_id: string }
        Returns: undefined
      }
      is_blog_owner: { Args: { p_blog_id: string }; Returns: boolean }
      is_blog_team_admin: { Args: { p_blog_id: string }; Returns: boolean }
      is_team_member_of_blog:
        | { Args: { p_blog_id: string }; Returns: boolean }
        | { Args: { p_blog_id: string; p_user_id: string }; Returns: boolean }
      is_team_member_safe: {
        Args: { p_blog_id: string; p_user_id: string }
        Returns: boolean
      }
      is_tenant_admin: { Args: { p_tenant_id: string }; Returns: boolean }
      is_tenant_member: { Args: { p_tenant_id: string }; Returns: boolean }
      normalize_title_for_fingerprint: {
        Args: { input_title: string }
        Returns: string
      }
      recalculate_queue_dates: { Args: { p_blog_id: string }; Returns: number }
      reset_brand_agent_daily_tokens: { Args: never; Returns: undefined }
      resolve_domain: {
        Args: { p_hostname: string }
        Returns: {
          blog_id: string
          domain: string
          domain_type: string
          status: string
          tenant_id: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      account_type:
        | "self_registered"
        | "internal_team"
        | "client_free"
        | "client_paid"
      app_role:
        | "admin"
        | "user"
        | "platform_admin"
        | "staff_finance"
        | "staff_content"
        | "staff_support"
      subscription_plan: "free" | "essential" | "plus" | "scale" | "internal"
      subscription_status:
        | "active"
        | "trialing"
        | "canceled"
        | "past_due"
        | "incomplete"
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
      account_type: [
        "self_registered",
        "internal_team",
        "client_free",
        "client_paid",
      ],
      app_role: [
        "admin",
        "user",
        "platform_admin",
        "staff_finance",
        "staff_content",
        "staff_support",
      ],
      subscription_plan: ["free", "essential", "plus", "scale", "internal"],
      subscription_status: [
        "active",
        "trialing",
        "canceled",
        "past_due",
        "incomplete",
      ],
    },
  },
} as const
