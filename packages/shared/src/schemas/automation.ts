import { z } from 'zod';

export const TriggerTypeSchema = z.enum([
  'SCHEDULE_CRON',
  'FOCUS_MODE_STARTED',
  'FOCUS_MODE_ENDED',
  'TASK_CREATED_URGENT',
  'MEETING_ENDED',
  'LOCATION_ENTERED',
  'DEVICE_BATTERY_LOW',
]);
export type TriggerType = z.infer<typeof TriggerTypeSchema>;

export const TriggerDefinitionSchema = z.object({
  type: TriggerTypeSchema,
  cronExpression: z.string().optional(),
  timezone: z.string().default('UTC'),
  metadata: z.record(z.unknown()).default({}),
});
export type TriggerDefinition = z.infer<typeof TriggerDefinitionSchema>;

export const ConditionDefinitionSchema = z.object({
  field: z.string(),
  operator: z.enum(['EQUALS', 'CONTAINS', 'GREATER_THAN', 'LESS_THAN', 'IN']),
  value: z.unknown(),
});
export type ConditionDefinition = z.infer<typeof ConditionDefinitionSchema>;

export const AutomationActionDefinitionSchema = z.object({
  id: z.string().uuid(),
  toolName: z.string(),
  parameters: z.record(z.unknown()),
  requiresApproval: z.boolean().default(false),
});
export type AutomationActionDefinition = z.infer<typeof AutomationActionDefinitionSchema>;

export const AutomationRecipeSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().default(''),
  trigger: TriggerDefinitionSchema,
  conditions: z.array(ConditionDefinitionSchema).default([]),
  actions: z.array(AutomationActionDefinitionSchema).min(1),
  enabled: z.boolean().default(true),
  rateLimitPerMinute: z.number().int().min(1).max(60).default(5),
  lastRunAt: z.string().datetime().nullable().optional(),
  totalExecutions: z.number().int().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AutomationRecipe = z.infer<typeof AutomationRecipeSchema>;

export const AutomationDryRunResultSchema = z.object({
  recipeId: z.string().uuid(),
  recipeName: z.string(),
  triggerEvaluated: z.boolean(),
  conditionsPassed: z.boolean(),
  plannedActions: z.array(
    z.object({
      toolName: z.string(),
      parameters: z.record(z.unknown()),
      requiresApproval: z.boolean(),
      dryRunOutputPreview: z.string(),
    })
  ),
  warnings: z.array(z.string()),
});
export type AutomationDryRunResult = z.infer<typeof AutomationDryRunResultSchema>;
