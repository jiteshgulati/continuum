import type { Store } from './db';
import { createUser, findUser, hashPassword } from './auth';
import type { Employee, Knowledge, Interview, Document, Conflict } from './types';
export function seedDemo(store: Store) {
  if (findUser(store, 'alex@continuum.demo')) return;
  store.transaction(() => {
    const orgId = 'demo-organisation';
    store.put('organisations', {
      ...store.base(orgId),
      id: orgId,
      name: 'Acme Engineering',
      reviewIntervalDays: 90,
      isDemo: true,
    });
    const admin = createUser(store, {
      ...store.base(orgId),
      name: 'Alex Morgan',
      email: 'alex@continuum.demo',
      role: 'Admin',
      passwordHash: hashPassword('Continuum2026!'),
    });
    const reviewer = createUser(store, {
      ...store.base(orgId),
      name: 'Priya Mehta',
      email: 'priya@continuum.demo',
      role: 'Reviewer',
      passwordHash: hashPassword('Continuum2026!'),
    });
    const expert = createUser(store, {
      ...store.base(orgId),
      name: 'Rahul Sharma',
      email: 'rahul@continuum.demo',
      role: 'Employee',
      passwordHash: hashPassword('Continuum2026!'),
    });
    const specs = [
      [
        'Rahul Sharma',
        'Senior Backend Engineer',
        'Engineering',
        'Departing',
        ['Payments', 'Redis', 'Backend APIs'],
        0,
        7,
        expert.id,
      ],
      [
        'Priya Mehta',
        'Database Engineer',
        'Engineering',
        'Active',
        ['PostgreSQL', 'Legacy Database'],
        1,
        4,
        reviewer.id,
      ],
      [
        'Arjun Rao',
        'DevOps Engineer',
        'Platform',
        'Active',
        ['CI/CD', 'Docker', 'Deployment'],
        4,
        3,
        '',
      ],
      [
        'Sarah Chen',
        'Product Lead',
        'Product',
        'Departing',
        ['Customer context', 'Product strategy'],
        0,
        3,
        '',
      ],
      [
        'Marcus Reed',
        'Staff Engineer',
        'Platform',
        'Active',
        ['Infrastructure', 'Observability'],
        2,
        4,
        '',
      ],
      [
        'Elena Torres',
        'Customer Success Lead',
        'Customer Success',
        'Active',
        ['Enterprise accounts', 'Onboarding'],
        2,
        2,
        '',
      ],
    ] as const;
    const people = specs.map((x, i) =>
      store.put<Employee>('employees', {
        ...store.base(orgId),
        id: `expert-${i + 1}`,
        name: x[0],
        roleTitle: x[1],
        department: x[2],
        employmentStatus: x[3],
        knowledgeAreas: [...x[4]],
        backupExperts: x[5],
        criticalAreas: x[6],
        userId: x[7] || undefined,
        departureDate:
          x[3] === 'Departing'
            ? new Date(Date.now() + (i === 0 ? 9 : 18) * 86400000).toISOString().slice(0, 10)
            : undefined,
      }),
    );
    const entries = [
      [
        'Payment API 502 during traffic spikes',
        'Payments',
        'Incident',
        0,
        'Verified',
        'High-traffic 502 errors can be caused by Redis connection exhaustion.',
        'Check Redis connection count|Inspect API Gateway logs|Compare error rates with the current traffic level',
        'Do not immediately retry all failed requests. Retries amplified load during the previous incident.',
        'Redis|API Gateway',
      ],
      [
        'PaymentWorker deployment restart',
        'Deployment',
        'Procedure',
        2,
        'Conflict Detected',
        'The older deployment runbook instructs engineers to restart PaymentWorker manually after deployment.',
        'Check the deployed version|Restart PaymentWorker manually',
        'Confirm ownership before restarting a production worker.',
        'PaymentWorker|CI/CD',
      ],
      [
        'Legacy database connection pooling',
        'Legacy Database',
        'Procedure',
        1,
        'Verified',
        'The legacy reporting service has a shared connection pool. Long-running exports can exhaust available connections.',
        'Inspect pg_stat_activity|Schedule large exports outside peak hours',
        'Do not terminate active customer transactions.',
        'PostgreSQL',
      ],
      [
        'Safe rollback for the payment service',
        'Payments',
        'Procedure',
        0,
        'Verified',
        'Payment service rollback must preserve idempotency keys to prevent duplicate charges.',
        'Check the previous release health|Keep the idempotency store intact|Run the post-rollback reconciliation',
        'Never clear the idempotency cache during rollback.',
        'Redis|Payments',
      ],
      [
        'Blue-green deployment health checks',
        'Deployment',
        'Procedure',
        2,
        'Verified',
        'Use application readiness checks before directing traffic to the green environment.',
        'Check readiness endpoint|Compare error rate|Switch traffic gradually',
        'A healthy container does not guarantee application readiness.',
        'Docker|CI/CD',
      ],
      [
        'Enterprise onboarding exceptions',
        'Customer context',
        'Customer context',
        5,
        'Needs Verification',
        'Enterprise customers with custom data residency requirements need a separate onboarding checklist.',
        'Confirm the contracted region|Review the account-specific checklist',
        'Confirm requirements with the account owner.',
        'Enterprise accounts',
      ],
      [
        'Redis eviction policy for payment keys',
        'Redis',
        'Warning',
        0,
        'Needs Verification',
        'Payment idempotency keys must not share an eviction pool with disposable session data.',
        'Inspect the active Redis eviction policy|Check key TTLs',
        'Eviction of idempotency keys can allow duplicate processing.',
        'Redis',
      ],
      [
        'Why we separate billing events',
        'Backend APIs',
        'Decision',
        0,
        'Verified',
        'Billing events are processed separately from request handling so a downstream billing failure does not block payment acknowledgements.',
        'Use the billing event queue|Monitor consumer lag',
        'Do not make acknowledgement depend on billing availability.',
        'Payments|Event queue',
      ],
      [
        'PostgreSQL migration preflight',
        'PostgreSQL',
        'Procedure',
        1,
        'Verified',
        'Large table migrations need a lock assessment before running in production.',
        'Estimate lock duration|Test against a representative dataset|Agree on a maintenance window',
        'Avoid adding blocking indexes during peak traffic.',
        'PostgreSQL',
      ],
      [
        'Customer escalation context',
        'Customer context',
        'Customer context',
        3,
        'Needs Clarification',
        'The enterprise escalation route depends on severity and account commitments. The response-time exceptions need confirmation.',
        'Check the customer agreement|Contact the account owner',
        'Response targets differ by contract.',
        'Customer Success',
      ],
      [
        'Observability during traffic surges',
        'Observability',
        'Incident',
        4,
        'Verified',
        'Inspect request latency, dependency error rates and queue depth together during a traffic surge.',
        'Compare latency and throughput|Inspect dependency errors|Track queue depth',
        'A drop in errors may indicate dropped requests rather than recovery.',
        'Metrics|Tracing',
      ],
      [
        'Container image promotion checklist',
        'CI/CD',
        'Procedure',
        2,
        'Verified',
        'Promote the tested image digest to production to keep release artifacts consistent.',
        'Record the approved digest|Verify the signature|Promote the same digest',
        'Avoid rebuilding images between staging and production.',
        'Docker',
      ],
      [
        'Product decision archive ownership',
        'Product strategy',
        'Decision',
        3,
        'Needs Verification',
        'Product decisions should preserve the customer context and assumptions that supported the original trade-off.',
        'Link supporting research|Record the decision owner|List assumptions to revisit',
        'A decision without context is easy to misapply.',
        'Product strategy',
      ],
      [
        'Automated PaymentWorker restarts',
        'Deployment',
        'Procedure',
        2,
        'Conflict Detected',
        'The new CI/CD pipeline automatically restarts PaymentWorker after deployment. A manual restart is no longer required.',
        'Let the pipeline restart PaymentWorker|Verify worker readiness',
        'Do not manually restart while the rollout is in progress.',
        'PaymentWorker|CI/CD',
      ],
    ] as const;
    entries.forEach((x, i) => {
      const person = people[x[3]];
      const createdAt = new Date(Date.now() - (29 - i * 2) * 86400000).toISOString();
      const doc = store.put<Document>('documents', {
        ...store.base(orgId),
        id: `seed-source-${i + 1}`,
        createdAt,
        employeeId: person.id,
        fileName: `${x[1].toLowerCase().replace(/\W+/g, '-')}-handover-note.md`,
        text: `${x[0]}\n\n${x[5]}\n\n${x[6].split('|').join('\n')}\n\n${x[7]}\n\nExample workspace source material.`,
        status: 'Extracted',
      });
      const card: Knowledge = {
        ...store.base(orgId),
        id: `card-${i + 1}`,
        createdAt,
        title: x[0],
        area: x[1],
        type: x[2],
        expertId: person.id,
        status: x[4],
        summary: x[5],
        actions: x[6].split('|'),
        warnings: [x[7]],
        symptoms:
          i === 0 ? ['HTTP 502 responses', 'Traffic spike', 'High Redis connection count'] : [],
        reasoning:
          i === 0
            ? 'During a previous incident, immediate retries increased system load and prolonged recovery.'
            : 'Preserve the operational context from the source note and confirm applicability before using this procedure.',
        dependencies: x[8].split('|'),
        exceptions: [],
        tags: x[1].toLowerCase().split(' '),
        confidence: 0.84 + (i % 3) * 0.03,
        clarificationQuestions: [],
        evidence: [
          {
            sourceId: doc.id,
            sourceType: 'note',
            label: doc.fileName,
            excerpt: doc.text,
            supportType: 'Supporting',
          },
        ],
        version: 1,
        versions: [],
      };
      if (x[4] === 'Verified') {
        card.lastVerifiedAt = createdAt;
        card.verifiedBy = reviewer.name;
        card.reviewDueAt = new Date(new Date(createdAt).getTime() + 90 * 86400000).toISOString();
      }
      card.versions = [
        {
          version: 1,
          content: {
            title: card.title,
            summary: card.summary,
            actions: card.actions,
            warnings: card.warnings,
            status: card.status,
          },
          actor: person.name,
          createdAt,
          reason: 'Example knowledge captured',
        },
      ];
      store.put('knowledge', card);
      store.audit(
        orgId,
        person.name,
        card.id,
        x[4] === 'Verified' ? 'Knowledge verified' : 'Knowledge captured',
        card.title,
      );
    });
    store.put<Conflict>('conflicts', {
      ...store.base(orgId),
      id: 'conflict-1',
      knowledgeAId: 'card-2',
      knowledgeBId: 'card-14',
      reason:
        'The original runbook requires a manual PaymentWorker restart. The new deployment procedure says the pipeline restarts it automatically. Confirm which procedure applies to the current pipeline.',
      severity: 'High',
      status: 'Open',
    });
    store.put<Interview>('interviews', {
      ...store.base(orgId),
      employeeId: people[0].id,
      createdBy: admin.id,
      area: 'Payments',
      objective: 'Preserve payment incident knowledge before departure',
      status: 'Paused',
      messages: [
        {
          id: 'seed-question',
          sender: 'assistant',
          content:
            'What is something about the payment system that a new engineer probably would not know?',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'seed-answer',
          sender: 'expert',
          content:
            'During traffic spikes, the payment API sometimes returns 502 errors. The first thing I check is Redis connections. We hit connection limits during the last incident.',
          createdAt: new Date().toISOString(),
        },
      ],
      discoveries: ['Incident: Payment API 502', 'Dependency: Redis connection limits'],
      extractedCardIds: [],
    });
    store.put('notifications', {
      ...store.base(orgId),
      message: 'PaymentWorker procedures need a human decision.',
      href: '/conflicts',
      read: false,
    });
    store.put('notifications', {
      ...store.base(orgId),
      message: 'Three knowledge cards are ready for verification.',
      href: '/verification',
      read: false,
    });
  });
}
