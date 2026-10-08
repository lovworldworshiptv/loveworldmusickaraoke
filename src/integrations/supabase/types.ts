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
      admin_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      albums: {
        Row: {
          artist: string
          cover_url: string | null
          created_at: string
          id: string
          is_top: boolean
          title: string
        }
        Insert: {
          artist?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          is_top?: boolean
          title: string
        }
        Update: {
          artist?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          is_top?: boolean
          title?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      articles: {
        Row: {
          audio_url: string | null
          author: string
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          is_published: boolean
          published_at: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          audio_url?: string | null
          author?: string
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          audio_url?: string | null
          author?: string
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          is_published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_visible: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_visible?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      challenge_bonuses_awarded: {
        Row: {
          awarded_at: string
          bonus_key: string
          challenge_id: string
          id: string
          points: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          bonus_key: string
          challenge_id: string
          id?: string
          points: number
          user_id: string
        }
        Update: {
          awarded_at?: string
          bonus_key?: string
          challenge_id?: string
          id?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_bonuses_awarded_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_entries: {
        Row: {
          admin_notes: string | null
          approved_at: string | null
          approved_by: string | null
          challenge_id: string
          created_at: string
          full_name: string | null
          id: string
          is_premium_free: boolean
          kingschat_username: string | null
          paid_amount: number
          payment_proof_url: string | null
          referred_by_user_id: string | null
          status: string
          updated_at: string
          user_id: string
          zone: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          challenge_id: string
          created_at?: string
          full_name?: string | null
          id?: string
          is_premium_free?: boolean
          kingschat_username?: string | null
          paid_amount?: number
          payment_proof_url?: string | null
          referred_by_user_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          zone?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          challenge_id?: string
          created_at?: string
          full_name?: string | null
          id?: string
          is_premium_free?: boolean
          kingschat_username?: string | null
          paid_amount?: number
          payment_proof_url?: string | null
          referred_by_user_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_game_logs: {
        Row: {
          challenge_id: string
          completed_at: string
          counted_toward_score: boolean
          difficulty: string | null
          id: string
          mode: string
          score: number
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string
          counted_toward_score?: boolean
          difficulty?: string | null
          id?: string
          mode: string
          score?: number
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string
          counted_toward_score?: boolean
          difficulty?: string | null
          id?: string
          mode?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_game_logs_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_referrals: {
        Row: {
          awarded: boolean
          challenge_id: string
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          awarded?: boolean
          challenge_id: string
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          awarded?: boolean
          challenge_id?: string
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_referrals_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_scores: {
        Row: {
          articles_points: number
          category_points: number
          challenge_id: string
          created_at: string
          final_rank: number | null
          games_played: number
          id: string
          lyrics_points: number
          melody_points: number
          prize_awarded: number
          qualified: boolean
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          articles_points?: number
          category_points?: number
          challenge_id: string
          created_at?: string
          final_rank?: number | null
          games_played?: number
          id?: string
          lyrics_points?: number
          melody_points?: number
          prize_awarded?: number
          qualified?: boolean
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          articles_points?: number
          category_points?: number
          challenge_id?: string
          created_at?: string
          final_rank?: number | null
          games_played?: number
          id?: string
          lyrics_points?: number
          melody_points?: number
          prize_awarded?: number
          qualified?: boolean
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_scores_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          allowed_subscriptions: string[]
          created_at: string
          created_by: string | null
          description: string | null
          difficulty_gates: Json
          end_date: string
          entry_fee: number
          id: string
          max_daily_scoring_games: number | null
          max_referrals_per_user: number | null
          name: string
          prize_distribution: Json
          prize_pool: number
          qualification_min_games: number
          referral_gate_required_invites: number
          referral_gate_score: number | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          allowed_subscriptions?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_gates?: Json
          end_date: string
          entry_fee?: number
          id?: string
          max_daily_scoring_games?: number | null
          max_referrals_per_user?: number | null
          name: string
          prize_distribution?: Json
          prize_pool?: number
          qualification_min_games?: number
          referral_gate_required_invites?: number
          referral_gate_score?: number | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          allowed_subscriptions?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          difficulty_gates?: Json
          end_date?: string
          entry_fee?: number
          id?: string
          max_daily_scoring_games?: number | null
          max_referrals_per_user?: number | null
          name?: string
          prize_distribution?: Json
          prize_pool?: number
          qualification_min_games?: number
          referral_gate_required_invites?: number
          referral_gate_score?: number | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      communities: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_moderators: {
        Row: {
          appointed_by: string
          community_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          appointed_by: string
          community_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          appointed_by?: string
          community_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_moderators_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          community_id: string
          content: string
          created_at: string
          id: string
          song_id: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          content: string
          created_at?: string
          id?: string
          song_id?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          content?: string
          created_at?: string
          id?: string
          song_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_discover: {
        Row: {
          created_at: string
          discover_date: string
          id: string
          reason: string | null
          song_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discover_date?: string
          id?: string
          reason?: string | null
          song_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          discover_date?: string
          id?: string
          reason?: string | null
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_discover_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_categories: {
        Row: {
          created_at: string
          gradient_from: string
          gradient_to: string
          gradient_via: string | null
          id: string
          image_alt: string | null
          image_url: string | null
          is_hero: boolean
          is_visible: boolean
          route: string
          sort_order: number
          subtitle: string | null
          text_color: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          gradient_from?: string
          gradient_to?: string
          gradient_via?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_hero?: boolean
          is_visible?: boolean
          route?: string
          sort_order?: number
          subtitle?: string | null
          text_color?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          gradient_from?: string
          gradient_to?: string
          gradient_via?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          is_hero?: boolean
          is_visible?: boolean
          route?: string
          sort_order?: number
          subtitle?: string | null
          text_color?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      discover_featured: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          href: string | null
          id: string
          image_url: string | null
          is_active: boolean
          label: string
          media_type: string
          poster_url: string | null
          song_ids: string[]
          sort_order: number
          starts_at: string | null
          updated_at: string
          updated_by: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          href?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label: string
          media_type?: string
          poster_url?: string | null
          song_ids?: string[]
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          href?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          label?: string
          media_type?: string
          poster_url?: string | null
          song_ids?: string[]
          sort_order?: number
          starts_at?: string | null
          updated_at?: string
          updated_by?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      downloads: {
        Row: {
          downloaded_at: string
          id: string
          song_id: string
          user_id: string
        }
        Insert: {
          downloaded_at?: string
          id?: string
          song_id: string
          user_id: string
        }
        Update: {
          downloaded_at?: string
          id?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "downloads_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
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
      favorites: {
        Row: {
          created_at: string
          id: string
          song_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          song_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          replied_at: string | null
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          replied_at?: string | null
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          replied_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      game_levels: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          level: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          level: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          level?: number
          title?: string
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          best_streak: number
          correct_answers: number
          created_at: string
          difficulty: string
          game_mode: string
          id: string
          max_score: number
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          best_streak?: number
          correct_answers?: number
          created_at?: string
          difficulty: string
          game_mode: string
          id?: string
          max_score?: number
          score?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          best_streak?: number
          correct_answers?: number
          created_at?: string
          difficulty?: string
          game_mode?: string
          id?: string
          max_score?: number
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      gift_subscription_recipients: {
        Row: {
          gift_id: string
          id: string
          recipient_email: string | null
          recipient_kc_handle: string | null
          recipient_user_id: string | null
          recipient_username: string | null
        }
        Insert: {
          gift_id: string
          id?: string
          recipient_email?: string | null
          recipient_kc_handle?: string | null
          recipient_user_id?: string | null
          recipient_username?: string | null
        }
        Update: {
          gift_id?: string
          id?: string
          recipient_email?: string | null
          recipient_kc_handle?: string | null
          recipient_user_id?: string | null
          recipient_username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_subscription_recipients_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gift_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_subscriptions: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          gift_message: string | null
          id: string
          plan: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_full_name: string
          sender_id: string
          sender_kc_username: string | null
          status: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          gift_message?: string | null
          id?: string
          plan: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_full_name: string
          sender_id: string
          sender_kc_username?: string | null
          status?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          gift_message?: string | null
          id?: string
          plan?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_full_name?: string
          sender_id?: string
          sender_kc_username?: string | null
          status?: string
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          created_at: string
          cta_text: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          show_cta: boolean
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          cta_text?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          show_cta?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          cta_text?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          show_cta?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      homepage_popup: {
        Row: {
          bg_color: string | null
          border_radius: string | null
          button_color: string | null
          button_text_color: string | null
          created_at: string
          delay_seconds: number
          description: string | null
          enabled: boolean
          homepage_only: boolean
          id: string
          image_position: string
          image_url: string | null
          max_width: string | null
          primary_button_new_tab: boolean
          primary_button_text: string | null
          primary_button_url: string | null
          secondary_button_new_tab: boolean
          secondary_button_text: string | null
          secondary_button_url: string | null
          show_frequency: string
          target_segment: string
          target_user_ids: string[] | null
          text_color: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          border_radius?: string | null
          button_color?: string | null
          button_text_color?: string | null
          created_at?: string
          delay_seconds?: number
          description?: string | null
          enabled?: boolean
          homepage_only?: boolean
          id?: string
          image_position?: string
          image_url?: string | null
          max_width?: string | null
          primary_button_new_tab?: boolean
          primary_button_text?: string | null
          primary_button_url?: string | null
          secondary_button_new_tab?: boolean
          secondary_button_text?: string | null
          secondary_button_url?: string | null
          show_frequency?: string
          target_segment?: string
          target_user_ids?: string[] | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          border_radius?: string | null
          button_color?: string | null
          button_text_color?: string | null
          created_at?: string
          delay_seconds?: number
          description?: string | null
          enabled?: boolean
          homepage_only?: boolean
          id?: string
          image_position?: string
          image_url?: string | null
          max_width?: string | null
          primary_button_new_tab?: boolean
          primary_button_text?: string | null
          primary_button_url?: string | null
          secondary_button_new_tab?: boolean
          secondary_button_text?: string | null
          secondary_button_url?: string | null
          show_frequency?: string
          target_segment?: string
          target_user_ids?: string[] | null
          text_color?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      karaoke_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          recording_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          recording_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          recording_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "karaoke_comments_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "karaoke_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      karaoke_recordings: {
        Row: {
          audio_url: string
          caption: string | null
          created_at: string
          id: string
          song_id: string
          song_title: string
          user_id: string
        }
        Insert: {
          audio_url: string
          caption?: string | null
          created_at?: string
          id?: string
          song_id: string
          song_title: string
          user_id: string
        }
        Update: {
          audio_url?: string
          caption?: string | null
          created_at?: string
          id?: string
          song_id?: string
          song_title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "karaoke_recordings_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      karaoke_story_views: {
        Row: {
          id: string
          recording_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          recording_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          recording_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "karaoke_story_views_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "karaoke_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      kingschat_auth_sessions: {
        Row: {
          code_claimed_at: string | null
          consumed_at: string | null
          created_at: string
          error: string | null
          expires_at: string
          nonce: string
          platform: string
          redirect_path: string
          session_data: Json | null
        }
        Insert: {
          code_claimed_at?: string | null
          consumed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          nonce: string
          platform?: string
          redirect_path?: string
          session_data?: Json | null
        }
        Update: {
          code_claimed_at?: string | null
          consumed_at?: string | null
          created_at?: string
          error?: string | null
          expires_at?: string
          nonce?: string
          platform?: string
          redirect_path?: string
          session_data?: Json | null
        }
        Relationships: []
      }
      kingschat_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          kingschat_user_id: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          kingschat_user_id?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          kingschat_user_id?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          is_rtl: boolean
          name: string
          native_name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          is_rtl?: boolean
          name: string
          native_name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          is_rtl?: boolean
          name?: string
          native_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          created_by: string
          deep_link: string | null
          id: string
          image_url: string | null
          message: string
          onesignal_id: string | null
          scheduled_at: string | null
          segment: string
          sent_at: string | null
          status: string
          target_user_ids: string[] | null
          title: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          created_by: string
          deep_link?: string | null
          id?: string
          image_url?: string | null
          message: string
          onesignal_id?: string | null
          scheduled_at?: string | null
          segment?: string
          sent_at?: string | null
          status?: string
          target_user_ids?: string[] | null
          title: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          created_by?: string
          deep_link?: string | null
          id?: string
          image_url?: string | null
          message?: string
          onesignal_id?: string | null
          scheduled_at?: string | null
          segment?: string
          sent_at?: string | null
          status?: string
          target_user_ids?: string[] | null
          title?: string
        }
        Relationships: []
      }
      onboarding_screens: {
        Row: {
          badge: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      platform_referrals: {
        Row: {
          created_at: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      play_events: {
        Row: {
          created_at: string
          id: string
          language_code: string | null
          mode: string
          seconds_played: number
          song_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          language_code?: string | null
          mode?: string
          seconds_played?: number
          song_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          language_code?: string | null
          mode?: string
          seconds_played?: number
          song_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "play_events_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_songs: {
        Row: {
          id: string
          playlist_id: string
          song_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          playlist_id: string
          song_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          playlist_id?: string
          song_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_songs_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_songs_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          card_color: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_visible_on_homepage: boolean
          name: string
          user_id: string
        }
        Insert: {
          card_color?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_visible_on_homepage?: boolean
          name: string
          user_id: string
        }
        Update: {
          card_color?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_visible_on_homepage?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_ads: {
        Row: {
          created_at: string
          cta_text: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          placement: string
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          cta_text?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          placement?: string
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          cta_text?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          placement?: string
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          church: string | null
          created_at: string
          email: string | null
          espees_balance: number
          id: string
          kingschat_handle: string | null
          profile_completed: boolean
          region: string | null
          updated_at: string
          user_id: string
          username: string
          zone: string | null
        }
        Insert: {
          avatar_url?: string | null
          church?: string | null
          created_at?: string
          email?: string | null
          espees_balance?: number
          id?: string
          kingschat_handle?: string | null
          profile_completed?: boolean
          region?: string | null
          updated_at?: string
          user_id: string
          username: string
          zone?: string | null
        }
        Update: {
          avatar_url?: string | null
          church?: string | null
          created_at?: string
          email?: string | null
          espees_balance?: number
          id?: string
          kingschat_handle?: string | null
          profile_completed?: boolean
          region?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          zone?: string | null
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          created_at: string
          id: string
          level_id: string
          lyric_text: string
          missing_word: string
          options: string[]
          song_title: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          level_id: string
          lyric_text: string
          missing_word: string
          options: string[]
          song_title: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          level_id?: string
          lyric_text?: string
          missing_word?: string
          options?: string[]
          song_title?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "game_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      recently_played: {
        Row: {
          id: string
          played_at: string
          song_id: string
          user_id: string
        }
        Insert: {
          id?: string
          played_at?: string
          song_id: string
          user_id: string
        }
        Update: {
          id?: string
          played_at?: string
          song_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recently_played_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_credit_uses: {
        Row: {
          amount: number
          created_at: string
          request_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          request_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          request_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_credit_uses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "subscription_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          note: string | null
          ref_id: string | null
          referred_user_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          ref_id?: string | null
          referred_user_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          ref_id?: string | null
          referred_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_payouts: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          id: string
          kingschat_username: string | null
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          id?: string
          kingschat_username?: string | null
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          id?: string
          kingschat_username?: string | null
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reminder_date: string
          reminder_time: string
          song_id: string | null
          song_title: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reminder_date: string
          reminder_time: string
          song_id?: string | null
          song_title?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reminder_date?: string
          reminder_time?: string
          song_id?: string | null
          song_title?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_reminders: {
        Row: {
          id: string
          milestone: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          milestone: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          milestone?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      song_audio_versions: {
        Row: {
          attempts: number
          audio_url: string | null
          bitrate_kbps: number | null
          created_at: string
          error: string | null
          id: string
          kind: string
          language_code: string
          prediction_id: string | null
          song_id: string
          source: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          audio_url?: string | null
          bitrate_kbps?: number | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          language_code: string
          prediction_id?: string | null
          song_id: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          audio_url?: string | null
          bitrate_kbps?: number | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          language_code?: string
          prediction_id?: string | null
          song_id?: string
          source?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_audio_versions_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "song_audio_versions_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_lyrics: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_machine_translated: boolean
          is_verified: boolean
          language_code: string
          lyrics_lrc: string | null
          lyrics_text: string | null
          song_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_machine_translated?: boolean
          is_verified?: boolean
          language_code: string
          lyrics_lrc?: string | null
          lyrics_text?: string | null
          song_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_machine_translated?: boolean
          is_verified?: boolean
          language_code?: string
          lyrics_lrc?: string | null
          lyrics_text?: string | null
          song_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_lyrics_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "song_lyrics_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_motion_artwork: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          is_active: boolean
          song_id: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          id?: string
          is_active?: boolean
          song_id: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          is_active?: boolean
          song_id?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_motion_artwork_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: true
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      song_videos: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          is_active: boolean
          language_code: string
          offset_ms: number
          song_id: string
          thumbnail_url: string | null
          video_type: string
          video_url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          language_code?: string
          offset_ms?: number
          song_id: string
          thumbnail_url?: string | null
          video_type?: string
          video_url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_active?: boolean
          language_code?: string
          offset_ms?: number
          song_id?: string
          thumbnail_url?: string | null
          video_type?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "song_videos_language_code_fkey"
            columns: ["language_code"]
            isOneToOne: false
            referencedRelation: "languages"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "song_videos_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album: string | null
          album_id: string | null
          artist: string
          audio_url: string | null
          category_id: string | null
          cover_url: string | null
          created_at: string
          dominant_color: string | null
          duration_seconds: number
          has_video: boolean
          id: string
          instrumental_url: string | null
          is_featured: boolean
          is_free_download: boolean
          is_top: boolean
          lyrics_lrc: string | null
          lyrics_text: string | null
          original_language: string
          play_count: number
          title: string
          total_sung: number
        }
        Insert: {
          album?: string | null
          album_id?: string | null
          artist?: string
          audio_url?: string | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          dominant_color?: string | null
          duration_seconds?: number
          has_video?: boolean
          id?: string
          instrumental_url?: string | null
          is_featured?: boolean
          is_free_download?: boolean
          is_top?: boolean
          lyrics_lrc?: string | null
          lyrics_text?: string | null
          original_language?: string
          play_count?: number
          title: string
          total_sung?: number
        }
        Update: {
          album?: string | null
          album_id?: string | null
          artist?: string
          audio_url?: string | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          dominant_color?: string | null
          duration_seconds?: number
          has_video?: boolean
          id?: string
          instrumental_url?: string | null
          is_featured?: boolean
          is_free_download?: boolean
          is_top?: boolean
          lyrics_lrc?: string | null
          lyrics_text?: string | null
          original_language?: string
          play_count?: number
          title?: string
          total_sung?: number
        }
        Relationships: [
          {
            foreignKeyName: "songs_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "songs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      stem_worker_state: {
        Row: {
          id: number
          lease_until: string | null
          paused_at: string | null
          paused_reason: string | null
          updated_at: string
        }
        Insert: {
          id?: number
          lease_until?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          updated_at?: string
        }
        Update: {
          id?: number
          lease_until?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscription_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          full_name: string
          id: string
          kingschat_username: string | null
          plan: string
          proof_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          full_name: string
          id?: string
          kingschat_username?: string | null
          plan: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          full_name?: string
          id?: string
          kingschat_username?: string | null
          plan?: string
          proof_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
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
      user_achievements: {
        Row: {
          achievement_key: string
          earned_at: string
          id: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          earned_at?: string
          id?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          earned_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_game_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          id: string
          level_id: string
          score: number
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          level_id: string
          score?: number
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          id?: string
          level_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_game_progress_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "game_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          notification_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          notification_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          notification_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          data_saver: boolean
          default_mode: string
          favorite_moods: string[]
          preferred_languages: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_saver?: boolean
          default_mode?: string
          favorite_moods?: string[]
          preferred_languages?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_saver?: boolean
          default_mode?: string
          favorite_moods?: string[]
          preferred_languages?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          id: string
          subscription: Database["public"]["Enums"]["subscription_type"]
          subscription_expiry_date: string | null
          subscription_plan: string | null
          subscription_start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          subscription?: Database["public"]["Enums"]["subscription_type"]
          subscription_expiry_date?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          subscription?: Database["public"]["Enums"]["subscription_type"]
          subscription_expiry_date?: string | null
          subscription_plan?: string | null
          subscription_start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      homepage_popup_public: {
        Row: {
          bg_color: string | null
          border_radius: string | null
          button_color: string | null
          button_text_color: string | null
          delay_seconds: number | null
          description: string | null
          enabled: boolean | null
          homepage_only: boolean | null
          id: string | null
          image_position: string | null
          image_url: string | null
          max_width: string | null
          primary_button_new_tab: boolean | null
          primary_button_text: string | null
          primary_button_url: string | null
          secondary_button_new_tab: boolean | null
          secondary_button_text: string | null
          secondary_button_url: string | null
          show_frequency: string | null
          target_segment: string | null
          text_color: string | null
          title: string | null
        }
        Insert: {
          bg_color?: string | null
          border_radius?: string | null
          button_color?: string | null
          button_text_color?: string | null
          delay_seconds?: number | null
          description?: string | null
          enabled?: boolean | null
          homepage_only?: boolean | null
          id?: string | null
          image_position?: string | null
          image_url?: string | null
          max_width?: string | null
          primary_button_new_tab?: boolean | null
          primary_button_text?: string | null
          primary_button_url?: string | null
          secondary_button_new_tab?: boolean | null
          secondary_button_text?: string | null
          secondary_button_url?: string | null
          show_frequency?: string | null
          target_segment?: string | null
          text_color?: string | null
          title?: string | null
        }
        Update: {
          bg_color?: string | null
          border_radius?: string | null
          button_color?: string | null
          button_text_color?: string | null
          delay_seconds?: number | null
          description?: string | null
          enabled?: boolean | null
          homepage_only?: boolean | null
          id?: string | null
          image_position?: string | null
          image_url?: string | null
          max_width?: string | null
          primary_button_new_tab?: boolean | null
          primary_button_text?: string | null
          primary_button_url?: string | null
          secondary_button_new_tab?: boolean | null
          secondary_button_text?: string | null
          secondary_button_url?: string | null
          show_frequency?: string | null
          target_segment?: string | null
          text_color?: string | null
          title?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_moderate_community: {
        Args: { p_community_id: string }
        Returns: boolean
      }
      can_view_community_post: {
        Args: { _post_id: string; _user_id: string }
        Returns: boolean
      }
      claim_achievement: {
        Args: { _achievement_key: string }
        Returns: boolean
      }
      claim_platform_referral: { Args: { p_code: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_challenge_leaderboard: {
        Args: { p_challenge_id: string; p_limit?: number }
        Returns: {
          avatar_url: string
          final_rank: number
          games_played: number
          is_me: boolean
          qualified: boolean
          rank: number
          total_score: number
          username: string
        }[]
      }
      get_community_member_counts: {
        Args: never
        Returns: {
          community_id: string
          member_count: number
        }[]
      }
      get_community_members_admin: {
        Args: { p_community_id: string }
        Returns: {
          avatar_url: string
          joined_at: string
          user_id: string
          username: string
        }[]
      }
      get_daily_discover: {
        Args: never
        Returns: {
          reason: string
          song_id: string
        }[]
      }
      get_my_referral_dashboard: {
        Args: never
        Returns: {
          is_premium_payer: boolean
          joined_at: string
          username: string
        }[]
      }
      get_public_karaoke: {
        Args: { p_user_id: string }
        Returns: {
          audio_url: string
          caption: string
          created_at: string
          id: string
          song_id: string
          song_title: string
        }[]
      }
      get_public_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          kingschat_handle: string
          user_id: string
          username: string
        }[]
      }
      get_public_recently_played: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          artist: string
          cover_url: string
          played_at: string
          song_id: string
          title: string
        }[]
      }
      get_quick_picks: {
        Args: { p_limit?: number }
        Returns: {
          song_id: string
          source: string
        }[]
      }
      get_trending: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          plays: number
          song_id: string
        }[]
      }
      has_active_premium: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_community_member: {
        Args: { _community_id: string; _user_id: string }
        Returns: boolean
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
      plan_price: { Args: { p_plan: string }; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_play: {
        Args: {
          p_language?: string
          p_mode?: string
          p_seconds?: number
          p_song_id: string
        }
        Returns: undefined
      }
      referral_balance: { Args: { _user_id: string }; Returns: number }
      referrals_enabled: { Args: never; Returns: boolean }
      request_referral_payout: {
        Args: { p_kingschat: string }
        Returns: number
      }
      request_subscription_with_credit: {
        Args: {
          p_full_name: string
          p_kingschat: string
          p_plan: string
          p_proof_url: string
        }
        Returns: Json
      }
      review_referral_payout: {
        Args: { p_id: string; p_notes: string; p_status: string }
        Returns: undefined
      }
      search_community_moderators: {
        Args: { p_community_id: string; p_query?: string }
        Returns: {
          avatar_url: string
          is_moderator: boolean
          user_id: string
          username: string
        }[]
      }
      set_community_moderator: {
        Args: { p_community_id: string; p_enabled: boolean; p_user_id: string }
        Returns: undefined
      }
      stem_queue_disarm: { Args: never; Returns: undefined }
      stem_worker_acquire: { Args: { p_seconds?: number }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "free" | "premium" | "editor" | "user"
      subscription_type: "free" | "premium" | "trial"
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
      app_role: ["admin", "free", "premium", "editor", "user"],
      subscription_type: ["free", "premium", "trial"],
    },
  },
} as const
