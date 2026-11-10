import { z } from 'zod';

export const TaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const SubtaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  completed: z.boolean().default(false),
});
export type Subtask = z.infer<typeof SubtaskSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().default(''),
  status: TaskStatusSchema.default('TODO'),
  priority: TaskPrioritySchema.default('MEDIUM'),
  dueDate: z.string().nullable().optional(),
  timezone: z.string().default('UTC'),
  labels: z.array(z.string()).default([]),
  subtasks: z.array(SubtaskSchema).default([]),
  dependencies: z.array(z.string().uuid()).default([]),
  recurringCron: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskRequestSchema = TaskSchema.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).partial({
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  timezone: true,
  labels: true,
  subtasks: true,
  dependencies: true,
  recurringCron: true,
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

export const UpdateTaskRequestSchema = CreateTaskRequestSchema.partial();
export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  color: z.string().default('#f59e0b'),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'COMPLETED']).default('ACTIVE'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const MilestoneSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  dueDate: z.string().optional(),
  completed: z.boolean().default(false),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const GoalSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().default(''),
  targetDate: z.string().nullable().optional(),
  progressPercentage: z.number().min(0).max(100).default(0),
  milestones: z.array(MilestoneSchema).default([]),
  blockers: z.array(z.string()).default([]),
  weeklyReview: z.string().default(''),
  suggestedNextActions: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const RoutineStepSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  actionPayload: z.record(z.unknown()).optional(),
  estimatedMinutes: z.number().default(5),
  requiresConfirmation: z.boolean().default(false),
});
export type RoutineStep = z.infer<typeof RoutineStepSchema>;

export const RoutineSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  enabled: z.boolean().default(true),
  scheduleCron: z.string().nullable().optional(),
  steps: z.array(RoutineStepSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Routine = z.infer<typeof RoutineSchema>;

export const ReminderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1),
  remindAt: z.string().datetime(),
  sent: z.boolean().default(false),
  deviceId: z.string().nullable().optional(),
});
export type Reminder = z.infer<typeof ReminderSchema>;
