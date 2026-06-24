# @stvor/plugin-agent-commerce

ERC-8183 agentic commerce for [elizaOS](https://github.com/elizaOS/eliza) agents: escrow state machine, SHA-256 payload attestation, reputation gating, and prompt-injection protection.

## Install

```bash
npm install @stvor/plugin-agent-commerce
# or
bun add @stvor/plugin-agent-commerce
```

## Register with your elizaOS agent

```typescript
import { agentCommercePlugin } from '@stvor/plugin-agent-commerce';

const character = {
  name: 'CommerceAgent',
  plugins: ['@stvor/plugin-agent-commerce'],
  settings: {
    COMMERCE_MIN_REPUTATION: '50',  // minimum score to fund a job (0–100)
    STVOR_STRICT_MODE: 'true',      // treat policy violations as hard errors
  },
};
```

## What this plugin does

Implements the [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) job lifecycle:

```
OPEN → FUNDED → SUBMITTED → COMPLETE
                           ↘ REFUND
              ↘ EXPIRED
         ↘ ABORTED
```

- **Payload attestation**: every task spec and deliverable is SHA-256 hashed (`PayloadHasher`). Hash is stored on the job and verified on each handoff. Mismatch aborts the job.
- **Reputation gate**: `fundJob` checks `IReputationProvider` before any state transition. Unknown agents are denied by default; configure `COMMERCE_MIN_REPUTATION` or supply a custom provider.
- **Rate limiting + prompt-injection detection**: runs on every `MESSAGE_RECEIVED` event via the plugin's event hook (10 req/60 s per `entityId`). Configurable strict or warn-only mode.
- **Job tracking**: `COMMERCE_TRACKER` evaluator extracts job IDs from conversation and persists them in elizaOS memory.
- **Append-only persistence**: jobs are stored in elizaOS `memories`, scoped to `agentId`. Each state transition writes a new record. Recovery after restart via lazy hydration (latest `updatedAt` wins).

## Actions

| Action | Trigger | Description |
|--------|---------|-------------|
| `CREATE_SECURE_JOB` | "create a job for …" | Create an ERC-8183 job in OPEN state |
| `FUND_SECURE_JOB` | "fund job …" | Transition OPEN → FUNDED, attach task payload hash |
| `SUBMIT_DELIVERABLE` | "submit deliverable for …" | Transition FUNDED → SUBMITTED, attach deliverable hash |
| `JOB_STATUS` | "status of job …" | Return current job state |

## Evaluator

| Evaluator | `shouldRun` | Description |
|-----------|-------------|-------------|
| `COMMERCE_TRACKER` | message contains `job-*` pattern | Extracts job IDs and stores them in memory |

Security checks (rate limiting + injection detection) run as a `MESSAGE_RECEIVED` event handler — before the agent processes the message.

## Provider

`COMMERCE_CONTEXT` injects up to 5 most recent jobs into the LLM context window.

## Reputation gate

`StaticReputationProvider` is the default. Unknown agents receive score **0** (denied unless `COMMERCE_MIN_REPUTATION=0`).

To supply explicit scores:

```typescript
import { AgentCommerceService, StaticReputationProvider } from '@stvor/plugin-agent-commerce';

// Pass in plugin config (advanced — use character settings for simple cases)
const service = new AgentCommerceService(runtime, {
  reputationProvider: new StaticReputationProvider({
    minScore: 70,
    scores: {
      'trusted-agent-id': 90,
      'new-agent-id': 60,
    },
  }),
});
```

For persistent reputation across sessions, implement `IReputationProvider` backed by your own database.

## Programmatic API (without elizaOS)

```typescript
import { AgentCommercePlugin, MemoryJobStore } from '@stvor/plugin-agent-commerce';

const commerce = new AgentCommercePlugin(undefined, {
  jobStore: new MemoryJobStore(),
});

const job = await commerce.createJob('alice', 'bob', 'Build a REST API', 1_000_000n);
const funded = await commerce.fundJob(job.jobId, 'alice', 1_000_000n);
const submitted = await commerce.submitJob(job.jobId, 'bob', deliverableHash);
const completed = await commerce.evaluateJob(job.jobId, 'alice', 'ACCEPT');
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `COMMERCE_MIN_REPUTATION` | `0` | Minimum reputation score (0–100) required to fund a job |
| `STVOR_STRICT_MODE` | `false` | `true` = treat rate-limit and injection violations as hard errors |

## Development

```bash
git clone https://github.com/stvor-hq/plugin-agent-commerce
cd plugin-agent-commerce
bun install
bun run verify    # type-check + tests
bun run build     # compile to dist/
```

Tests: 35 cases across commerce lifecycle, evaluators, reputation providers, and store hydration.

## Security model

This plugin performs **policy checks and payload attestation — not transport encryption**. All payloads are SHA-256 attested; data is not encrypted in transit or at rest by this package. For encrypted agent-to-agent transport, see the roadmap below.

---

## Roadmap

### Agent-to-agent commerce
- Multi-hop job routing: client → broker → provider chains
- Parallel job splitting and result aggregation
- On-chain escrow adapter (x402 / ERC-20 settlement)

### Reputation and settlement
- Persistent `IReputationProvider` backed by elizaOS memory or external DB
- Outcome-driven score adjustment (automatic on COMPLETE/REFUND/ABORTED)
- `CompositeReputationProvider` with AND/OR policy chains

### Optional PQC transport layer (future)
- `@stvor/transport-pqc`: optional add-on package implementing ML-KEM-768 key encapsulation + AES-256-GCM message encryption for agent-to-agent communication
- Drop-in `IStvorTransport` implementation — wire it in at plugin construction, no changes to the state machine
- Protects against "harvest now, decrypt later" attacks on inter-agent task specs and deliverables

### External reputation backends
- Adapter for on-chain reputation (EAS attestations, Karma3Labs, etc.)
- Webhook-based reputation provider for custom trust scoring systems
- Reputation sharing across agent networks via signed attestations

---

## License

MIT — see [LICENSE](./LICENSE).
