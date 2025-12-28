-- Core database schema for AI-Powered Internal Ops Automation Platform
-- Follows append-only ingestion and audit-first principles

-- Users table (for authentication and RBAC)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'operator', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw messages table (append-only storage for Slack messages)
-- This is the source of truth for all incoming messages
CREATE TABLE IF NOT EXISTS raw_messages (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL DEFAULT 'slack',
  channel VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255),
  sender VARCHAR(255) NOT NULL,
  sender_id VARCHAR(255),
  text TEXT NOT NULL,
  raw_payload JSONB NOT NULL, -- Full Slack event payload for debugging/replay
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  slack_message_ts VARCHAR(255), -- Slack message timestamp for deduplication
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source, slack_message_ts) -- Prevent duplicate ingestion
);

-- Index for efficient querying by channel and timestamp
CREATE INDEX IF NOT EXISTS idx_raw_messages_channel_timestamp ON raw_messages(channel, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_raw_messages_created_at ON raw_messages(created_at DESC);

-- Tasks table (created after AI triage determines message is a task)
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  raw_message_id INTEGER NOT NULL REFERENCES raw_messages(id) ON DELETE CASCADE,
  category VARCHAR(100), -- e.g., 'billing', 'support', 'onboarding'
  urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  summary TEXT, -- AI-generated summary
  status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'assigned', 'in_progress', 'completed', 'cancelled')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ai_confidence DECIMAL(3, 2), -- Confidence score from AI (0.00 to 1.00)
  requires_review BOOLEAN DEFAULT FALSE, -- Flag for low-confidence AI results
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for task queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_raw_message_id ON tasks(raw_message_id);

-- Audit logs table (tracks all state transitions and important actions)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- 'task', 'message', 'user', etc.
  entity_id INTEGER NOT NULL,
  action VARCHAR(100) NOT NULL, -- 'created', 'assigned', 'status_changed', etc.
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB, -- Additional context about the action
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

