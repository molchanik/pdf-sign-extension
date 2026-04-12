-- Profiles
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sign usage counter (freemium)
CREATE TABLE sign_usage (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  TEXT NOT NULL,
  month    TEXT NOT NULL,     -- format: '2026-04'
  count    INTEGER DEFAULT 0,
  UNIQUE(user_id, month)
);

-- Subscriptions (Pro/Business)
CREATE TABLE subscriptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'inactive',
  plan               TEXT NOT NULL DEFAULT 'pro',
  period             TEXT NOT NULL DEFAULT 'monthly',
  current_period_end TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sign_usage_user_month ON sign_usage(user_id, month);
CREATE INDEX idx_subscriptions_user    ON subscriptions(user_id);

-- RLS
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sign_usage    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies (Edge Functions use service_role and bypass RLS)
CREATE POLICY "Users see own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users see own usage"
  ON sign_usage FOR SELECT USING (auth.uid()::text = user_id);
