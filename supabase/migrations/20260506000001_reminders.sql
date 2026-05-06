CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reminder_time TEXT NOT NULL CHECK (reminder_time ~ '^\d{2}:\d{2}$'),
  recurrence TEXT NOT NULL DEFAULT 'daily'
    CHECK (recurrence IN ('daily', 'weekly', 'once')),
  days_of_week INTEGER[],
  specific_date TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notification_ids TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_reminders" ON reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX reminders_user_id_idx ON reminders (user_id);
CREATE INDEX reminders_is_active_idx ON reminders (user_id, is_active);
