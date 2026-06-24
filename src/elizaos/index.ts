import type { Plugin } from '@elizaos/core';
import { EventType } from '@elizaos/core';
import { commerceActions } from './actions';
import { commerceProvider } from './provider';
import { commerceEvaluator } from './evaluator';
import { AgentCommerceService, AGENT_COMMERCE_SERVICE_TYPE } from '../service';
import { getPluginLogger } from '../lib/logger';

export const agentCommercePlugin: Plugin = {
  name: 'agent-commerce',
  description:
    'ERC-8183 agentic commerce: job lifecycle, SHA-256 payload attestation, reputation gating, and prompt-injection protection',
  services: [AgentCommerceService],
  actions: commerceActions,
  evaluators: [commerceEvaluator],
  providers: [commerceProvider],
  events: {
    [EventType.MESSAGE_RECEIVED]: [
      async ({ runtime, message }) => {
        const service = runtime.getService<AgentCommerceService>(AGENT_COMMERCE_SERVICE_TYPE);
        if (!service) return;

        const logger = getPluginLogger(runtime);
        const guard = service.securityGuard;
        const sender = message.entityId ? String(message.entityId) : null;
        const strictMode =
          runtime.getSetting('STVOR_STRICT_MODE') === true ||
          runtime.getSetting('STVOR_STRICT_MODE') === 'true';

        if (sender !== null) {
          try {
            guard.checkRateLimit(sender);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            if (strictMode) throw new Error(`[SECURITY-GUARD] ${reason}`);
            logger.warn(`[SECURITY-GUARD] Rate limit warning for ${sender}: ${reason}`);
          }
        }

        try {
          guard.assertPayloadSafe(message.content);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          if (strictMode) throw new Error(`[SECURITY-GUARD] Message blocked: ${reason}`);
          logger.warn(`[SECURITY-GUARD] Policy violation from ${sender}: ${reason}`);
        }
      },
    ],
  },
};

export default agentCommercePlugin;

export { commerceActions } from './actions';
export { commerceProvider } from './provider';
export { commerceEvaluator } from './evaluator';
export { AgentCommerceService } from '../service';
