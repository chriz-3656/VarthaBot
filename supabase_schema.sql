-- Supabase Schema for VarthaBot SaaS

-- 1. Users Table
CREATE TABLE public.users (
    discord_user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Guilds Table
CREATE TABLE public.guilds (
    guild_id TEXT PRIMARY KEY,
    owner_id TEXT REFERENCES public.users(discord_user_id),
    guild_name TEXT NOT NULL,
    icon TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    active BOOLEAN DEFAULT true
);

-- 3. Guild Settings Table
CREATE TABLE public.guild_settings (
    guild_id TEXT PRIMARY KEY REFERENCES public.guilds(guild_id) ON DELETE CASCADE,
    channel_id TEXT,
    post_mode TEXT DEFAULT 'hybrid',
    fetch_interval_seconds INTEGER DEFAULT 1800,
    max_news_per_cycle INTEGER DEFAULT 5,
    max_articles_per_feed INTEGER DEFAULT 15,
    feed_fetch_delay_ms INTEGER DEFAULT 500,
    delivery_enabled BOOLEAN DEFAULT false,
    webhook_url TEXT,
    include_keywords TEXT,
    exclude_keywords TEXT,
    bot_enabled BOOLEAN DEFAULT true,
    rate_limit_ms INTEGER DEFAULT 1200,
    embed_style TEXT DEFAULT 'card',
    accent_color TEXT DEFAULT '#7C3AED',
    enable_images BOOLEAN DEFAULT true,
    description_length INTEGER DEFAULT 200,
    enable_category_tags BOOLEAN DEFAULT true,
    enable_buttons BOOLEAN DEFAULT true,
    footer_branding_text TEXT DEFAULT 'Powered by വാർത്ത ബോട്ട്',
    fallback_image_url TEXT DEFAULT 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Nuvola_apps_knews.svg/512px-Nuvola_apps_knews.svg.png',
    retry_bot_after_fallback BOOLEAN DEFAULT false,
    retry_bot_delay_ms INTEGER DEFAULT 3000
);

-- 4. Feeds Table
CREATE TABLE public.feeds (
    id TEXT PRIMARY KEY,
    guild_id TEXT REFERENCES public.guilds(guild_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Seen Articles (Deduplication)
CREATE TABLE public.seen_articles (
    id SERIAL PRIMARY KEY,
    guild_id TEXT REFERENCES public.guilds(guild_id) ON DELETE CASCADE,
    article_hash TEXT NOT NULL,
    article_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(guild_id, article_hash)
);

-- Index for fast dedup lookups
CREATE INDEX idx_seen_articles_hash ON public.seen_articles(guild_id, article_hash);

-- 6. Logs Table
CREATE TABLE public.logs (
    id SERIAL PRIMARY KEY,
    guild_id TEXT, -- Can be null for system-wide logs
    event_type TEXT,
    message TEXT NOT NULL,
    level TEXT DEFAULT 'info',
    meta JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_logs_guild ON public.logs(guild_id);
CREATE INDEX idx_logs_timestamp ON public.logs(timestamp DESC);
