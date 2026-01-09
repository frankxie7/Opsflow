import {
  createTask,
  findTaskById,
  findTasksByAssignedTo,
  findTasksByStatus,
  findAllTasks,
  updateTask,
  updateTaskStatus,
  updateTaskAssignment,
} from "../db/tasks";
import { createAuditLog } from "../db/auditLogs";
import { findUserById } from "../db/users";
import {
  Task,
  CreateTaskInput,
  TaskStatus,
  TaskUrgency,
} from "../db/types";

/**
 * Task service - core business logic for task management
 * Handles task creation, assignment, status transitions
 * Deterministic rules, no AI decision-making here
 */

export interface CreateTaskRequest {
  raw_message_id: number;
  category?: string | null;
  urgency?: TaskUrgency | null;
  summary?: string | null;
  assigned_to?: number | null;
  ai_confidence?: number | null;
  requires_review?: boolean;
}

export interface UpdateTaskRequest {
  category?: string | null;
  urgency?: TaskUrgency | null;
  summary?: string | null;
  status?: TaskStatus;
  assigned_to?: number | null;
  requires_review?: boolean;
}

/**
 * Create a new task
 * Logs audit trail for creation
 */
export async function createTaskService(
  input: CreateTaskRequest,
  createdByUserId: number
): Promise<Task> {
  // Validate raw_message_id exists (we'll add this check later when raw_messages is implemented)
  // For now, we'll just create the task

  const taskInput: CreateTaskInput = {
    raw_message_id: input.raw_message_id,
    category: input.category || null,
    urgency: input.urgency || null,
    summary: input.summary || null,
    status: "new",
    assigned_to: input.assigned_to || null,
    ai_confidence: input.ai_confidence || null,
    requires_review: input.requires_review || false,
  };

  const task = await createTask(taskInput);

  // Log audit trail
  await createAuditLog({
    entity_type: "task",
    entity_id: task.id,
    action: "created",
    user_id: createdByUserId,
    metadata: {
      category: task.category,
      urgency: task.urgency,
      assigned_to: task.assigned_to,
    },
  });

  return task;
}

/**
 * Get task by ID
 * Enforces ownership checks for viewers
 */
export async function getTaskByIdService(
  taskId: number,
  userId: number,
  userRole: string
): Promise<Task | null> {
  const task = await findTaskById(taskId);
  if (!task) {
    return null;
  }

  // Viewers can only see tasks assigned to them
  if (userRole === "viewer" && task.assigned_to !== userId) {
    return null; // Don't leak that task exists - just return null
  }

  return task;
}

/**
 * List tasks with RBAC filtering
 */
export async function listTasksService(
  userId: number,
  userRole: string,
  filters?: {
    status?: TaskStatus;
    assigned_to?: number;
  }
): Promise<Task[]> {
  // Viewers can only see their own tasks
  if (userRole === "viewer") {
    return findTasksByAssignedTo(userId);
  }

  // Operators and admins can see all tasks, with optional filters
  if (filters?.status) {
    return findTasksByStatus(filters.status);
  }

  if (filters?.assigned_to) {
    return findTasksByAssignedTo(filters.assigned_to);
  }

  return findAllTasks();
}

/**
 * Update task - handles status transitions and assignment changes
 * Enforces ownership and permissions
 */
