import type { Plugin } from '@elizaos/core';
import { commerceActions } from './actions';
import { commerceProvider } from './provider';
import { securityEvaluator, commerceEvaluator } from './evaluator';
import { AgentCommerceService } from '../service';

export const agentCommercePlugin: Plugin = {
  name: 'agent-commerce',
  description:
    'ERC-8183 agentic commerce: job lifecycle, SHA-256 payload attestation, reputation gating, and prompt-injection protection',
  services: [AgentCommerceService],
  actions: commerceActions,
  evaluators: [securityEvaluator, commerceEvaluator],
  providers: [commerceProvider],
};

export default agentCommercePlugin;

export { commerceActions } from './actions';
export { commerceProvider } from './provider';
export { securityEvaluator, commerceEvaluator } from './evaluator';
export { AgentCommerceService } from '../service';
