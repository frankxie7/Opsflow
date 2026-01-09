import { Router } from "express";
import {
  createTaskController,
  getTaskByIdController,
  listTasksController,
  updateTaskController,
} from "../controllers/taskController";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

// All task routes require authentication
router.use(authenticate);

// GET /tasks - List tasks (filtered by RBAC)
router.get("/", listTasksController);

// GET /tasks/:id - Get task by ID (ownership enforced in service)
router.get("/:id", getTaskByIdController);

// POST /tasks - Create task (admins and operators only)
router.post("/", requireRole("admin", "operator"), createTaskController);

// PATCH /tasks/:id - Update task (permissions enforced in service)
router.patch("/:id", updateTaskController);

export default router;