export async function updateTaskService(
  taskId: number,
  updates: UpdateTaskRequest,
  userId: number,
  userRole: string
): Promise<Task | null> {
  const task = await findTaskById(taskId);
  if (!task) {
    return null;
  }

  // Viewers can only update tasks assigned to them, and only status
  if (userRole === "viewer") {
    if (task.assigned_to !== userId) {
      throw new Error("Insufficient permissions: can only update your own tasks");
    }
    // Viewers can only update status (to mark as in_progress or completed)
    if (
      updates.category !== undefined ||
      updates.urgency !== undefined ||
      updates.summary !== undefined ||
      updates.assigned_to !== undefined ||
      updates.requires_review !== undefined
    ) {
      throw new Error(
        "Insufficient permissions: viewers can only update task status"
      );
    }
  }

  // Operators can update anything except assignment (only admins can assign)
  if (userRole === "operator" && updates.assigned_to !== undefined) {
    throw new Error("Insufficient permissions: only admins can assign tasks");
  }

  // Validate status transitions and handle completed_at
  let statusChanged = false;
  if (updates.status && updates.status !== task.status) {
    validateStatusTransition(task.status, updates.status);
    statusChanged = true;
    
    // Set completed_at when status changes to completed, clear it otherwise
    const completedAt = updates.status === "completed" ? new Date() : null;
    await updateTaskStatus(taskId, updates.status, completedAt);
  }

  // Handle assignment changes
  let assignmentChanged = false;
  if (updates.assigned_to !== undefined && updates.assigned_to !== task.assigned_to) {
    assignmentChanged = true;
    // Verify the assignee exists
    if (updates.assigned_to !== null) {
      const assignee = await findUserById(updates.assigned_to);
      if (!assignee) {
        throw new Error("Assignee not found");
      }
    }

    await updateTaskAssignment(taskId, updates.assigned_to);

    await createAuditLog({
      entity_type: "task",
      entity_id: taskId,
      action: "assigned",
      user_id: userId,
      metadata: {
        old_assigned_to: task.assigned_to,
        new_assigned_to: updates.assigned_to,
      },
    });
  }

  // Apply other updates (exclude status and assigned_to since we handled them separately)
  const updatesToApply: UpdateTaskRequest = {};
  if (updates.category !== undefined) {
    updatesToApply.category = updates.category;
  }
  if (updates.urgency !== undefined) {
    updatesToApply.urgency = updates.urgency;
  }
  if (updates.summary !== undefined) {
    updatesToApply.summary = updates.summary;
  }
  if (updates.requires_review !== undefined) {
    updatesToApply.requires_review = updates.requires_review;
  }
  
  // Only apply if there are other updates beyond status/assignment
  if (Object.keys(updatesToApply).length > 0) {
    await updateTask(taskId, updatesToApply);
  }

  // Log status change if it occurred
  if (statusChanged) {
    await createAuditLog({
      entity_type: "task",
      entity_id: taskId,
      action: "status_changed",
      user_id: userId,
      metadata: {
        old_status: task.status,
        new_status: updates.status!,
      },
    });
  }

  const finalTask = await findTaskById(taskId);
  return finalTask;
}

/**
 * Apply deterministic assignment rules based on category
 * This is where business rules live - not in AI prompts
 */
export async function assignTaskByCategory(
  taskId: number,
  category: string,
  assignedByUserId: number
): Promise<Task | null> {
  // TODO: This is a placeholder - actual assignment rules should be configurable
  // For now, we'll leave tasks unassigned and let admins assign manually
  // Future: could have a mapping like { "billing": finance_team_user_id, ... }
  
  const task = await findTaskById(taskId);
  if (!task) {
    return null;
  }

  // For MVP, we don't auto-assign. Admins assign manually.
  // This keeps the system deterministic and explicit.

  return task;
}

/**
 * Validate that a status transition is allowed
 * Enforces workflow rules
 */
function validateStatusTransition(
  currentStatus: TaskStatus,
  newStatus: TaskStatus
): void {
  const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
    new: ["assigned", "in_progress", "cancelled"],
    assigned: ["in_progress", "completed", "cancelled"],
    in_progress: ["completed", "cancelled"],
    completed: [], // Terminal state - cannot transition from completed
    cancelled: [], // Terminal state - cannot transition from cancelled
  };

  if (!allowedTransitions[currentStatus].includes(newStatus)) {
    throw new Error(
      `Invalid status transition: cannot change from ${currentStatus} to ${newStatus}`
    );
  }
}
