// supabase/migrations/ 에서 손으로 옮긴 타입.
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
          sell_tax_rate: number;
          price_limit_rate: number;
          vi_rate: number;
          vi_seconds: number;
          shares_outstanding: number;
          credit_margin_rate: number;
          credit_maintenance: number;
          credit_interest_rate: number;
          credit_max_loan: number;
          short_margin_rate: number;
          short_maintenance: number;
          short_fee_rate: number;
          dividend_payout: number;
          noise_market: number;
          noise_house: number;
          noise_stock: number;
          news_macro_per_day: number;
          news_sector_per_day: number;
          news_rumor_per_day: number;
          earnings_sensitivity: number;
          earnings_max: number;
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
          vi_ref: number;
          vi_until: string | null;
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
          reserved_qty: number;
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
          tax: number;
          position: "cash" | "credit" | "short";
          order_type: "market" | "limit";
          forced: boolean;
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
      orders: ReadOnlyTable<{
        id: number;
        guild_id: string;
        owner_id: string;
        stock_id: string;
        side: "buy" | "sell";
        qty: number;
        limit_price: number;
        reserved_cash: number;
        status: "open" | "filled" | "cancelled" | "expired";
        exec_price: number | null;
        trade_id: number | null;
        created_at: string;
        closed_at: string | null;
      }>;
      credit_positions: ReadOnlyTable<{
        guild_id: string;
        owner_id: string;
        stock_id: string;
        qty: number;
        loan: number;
        cost_basis: number;
        /** 신용매수 때 현금에서 낸 보증금 + 수수료 (손익 · 수익률 계산용) */
        own_paid: number;
        updated_at: string;
      }>;
      short_positions: ReadOnlyTable<{
        guild_id: string;
        owner_id: string;
        stock_id: string;
        qty: number;
        collateral: number;
        sell_value: number;
        /** 공매도 때 현금에서 묶은 보증금 (손익 · 수익률 계산용) */
        margin_paid: number;
        updated_at: string;
      }>;
      candles: ReadOnlyTable<{
        guild_id: string;
        discord_id: string;
        day: string;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
        value: number;
      }>;
      market_indices: ReadOnlyTable<{
        guild_id: string;
        scope: string;
        divisor: number;
        day_open: number;
      }>;
      index_ticks: ReadOnlyTable<{
        id: number;
        guild_id: string;
        scope: string;
        value: number;
        created_at: string;
      }>;
      earnings: ReadOnlyTable<{
        guild_id: string;
        discord_id: string;
        week_start: string;
        consensus: number | null;
        actual: number | null;
        surprise: number | null;
        price_effect: number | null;
        dps: number | null;
        dividend_total: number | null;
        announced_at: string | null;
      }>;
      dividend_payments: ReadOnlyTable<{
        id: number;
        guild_id: string;
        owner_id: string;
        stock_id: string;
        week_start: string;
        qty: number;
        amount: number;
        created_at: string;
      }>;
      market_news: ReadOnlyTable<{
        id: number;
        guild_id: string;
        kind: NewsKind;
        target: string | null;
        headline: string;
        pct: number | null;
        created_at: string;
      }>;
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
      place_order: {
        Args: {
          p_guild: string;
          p_stock: string;
          p_side: "buy" | "sell";
          p_qty: number;
          p_position?: "cash" | "credit" | "short";
          p_limit?: number | null;
        };
        Returns: Json;
      };
      cancel_order: {
        Args: { p_order_id: number };
        Returns: undefined;
      };
      order_book: {
        Args: { p_guild: string; p_stock: string };
        Returns: { side: "buy" | "sell"; price: number; qty: number; orders: number }[];
      };
      recent_prices: {
        Args: { p_guild: string; p_points?: number };
        Returns: { discord_id: string; price: number; id: number }[];
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
      market_daily: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      market_tick: {
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

/** 사이트가 읽기만 하는 테이블 (쓰기는 RPC 로만) */
type ReadOnlyTable<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };

export type NewsKind = "macro" | "sector" | "rumor" | "earnings" | "dividend" | "vi" | "limit_up" | "limit_down";

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
export type Order = Tables<"orders">;
export type CreditPosition = Tables<"credit_positions">;
export type ShortPosition = Tables<"short_positions">;
export type Candle = Tables<"candles">;
export type MarketIndex = Tables<"market_indices">;
export type IndexTick = Tables<"index_ticks">;
export type Earning = Tables<"earnings">;
export type DividendPayment = Tables<"dividend_payments">;
export type MarketNews = Tables<"market_news">;
export type OrderBookLevel = FunctionReturns<"order_book">[number];
export type LeaderboardRow = FunctionReturns<"leaderboard">[number];

/** trade RPC 가 돌려주는 jsonb */
export type TradeResult = {
  trade_id: number;
  exec_price: number;
  gross: number;
  fee: number;
  tax: number;
  price: number;
};

/** place_order RPC 가 돌려주는 jsonb — 시장가는 체결 결과, 지정가는 주문 번호와 상태 */
export type PlaceOrderResult =
  | (TradeResult & { status: "filled" })
  | { order_id: number; status: Order["status"] };
