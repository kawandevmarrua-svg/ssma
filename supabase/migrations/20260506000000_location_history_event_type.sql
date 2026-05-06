-- Add event_type and checklist_id to location_history for granular operator event tracking

ALTER TABLE location_history
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'breadcrumb'
    CONSTRAINT location_history_event_type_check
    CHECK (event_type IN (
      'breadcrumb',
      'idle_breadcrumb',
      'pre_op_start',
      'checklist_start',
      'checklist_end',
      'activity_start',
      'activity_end',
      'parada'
    )),
  ADD COLUMN IF NOT EXISTS checklist_id UUID REFERENCES checklists(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_location_history_event_type
  ON location_history(event_type);

CREATE INDEX IF NOT EXISTS idx_location_history_operator_recorded
  ON location_history(operator_id, recorded_at DESC);

-- RLS: operators can only insert their own events (same policy as existing)
-- Existing RLS policies on location_history already cover this via operator_id.
