import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { AutomationRecipe, AutomationDryRunResult } from '@don/shared';
import { db } from '../db/index.js';
import { auditService } from '../services/audit.service.js';
import { relayService } from '../services/relay.service.js';

export async function automationRoutes(fastify: FastifyInstance) {
  // List automations
  fastify.get('/api/automations', async (_req, reply) => {
    return reply.status(200).send(Array.from(db.automations.values()));
  });

  // Create automation recipe
  fastify.post('/api/automations', async (req, reply) => {
    const body = req.body as Partial<AutomationRecipe>;
    const owner = Array.from(db.users.values())[0];
    const userId = owner?.id || '00000000-0000-0000-0000-000000000001';

    const recipe: AutomationRecipe = {
      id: crypto.randomUUID(),
      userId,
      name: body.name || 'Custom Automation Recipe',
      description: body.description || '',
      trigger: body.trigger || {
        type: 'SCHEDULE_CRON',
        cronExpression: '0 9 * * 1-5',
        timezone: 'UTC',
        metadata: {},
      },
      conditions: body.conditions || [],
      actions: body.actions || [
        {
          id: crypto.randomUUID(),
          toolName: 'web_search',
          parameters: { query: 'Morning market brief' },
          requiresApproval: false,
        },
      ],
      enabled: body.enabled ?? true,
      rateLimitPerMinute: body.rateLimitPerMinute || 5,
      totalExecutions: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.automations.set(recipe.id, recipe);
    return reply.status(201).send(recipe);
  });

  // Dry-run preview
  fastify.post('/api/automations/:id/dry-run', async (req, reply) => {
    const { id } = req.params as { id: string };
    const recipe = db.automations.get(id);
    if (!recipe) return reply.status(404).send({ error: 'Recipe not found' });

    const dryRunResult: AutomationDryRunResult = {
      recipeId: recipe.id,
      recipeName: recipe.name,
      triggerEvaluated: true,
      conditionsPassed: true,
      plannedActions: recipe.actions.map((act) => ({
        toolName: act.toolName,
        parameters: act.parameters,
        requiresApproval: act.requiresApproval,
        dryRunOutputPreview: `[Dry-run] Would execute ${act.toolName} with parameters: ${JSON.stringify(act.parameters)}`,
      })),
      warnings: db.killSwitch.isActivated
        ? ['WARNING: Emergency Kill Switch is active. Actual execution would be blocked.']
        : [],
    };

    return reply.status(200).send(dryRunResult);
  });

  // Run automation
  fastify.post('/api/automations/:id/run', async (req, reply) => {
    const { id } = req.params as { id: string };
    const recipe = db.automations.get(id);
    if (!recipe) return reply.status(404).send({ error: 'Recipe not found' });

    if (db.killSwitch.isActivated) {
      return reply.status(403).send({ error: 'Blocked: Emergency Kill Switch is engaged.' });
    }

    recipe.totalExecutions += 1;
    recipe.lastRunAt = new Date().toISOString();
    db.automations.set(id, recipe);

    auditService.record({
      userId: recipe.userId,
      toolName: 'run_approved_automation',
      parameters: { recipeId: recipe.id, name: recipe.name },
      targetResource: `AUTOMATION:${recipe.id}`,
      consequenceSummary: `Triggered execution of recipe "${recipe.name}"`,
      status: 'EXECUTED',
      decisionMadeBy: 'AUTOMATION_RUNNER',
    });

    return reply.status(200).send({
      success: true,
      recipeId: recipe.id,
      executedAt: recipe.lastRunAt,
      actionsDispatched: recipe.actions.length,
    });
  });

  // Kill Switch Status
  fastify.get('/api/automations/kill-switch', async (_req, reply) => {
    return reply.status(200).send(db.killSwitch);
  });

  // Toggle Emergency Kill Switch
  fastify.post('/api/automations/kill-switch', async (req, reply) => {
    const body = req.body as { activate: boolean; reason?: string };
    const owner = Array.from(db.users.values())[0];
    const userId = owner?.id || '00000000-0000-0000-0000-000000000001';

    db.killSwitch = {
      isActivated: body.activate,
      activatedAt: body.activate ? new Date().toISOString() : null,
      activatedByUserId: body.activate ? userId : null,
      reason: body.reason || (body.activate ? 'Emergency user kill switch invoked' : 'Resumed by user'),
    };

    relayService.notifyKillSwitch(body.activate);

    auditService.record({
      userId,
      toolName: 'emergency_kill_switch',
      parameters: { activated: body.activate, reason: db.killSwitch.reason },
      targetResource: 'GLOBAL_SYSTEM_KILL_SWITCH',
      consequenceSummary: body.activate
        ? 'STOP ALL AUTOMATIONS ENGAGED: All automation jobs halted.'
        : 'Emergency kill switch deactivated. Automation jobs restored.',
      status: 'EXECUTED',
      decisionMadeBy: 'USER',
    });

    return reply.status(200).send(db.killSwitch);
  });
}
