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
            foreignKeyName: "article_internal_links_target_article_id_fkey"
            columns: ["target_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      article_opportunities: {
        Row: {
          blog_id: string
          converted_article_id: string | null
          converted_at: string | null
          created_at: string | null
          id: string
          relevance_factors: Json | null
          relevance_score: number | null
          source: string | null
          status: string | null
          suggested_keywords: string[] | null
          suggested_outline: Json | null
          suggested_title: string
          trend_source: string | null
          updated_at: string | null
        }
        Insert: {
          blog_id: string
          converted_article_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          relevance_factors?: Json | null
          relevance_score?: number | null
          source?: string | null
          status?: string | null
          suggested_keywords?: string[] | null
          suggested_outline?: Json | null
          suggested_title: string
          trend_source?: string | null
          updated_at?: string | null
        }
        Update: {
          blog_id?: string
          converted_article_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          id?: string
          relevance_factors?: Json | null
          relevance_score?: number | null
          source?: string | null
          status?: string | null
          suggested_keywords?: string[] | null
          suggested_outline?: Json | null
          suggested_title?: string
          trend_source?: string | null
          updated_at?: string | null
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
            foreignKeyName: "article_opportunities_converted_article_id_fkey"
            columns: ["converted_article_id"]
            isOneToOne: false
            referencedRelation: "articles"
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
        ]
      }
      article_versions: {
        Row: {
          article_id: string
          change_description: string | null
          change_type: string
          content: string | null
          created_at: string | null
          created_by: string | null
          excerpt: string | null
          faq: Json | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          title: string
          version_number: number
        }
        Insert: {
          article_id: string
          change_description?: string | null
          change_type: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          faq?: Json | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          title: string
          version_number?: number
        }
        Update: {
          article_id?: string
          change_description?: string | null
          change_type?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          excerpt?: string | null
          faq?: Json | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          title?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_versions_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          article_goal: string | null
          blog_id: string
          category: string | null
          content: string | null
          content_images: Json | null
          created_at: string
          excerpt: string | null
          external_post_id: string | null
          external_post_url: string | null
          faq: Json | null
          featured_image_alt: string | null
          featured_image_url: string | null
          funnel_mode: string | null
          funnel_stage: string | null
          generation_source: string | null
          highlights: Json | null
          id: string
          keywords: string[] | null
          meta_description: string | null
          mini_case: Json | null
          published_at: string | null
          reading_time: number | null
          scheduled_at: string | null
          share_count: number | null
          slug: string
          social_share_count: Json | null
          status: string | null
          tags: string[] | null
          target_persona_id: string | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          article_goal?: string | null
          blog_id: string
          category?: string | null
          content?: string | null
          content_images?: Json | null
          created_at?: string
          excerpt?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          faq?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          funnel_mode?: string | null
          funnel_stage?: string | null
          generation_source?: string | null
          highlights?: Json | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          mini_case?: Json | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          share_count?: number | null
          slug: string
          social_share_count?: Json | null
          status?: string | null
          tags?: string[] | null
          target_persona_id?: string | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          article_goal?: string | null
          blog_id?: string
          category?: string | null
          content?: string | null
          content_images?: Json | null
          created_at?: string
          excerpt?: string | null
          external_post_id?: string | null
          external_post_url?: string | null
          faq?: Json | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          funnel_mode?: string | null
          funnel_stage?: string | null
          generation_source?: string | null
          highlights?: Json | null
          id?: string
          keywords?: string[] | null
          meta_description?: string | null
          mini_case?: Json | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          share_count?: number | null
          slug?: string
          social_share_count?: Json | null
          status?: string | null
          tags?: string[] | null
          target_persona_id?: string | null
          title?: string
          updated_at?: string
          view_count?: number | null
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
            foreignKeyName: "articles_target_persona_id_fkey"
            columns: ["target_persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
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
          auto_publish: boolean | null
          blog_id: string
          created_at: string | null
          frequency: string | null
          generate_images: boolean | null
          id: string
          is_active: boolean | null
          niche_keywords: string[] | null
          preferred_days: string[] | null
          preferred_time: string | null
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          articles_per_period?: number | null
          auto_publish?: boolean | null
          blog_id: string
          created_at?: string | null
          frequency?: string | null
          generate_images?: boolean | null
          id?: string
          is_active?: boolean | null
          niche_keywords?: string[] | null
          preferred_days?: string[] | null
          preferred_time?: string | null
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          articles_per_period?: number | null
          auto_publish?: boolean | null
          blog_id?: string
          created_at?: string | null
          frequency?: string | null
          generate_images?: boolean | null
          id?: string
          is_active?: boolean | null
          niche_keywords?: string[] | null
          preferred_days?: string[] | null
          preferred_time?: string | null
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
          layout_template: string | null
          logo_background_color: string | null
          logo_negative_background_color: string | null
          logo_negative_url: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean | null
          platform_subdomain: string | null
          primary_color: string | null
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
          layout_template?: string | null
          logo_background_color?: string | null
          logo_negative_background_color?: string | null
          logo_negative_url?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean | null
          platform_subdomain?: string | null
          primary_color?: string | null
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
          layout_template?: string | null
          logo_background_color?: string | null
          logo_negative_background_color?: string | null
          logo_negative_url?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean | null
          platform_subdomain?: string | null
          primary_color?: string | null
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
            foreignKeyName: "blogs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profile: {
        Row: {
          blog_id: string
          brand_keywords: string[] | null
          company_name: string | null
          concepts: string[] | null
          country: string | null
          created_at: string
          default_template_id: string | null
          desires: string[] | null
          id: string
          is_library_enabled: boolean | null
          language: string | null
          long_description: string | null
          niche: string | null
          pain_points: string[] | null
          project_name: string | null
          target_audience: string | null
          tone_of_voice: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          blog_id: string
          brand_keywords?: string[] | null
          company_name?: string | null
          concepts?: string[] | null
          country?: string | null
          created_at?: string
          default_template_id?: string | null
          desires?: string[] | null
          id?: string
          is_library_enabled?: boolean | null
          language?: string | null
          long_description?: string | null
          niche?: string | null
          pain_points?: string[] | null
          project_name?: string | null
          target_audience?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          blog_id?: string
          brand_keywords?: string[] | null
          company_name?: string | null
          concepts?: string[] | null
          country?: string | null
          created_at?: string
          default_template_id?: string | null
          desires?: string[] | null
          id?: string
          is_library_enabled?: boolean | null
          language?: string | null
          long_description?: string | null
          niche?: string | null
          pain_points?: string[] | null
          project_name?: string | null
          target_audience?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          whatsapp?: string | null
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
            foreignKeyName: "cluster_articles_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "content_clusters"
            referencedColumns: ["id"]
          },
        ]
      }
      cms_integrations: {
        Row: {
          api_key: string | null
          api_secret: string | null
          auto_publish: boolean | null
          blog_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          last_sync_status: string | null
          platform: string
          site_url: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          auto_publish?: boolean | null
          blog_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          platform: string
          site_url: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          auto_publish?: boolean | null
          blog_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          last_sync_status?: string | null
          platform?: string
          site_url?: string
          updated_at?: string | null
          username?: string | null
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
            foreignKeyName: "cms_publish_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "cms_integrations"
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
          email_address: string | null
          id: string
          min_relevance_score: number | null
          notify_email: boolean | null
          notify_in_app: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blog_id: string
          created_at?: string | null
          email_address?: string | null
          id?: string
          min_relevance_score?: number | null
          notify_email?: boolean | null
          notify_in_app?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blog_id?: string
          created_at?: string | null
          email_address?: string | null
          id?: string
          min_relevance_score?: number | null
          notify_email?: boolean | null
          notify_in_app?: boolean | null
          updated_at?: string | null
          user_id?: string
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
          created_at: string
          full_name: string | null
          id: string
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
          created_at?: string
          full_name?: string | null
          id?: string
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
          created_at?: string
          full_name?: string | null
          id?: string
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
          team_members_count: number | null
          team_members_limit: number | null
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
          team_members_count?: number | null
          team_members_limit?: number | null
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
          team_members_count?: number | null
          team_members_limit?: number | null
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
      [_ in never]: never
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
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_share_count: {
        Args: { article_id: string }
        Returns: undefined
      }
      increment_view_count: { Args: { article_id: string }; Returns: undefined }
      is_team_member_of_blog: {
        Args: { p_blog_id: string; p_user_id: string }
        Returns: boolean
      }
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
