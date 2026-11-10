import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import {
  CreateTaskRequestSchema,
  UpdateTaskRequestSchema,
  Task,
  Project,
  Goal,
  Routine,
} from '@don/shared';
import { db } from '../db/index.js';
import { auditService } from '../services/audit.service.js';

export async function taskRoutes(fastify: FastifyInstance) {
  // Tasks CRUD
  fastify.get('/api/tasks', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.tasks.values()));
  });

  fastify.post('/api/tasks', async (req, reply) => {
    try {
      const parsed = CreateTaskRequestSchema.parse(req.body);
      const owner = Array.from(db.users.values())[0];
      const newTask: Task = {
        id: crypto.randomUUID(),
        userId: owner?.id || '00000000-0000-0000-0000-000000000001',
        title: parsed.title,
        description: parsed.description || '',
        status: parsed.status || 'TODO',
        priority: parsed.priority || 'MEDIUM',
        dueDate: parsed.dueDate || null,
        timezone: parsed.timezone || 'UTC',
        labels: parsed.labels || [],
        subtasks: parsed.subtasks || [],
        dependencies: parsed.dependencies || [],
        recurringCron: parsed.recurringCron || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.tasks.set(newTask.id, newTask);

      auditService.record({
        userId: newTask.userId,
        toolName: 'create_task',
        parameters: { taskId: newTask.id, title: newTask.title },
        targetResource: 'DATABASE:TASKS',
        consequenceSummary: `Created task "${newTask.title}" with priority ${newTask.priority}`,
        status: 'EXECUTED',
        decisionMadeBy: 'USER',
      });

      return reply.status(201).send(newTask);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid task data';
      return reply.status(400).send({ error: msg });
    }
  });

  fastify.patch('/api/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = db.tasks.get(id);
    if (!task) return reply.status(404).send({ error: 'Task not found' });

    const parsed = UpdateTaskRequestSchema.parse(req.body);
    const updated: Task = {
      ...task,
      ...parsed,
      updatedAt: new Date().toISOString(),
    };
    db.tasks.set(id, updated);
    return reply.status(200).send(updated);
  });

  fastify.delete('/api/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    db.tasks.delete(id);
    return reply.status(204).send();
  });

  // Projects CRUD
  fastify.get('/api/projects', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.projects.values()));
  });

  fastify.post('/api/projects', async (req, reply) => {
    const body = req.body as Partial<Project>;
    const owner = Array.from(db.users.values())[0];
    const project: Project = {
      id: crypto.randomUUID(),
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      name: body.name || 'New Project',
      description: body.description || '',
      color: body.color || '#f59e0b',
      status: body.status || 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.projects.set(project.id, project);
    return reply.status(201).send(project);
  });

  // Goals CRUD
  fastify.get('/api/goals', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.goals.values()));
  });

  fastify.post('/api/goals', async (req, reply) => {
    const body = req.body as Partial<Goal>;
    const owner = Array.from(db.users.values())[0];
    const goal: Goal = {
      id: crypto.randomUUID(),
      userId: owner?.id || '00000000-0000-0000-0000-000000000001',
      title: body.title || 'New Goal',
      description: body.description || '',
      targetDate: body.targetDate || null,
      progressPercentage: body.progressPercentage || 0,
      milestones: body.milestones || [],
      blockers: body.blockers || [],
      weeklyReview: body.weeklyReview || '',
      suggestedNextActions: body.suggestedNextActions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.goals.set(goal.id, goal);
    return reply.status(201).send(goal);
  });

  // Routines CRUD
  fastify.get('/api/routines', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.routines.values()));
  });

  // Daily Briefing Endpoint
  fastify.get('/api/briefing', async (_req, reply) => {
    const tasks = Array.from(db.tasks.values());
    const urgentTasks = tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH');
    const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE');

    return reply.status(200).send({
      generatedAt: new Date().toISOString(),
      calendarEvents: [
        { title: 'Operations Alignment', time: '10:00 AM - 10:30 AM', location: 'Virtual' },
        { title: 'Infrastructure Review', time: '02:00 PM - 03:00 PM', location: 'Conference Room B' },
      ],
      priorityTasks: urgentTasks.slice(0, 5),
      overdueTasks: overdueTasks.slice(0, 5),
      reminders: [
        { id: '1', title: 'Submit quarterly compliance certificate', time: '5:00 PM' },
      ],
      suggestedFocusBlock: {
        startTime: '10:45 AM',
        endTime: '12:45 PM',
        recommendedFocus: urgentTasks[0]?.title || 'Deep work on strategic milestones',
      },
      weatherSummary: 'Partly cloudy, 18°C (64°F), light breeze.',
    });
  });

  // Focus Mode
  fastify.post('/api/focus/start', async (req, reply) => {
    const body = req.body as { durationMinutes?: number; allowlistedApps?: string[] };
    return reply.status(200).send({
      focusSessionActive: true,
      startedAt: new Date().toISOString(),
      durationMinutes: body.durationMinutes || 45,
      notificationSuppression: 'ELIGIBLE_MUTED',
      allowedTools: body.allowlistedApps || ['Calculator', 'Terminal', 'VS Code'],
      message: 'Focus mode initiated. External non-essential alerts suppressed.',
    });
  });
}
