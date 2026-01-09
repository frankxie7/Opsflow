import { Request, Response } from "express";
import {
  createTaskService,
  getTaskByIdService,
  listTasksService,
  updateTaskService,
  CreateTaskRequest,
  UpdateTaskRequest,
} from "../services/taskService";
import { TaskUrgency, TaskStatus } from "../db/types";

/**
 * Task controller - handles HTTP request/response
 * Validates input, enforces auth/RBAC, calls service, handles errors
 */

export async function createTaskController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only admins and operators can create tasks manually
    // (Later, tasks will be created via AI triage, which won't go through this endpoint)
    if (req.user.role === "viewer") {
      return res.status(403).json({
        error: "Insufficient permissions: viewers cannot create tasks",
      });
    }

    const {
      raw_message_id,
      category,
      urgency,
      summary,
      assigned_to,
      ai_confidence,
      requires_review,
    } = req.body;

    // Validate required fields
    if (!raw_message_id || typeof raw_message_id !== "number") {
      return res
        .status(400)
        .json({ error: "raw_message_id is required and must be a number" });
    }

    // Validate optional fields
    if (urgency && !["low", "medium", "high", "critical"].includes(urgency)) {
      return res.status(400).json({
        error: "urgency must be one of: low, medium, high, critical",
      });
    }

    if (assigned_to && typeof assigned_to !== "number") {
      return res
        .status(400)
        .json({ error: "assigned_to must be a number" });
    }

    if (
      ai_confidence !== undefined &&
      (typeof ai_confidence !== "number" ||
        ai_confidence < 0 ||
        ai_confidence > 1)
    ) {
      return res
        .status(400)
        .json({ error: "ai_confidence must be a number between 0 and 1" });
    }

    const taskInput: CreateTaskRequest = {
      raw_message_id,
      category: category || null,
      urgency: urgency || null,
      summary: summary || null,
      assigned_to: assigned_to || null,
      ai_confidence: ai_confidence || null,
      requires_review: requires_review || false,
    };

    const task = await createTaskService(taskInput, req.user.id);

    return res.status(201).json(task);
  } catch (error) {
    console.error("Create task error:", error);
    if (error instanceof Error) {
      // Handle foreign key constraint violation (raw_message_id doesn't exist)
      if (error.message.includes("violates foreign key constraint") || 
          error.message.includes("raw_message")) {
        return res.status(400).json({
          error: "Invalid raw_message_id: message does not exist",
        });
      }
      
      const isDevelopment = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Internal server error",
        message: isDevelopment ? error.message : undefined,
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getTaskByIdController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const task = await getTaskByIdService(
      taskId,
      req.user.id,
      req.user.role
    );

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error("Get task error:", error);
    if (error instanceof Error) {
      const isDevelopment = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Internal server error",
        message: isDevelopment ? error.message : undefined,
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listTasksController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const status = req.query.status as TaskStatus | undefined;
    const assigned_to = req.query.assigned_to
      ? parseInt(req.query.assigned_to as string, 10)
      : undefined;

    if (status && !["new", "assigned", "in_progress", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    if (assigned_to && isNaN(assigned_to)) {
      return res.status(400).json({ error: "Invalid assigned_to filter" });
    }

    const tasks = await listTasksService(req.user.id, req.user.role, {
      status,
      assigned_to,
    });

    return res.status(200).json(tasks);
  } catch (error) {
    console.error("List tasks error:", error);
    if (error instanceof Error) {
      const isDevelopment = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Internal server error",
        message: isDevelopment ? error.message : undefined,
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateTaskController(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const taskId = parseInt(req.params.id, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ error: "Invalid task ID" });
    }

    const {
      category,
      urgency,
      summary,
      status,
      assigned_to,
      requires_review,
    } = req.body;

    // Validate optional fields
    if (urgency && !["low", "medium", "high", "critical"].includes(urgency)) {
      return res.status(400).json({
        error: "urgency must be one of: low, medium, high, critical",
      });
    }

    if (
      status &&
      !["new", "assigned", "in_progress", "completed", "cancelled"].includes(
        status
      )
    ) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (assigned_to !== undefined && assigned_to !== null && typeof assigned_to !== "number") {
      return res
        .status(400)
        .json({ error: "assigned_to must be a number or null" });
    }

    const updates: UpdateTaskRequest = {};
    if (category !== undefined) updates.category = category || null;
    if (urgency !== undefined) updates.urgency = urgency || null;
    if (summary !== undefined) updates.summary = summary || null;
    if (status !== undefined) updates.status = status;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (requires_review !== undefined)
      updates.requires_review = requires_review || false;

    // At least one field must be provided
    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ error: "At least one field must be provided for update" });
    }

    const task = await updateTaskService(taskId, updates, req.user.id, req.user.role);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error("Update task error:", error);
    if (error instanceof Error) {
      // Handle specific business logic errors
      if (error.message.includes("Insufficient permissions")) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message.includes("Invalid status transition")) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes("Assignee not found")) {
        return res.status(404).json({ error: error.message });
      }

      const isDevelopment = process.env.NODE_ENV !== "production";
      return res.status(500).json({
        error: "Internal server error",
        message: isDevelopment ? error.message : undefined,
      });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
