// supabase/migrations/20261028000000_init_market.sql 에서 손으로 옮긴 타입.
// `supabase gen types typescript` 출력과 같은 모양을 유지한다. 스키마가 바뀌면 함께 고친다.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      market_config: {
        Row: {
          id: boolean;
          fee_rate: number;
          daily_deposit_cap: number;
          base_price: number;
          min_price: number;
          reversion_rate: number;
          trade_impact: number;
          max_trade_impact: number;
          max_trade_qty: number;
        };
        Insert: {
          id?: boolean;
          fee_rate?: number;
          daily_deposit_cap?: number;
          base_price?: number;
          min_price?: number;
          reversion_rate?: number;
          trade_impact?: number;
          max_trade_impact?: number;
          max_trade_qty?: number;
        };
        Update: {
          id?: boolean;
          fee_rate?: number;
          daily_deposit_cap?: number;
          base_price?: number;
          min_price?: number;
          reversion_rate?: number;
          trade_impact?: number;
          max_trade_impact?: number;
          max_trade_qty?: number;
        };
        Relationships: [];
      };
      event_effects: {
        Row: { type: string; pct: number; label: string };
        Insert: { type: string; pct: number; label: string };
        Update: { type?: string; pct?: number; label?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          user_id: string;
          discord_id: string;
          display_name: string | null;
          avatar_url: string | null;
        };
        Insert: {
          user_id: string;
          discord_id: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          user_id?: string;
          discord_id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      stocks: {
        Row: {
          guild_id: string;
          discord_id: string;
          display_name: string;
          house: string | null;
          price: number;
          base_price: number;
          day_open: number;
          last_event_at: string | null;
          updated_at: string;
        };
        Insert: {
          guild_id: string;
          discord_id: string;
          display_name: string;
          house?: string | null;
          price: number;
          base_price: number;
          day_open: number;
          last_event_at?: string | null;
          updated_at?: string;
        };
        Update: {
          guild_id?: string;
          discord_id?: string;
          display_name?: string;
          house?: string | null;
          price?: number;
          base_price?: number;
          day_open?: number;
          last_event_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_events: {
        Row: {
          id: number;
          guild_id: string;
          discord_id: string;
          type: string;
          payload: Json;
          display_name: string;
          house: string | null;
          dedupe_key: string;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          guild_id: string;
          discord_id: string;
          type: string;
          payload?: Json;
          display_name: string;
          house?: string | null;
          dedupe_key: string;
          occurred_at?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          guild_id?: string;
          discord_id?: string;
          type?: string;
          payload?: Json;
          display_name?: string;
          house?: string | null;
          dedupe_key?: string;
          occurred_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      price_ticks: {
        Row: {
          id: number;
          guild_id: string;
          discord_id: string;
          price: number;
          change_pct: number;
          cause: "listing" | "event" | "trade" | "reversion";
          ref_id: number | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          guild_id: string;
          discord_id: string;
          price: number;
          change_pct: number;
          cause: "listing" | "event" | "trade" | "reversion";
          ref_id?: number | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          guild_id?: string;
          discord_id?: string;
          price?: number;
          change_pct?: number;
          cause?: "listing" | "event" | "trade" | "reversion";
          ref_id?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_ticks_guild_id_discord_id_fkey";
            columns: ["guild_id", "discord_id"];
            isOneToOne: false;
            referencedRelation: "stocks";
            referencedColumns: ["guild_id", "discord_id"];
          },
        ];
      };
      accounts: {
        Row: {
          guild_id: string;
          discord_id: string;
          cash: number;
          updated_at: string;
          display_name: string | null;
        };
        Insert: {
          guild_id: string;
          discord_id: string;
          cash?: number;
          updated_at?: string;
          display_name?: string | null;
        };
        Update: {
          guild_id?: string;
          discord_id?: string;
          cash?: number;
          updated_at?: string;
          display_name?: string | null;
        };
        Relationships: [];
      };
      holdings: {
        Row: {
          guild_id: string;
          owner_id: string;
          stock_id: string;
          qty: number;
          cost_basis: number;
        };
        Insert: {
          guild_id: string;
          owner_id: string;
          stock_id: string;
          qty: number;
          cost_basis: number;
        };
        Update: {
          guild_id?: string;
          owner_id?: string;
          stock_id?: string;
          qty?: number;
          cost_basis?: number;
        };
        Relationships: [];
      };
      trades: {
        Row: {
          id: number;
          guild_id: string;
          owner_id: string;
          stock_id: string;
          side: "buy" | "sell";
          qty: number;
          exec_price: number;
          gross: number;
          fee: number;
          created_at: string;
        };
        Insert: {
          id?: number;
          guild_id: string;
          owner_id: string;
          stock_id: string;
          side: "buy" | "sell";
          qty: number;
          exec_price: number;
          gross: number;
          fee: number;
          created_at?: string;
        };
        Update: {
          id?: number;
          guild_id?: string;
          owner_id?: string;
          stock_id?: string;
          side?: "buy" | "sell";
          qty?: number;
          exec_price?: number;
          gross?: number;
          fee?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      transfers: {
        Row: {
          id: string;
          guild_id: string;
          discord_id: string;
          kind: "deposit" | "withdraw";
          amount: number;
          status: "done" | "debited" | "settled";
          created_at: string;
          settled_at: string | null;
        };
        Insert: {
          id: string;
          guild_id: string;
          discord_id: string;
          kind: "deposit" | "withdraw";
          amount: number;
          status: "done" | "debited" | "settled";
          created_at?: string;
          settled_at?: string | null;
        };
        Update: {
          id?: string;
          guild_id?: string;
          discord_id?: string;
          kind?: "deposit" | "withdraw";
          amount?: number;
          status?: "done" | "debited" | "settled";
          created_at?: string;
          settled_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      my_discord_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_guild_member: {
        Args: { p_guild: string };
        Returns: boolean;
      };
      kst_day_start: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      trade: {
        Args: {
          p_guild: string;
          p_stock: string;
          p_side: "buy" | "sell";
          p_qty: number;
        };
        Returns: Json;
      };
      leaderboard: {
        Args: { p_guild: string };
        Returns: {
          discord_id: string;
          display_name: string;
          cash: number;
          stock_value: number;
          net_worth: number;
        }[];
      };
      account_names: {
        Args: { p_guild: string };
        Returns: { discord_id: string; display_name: string }[];
      };
      // 아래는 봇(service_role) 전용 — authenticated 에서는 실행 권한이 없다.
      bank_deposit_quota: {
        Args: { p_guild: string; p_discord: string };
        Returns: number;
      };
      bank_deposit: {
        Args: {
          p_transfer_id: string;
          p_guild: string;
          p_discord: string;
          p_amount: number;
          p_display_name?: string | null;
        };
        Returns: Json;
      };
      bank_withdraw: {
        Args: {
          p_transfer_id: string;
          p_guild: string;
          p_discord: string;
          p_amount: number;
        };
        Returns: Json;
      };
      bank_settle_withdrawal: {
        Args: { p_transfer_id: string };
        Returns: undefined;
      };
      bank_pending_withdrawals: {
        Args: { p_guild: string };
        Returns: Database["public"]["Tables"]["transfers"]["Row"][];
      };
      bank_balance: {
        Args: { p_guild: string; p_discord: string };
        Returns: number;
      };
      apply_daily_reversion: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type FunctionReturns<T extends keyof PublicSchema["Functions"]> =
  PublicSchema["Functions"][T]["Returns"];

export type MarketConfig = Tables<"market_config">;
export type EventEffect = Tables<"event_effects">;
export type Profile = Tables<"profiles">;
export type Stock = Tables<"stocks">;
export type MarketEvent = Tables<"market_events">;
export type PriceTick = Tables<"price_ticks">;
export type Account = Tables<"accounts">;
export type Holding = Tables<"holdings">;
export type Trade = Tables<"trades">;
export type LeaderboardRow = FunctionReturns<"leaderboard">[number];

/** trade RPC 가 돌려주는 jsonb */
export type TradeResult = {
  trade_id: number;
  exec_price: number;
  gross: number;
  fee: number;
  price: number;
};
