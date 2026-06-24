import type {
  Evaluator,
  EvaluatorRunContext,
  IAgentRuntime,
  JSONSchema,
  State,
} from '@elizaos/core';
import { MemoryType } from '@elizaos/core';
import type { UUID } from '@elizaos/core';

export { SecurityGuard } from '../lib/security';

const SCHEMA: JSONSchema = {
  type: 'object',
  properties: {
    tracked: { type: 'boolean' },
    jobIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['tracked', 'jobIds'],
  additionalProperties: false,
};

export const commerceEvaluator: Evaluator<
  { tracked: boolean; jobIds: string[] },
  string[]
> = {
  name: 'COMMERCE_TRACKER',
  description: 'Extracts ERC-8183 job IDs from conversation and stores them in agent memory',
  similes: ['track job', 'remember job'],
  schema: SCHEMA,

  async shouldRun({ message }: EvaluatorRunContext): Promise<boolean> {
    return /job-[\w-]+/i.test(message.content.text ?? '');
  },

  async prepare({
    runtime,
    message,
  }: EvaluatorRunContext & { state: State }): Promise<string[]> {
    if (!message.entityId) return [];
    const text = message.content.text ?? '';
    const jobIds = text.match(/job-[\w-]+/gi) ?? [];

    if (jobIds.length > 0) {
      await runtime.createMemory(
        {
          entityId: message.entityId as UUID,
          roomId: message.roomId as UUID,
          agentId: runtime.agentId as UUID,
          content: {
            text: `Commerce job referenced: ${jobIds.join(', ')}`,
            jobIds,
          },
          metadata: {
            type: MemoryType.CUSTOM,
            tags: ['agent-commerce'],
          },
        },
        'memories',
      );
    }

    return jobIds;
  },

  prompt({ prepared: jobIds }: { prepared: string[] }): string {
    if (jobIds.length === 0) {
      return 'No ERC-8183 job IDs were found. Respond with {"tracked":false,"jobIds":[]}';
    }
    return `ERC-8183 job IDs extracted: ${jobIds.join(', ')}. Confirm with {"tracked":true,"jobIds":${JSON.stringify(jobIds)}}`;
  },

  parse(output: unknown): { tracked: boolean; jobIds: string[] } | null {
    if (typeof output === 'object' && output !== null && 'tracked' in output) {
      const o = output as Record<string, unknown>;
      return {
        tracked: Boolean(o.tracked),
        jobIds: Array.isArray(o.jobIds) ? (o.jobIds as string[]) : [],
      };
    }
    return null;
  },
};
