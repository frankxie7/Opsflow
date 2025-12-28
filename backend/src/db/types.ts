// TypeScript types for database entities
// These match the schema defined in schema.sql

export type UserRole = "admin" | "operator" | "viewer";
export type TaskStatus = "new" | "assigned" | "in_progress" | "completed" | "cancelled";
export type TaskUrgency = "low" | "medium" | "high" | "critical";

export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface RawMessage {
  id: number;
  source: string;
  channel: string;
  channel_id: string | null;
  sender: string;
  sender_id: string | null;
  text: string;
  raw_payload: Record<string, unknown>; // JSONB
  timestamp: Date;
  slack_message_ts: string | null;
  created_at: Date;
}

export interface Task {
  id: number;
  raw_message_id: number;
  category: string | null;
  urgency: TaskUrgency | null;
  summary: string | null;
  status: TaskStatus;
  assigned_to: number | null;
  ai_confidence: number | null; // 0.00 to 1.00
  requires_review: boolean;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface AuditLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  user_id: number | null;
  metadata: Record<string, unknown> | null; // JSONB
  created_at: Date;
}

// Input types for creating entities (without auto-generated fields)
export interface CreateUserInput {
  email: string;
  password_hash: string;
  role?: UserRole;
}

export interface CreateRawMessageInput {
  source?: string;
  channel: string;
  channel_id?: string | null;
  sender: string;
  sender_id?: string | null;
  text: string;
  raw_payload: Record<string, unknown>;
  timestamp: Date;
  slack_message_ts?: string | null;
}

export interface CreateTaskInput {
  raw_message_id: number;
  category?: string | null;
  urgency?: TaskUrgency | null;
  summary?: string | null;
  status?: TaskStatus;
  assigned_to?: number | null;
  ai_confidence?: number | null;
  requires_review?: boolean;
}

export interface CreateAuditLogInput {
  entity_type: string;
  entity_id: number;
  action: string;
  user_id?: number | null;
  metadata?: Record<string, unknown> | null;
}

