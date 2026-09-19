import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import { Store } from '../server/db';
import { createApp, retrieve, riskOf } from '../server/app';
import { seedDemo } from '../server/seed';
import { ConfiguredAI, ServiceError, type AIProvider } from '../server/ai';
import type { Knowledge, Employee, Interview } from '../server/types';
import { samplePdf, sampleDocx } from './fixtures';

// Deterministic AI fixtures exist only in tests, never in application runtime.
class TestAI implements AIProvider {
  label = 'Test fixture';
  configured = true;
  fail = false;
  badSource = false;
  async generate<T>(task: string, context: unknown, schema: z.ZodType<T>): Promise<T> {
    if (this.fail) throw new ServiceError(502, 'Test provider failure');
    const ctx = context as any;
    let value: unknown;
    if (task.startsWith('Ask one'))
      value = {
        question: ctx.messages.some((m: any) => m.content.includes('Redis'))
          ? 'What should a teammate avoid when Redis connections are exhausted?'
          : 'What undocumented payment incident should a new engineer know about?',
        discoveries: ctx.messages.length ? ['Dependency: Redis'] : [],
      };
    else if (task.startsWith('Extract'))
      value = {
        cards: [
          {
            title: 'Redis payment connection exhaustion',
            summary: 'Payment 502 errors occurred when Redis connections were exhausted.',
            area: 'Payments',
            type: 'Incident',
            actions: ['Check Redis connection count'],
            warnings: ['Do not retry every failed request'],
            confidence: 0.87,
            sourceIds: this.badSource ? ['not-a-real-source'] : ctx.sources.map((s: any) => s.id),
          },
        ],
      };
    else if (task.startsWith('Compare')) value = { conflicts: [] };
    else if (task.startsWith('Answer'))
      value = {
        answer: 'Check Redis connection count. Avoid retrying every failed request [1].',
        sourceIds: this.badSource ? ['invented'] : ctx.cards.slice(0, 1).map((c: any) => c.id),
      };
    else if (task.startsWith('Summarise'))
      value = { summary: 'The note describes a payment incident and a Redis dependency.' };
    else
      value = {
        summary:
          'The handover includes payment procedures. Review unverified cards before applying them.',
        sourceIds: ctx.cards.map((c: any) => c.id),
      };
    return schema.parse(value);
  }
}
let store: Store;
let ai: TestAI;
let app: ReturnType<typeof createApp>;
let admin: ReturnType<typeof request.agent>;
beforeEach(async () => {
  store = new Store(':memory:');
  seedDemo(store);
  ai = new TestAI();
  const originals = new Map<string, Buffer>();
  app = createApp(store, ai, {
    async put(key, bytes) {
      originals.set(key, bytes);
    },
    async read(key) {
      const bytes = originals.get(key);
      if (!bytes) throw new Error('Missing test original');
      return bytes;
    },
  });
  admin = request.agent(app);
  await admin
    .post('/api/auth/login')
    .send({ email: 'alex@continuum.demo', password: 'Continuum2026!' })
    .expect(200);
});
afterEach(() => store.close());
describe('Authentication and boundaries', () => {
  it('protects data and uses HttpOnly sessions that can be revoked', async () => {
    await request(app).get('/api/bootstrap').expect(401);
    const me = await admin.get('/api/auth/me').expect(200);
    expect(me.body.user.passwordHash).toBeUndefined();
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex@continuum.demo', password: 'Continuum2026!' })
      .expect(200);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(login.headers['set-cookie'][0]).toContain('SameSite=Lax');
    await admin.post('/api/auth/logout').send({}).expect(200);
    await admin.get('/api/auth/me').expect(401);
  });
  it('rejects invalid credentials and cross-origin mutations', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'alex@continuum.demo', password: 'wrong' })
      .expect(401);
    await admin
      .post('/api/interviews')
      .set('Origin', 'https://attacker.example')
      .send({ employeeId: 'expert-1', area: 'Payments', objective: 'Handover' })
      .expect(403);
  });
  it('isolates organisations on cards, documents, conflicts, and profiles', async () => {
    const second = request.agent(app);
    await second
      .post('/api/auth/signup')
      .send({
        name: 'Other Admin',
        email: 'other@example.com',
        password: 'A-secure-password-123',
        organisation: 'Other Company',
        department: 'Engineering',
      })
      .expect(200);
    const result = await second.get('/api/bootstrap').expect(200);
    expect(result.body.knowledge).toHaveLength(0);
    expect(result.body.employees).toHaveLength(1);
    for (const path of ['/knowledge/card-1', '/employees/expert-1', '/documents/seed-source-1'])
      await second.get(`/api${path}`).expect(404);
    await second
      .post('/api/conflicts/conflict-1/resolve')
      .send({ resolution: 'keep', comment: 'Approve' })
      .expect(404);
  });
  it('enforces employee permissions on the backend', async () => {
    const employee = request.agent(app);
    await employee
      .post('/api/auth/login')
      .send({ email: 'rahul@continuum.demo', password: 'Continuum2026!' })
      .expect(200);
    await employee
      .post('/api/knowledge/card-7/review')
      .send({ action: 'verify', version: 1 })
      .expect(403);
    await employee.patch('/api/employees/expert-2').send({ name: 'Changed' }).expect(403);
    await employee
      .post('/api/interviews')
      .send({ employeeId: 'expert-2', area: 'Database', objective: 'Capture' })
      .expect(403);
    await employee.post('/api/members').send({}).expect(403);
  });
});
describe('End-to-end knowledge workflow', () => {
  it('captures answers and evidence, extracts unverified drafts, verifies, and retrieves with provenance', async () => {
    const started = await admin
      .post('/api/interviews')
      .send({ employeeId: 'expert-1', area: 'Payments', objective: 'Payment handover' })
      .expect(201);
    const id = started.body.id;
    const opening = await admin.post(`/api/interviews/${id}/messages`).send({}).expect(200);
    expect(opening.body.messages[0].content).toContain('undocumented');
    const answer = await admin
      .post(`/api/interviews/${id}/messages`)
      .send({ content: 'Redis connections were exhausted and caused payment 502s.' })
      .expect(200);
    expect(answer.body.messages.at(-1).content).toContain('Redis');
    const note = await admin
      .post('/api/documents/upload')
      .field('employeeId', 'expert-1')
      .field('interviewId', id)
      .field('title', 'Incident report')
      .field('note', 'Do not retry every failed payment. Check Redis connection count.')
      .expect(201);
    await admin.post(`/api/documents/${note.body.id}/analyse`).send({}).expect(200);
    const saved = await admin.get(`/api/interviews/${id}`).expect(200);
    expect(saved.body.messages).toHaveLength(3);
    expect(saved.body.documents).toHaveLength(1);
    const extraction = await admin.post(`/api/interviews/${id}/extract`).send({}).expect(200);
    const card = extraction.body.cards[0];
    expect(card.status).toBe('Needs Verification');
    expect(card.evidence.map((e: any) => e.sourceId)).toContain(note.body.id);
    expect(card.evidence.map((e: any) => e.sourceId)).toContain(id);
    const repeat = await admin.post(`/api/interviews/${id}/extract`).send({}).expect(200);
    expect(repeat.body.cards[0].id).toBe(card.id);
    const verified = await admin
      .post(`/api/knowledge/${card.id}/review`)
      .send({
        action: 'verify',
        version: 1,
        comment: 'Confirmed against incident evidence.',
        edits: { summary: 'Confirmed Redis exhaustion caused payment 502 errors.' },
      })
      .expect(200);
    expect(verified.body.status).toBe('Verified');
    expect(verified.body.versions).toHaveLength(2);
    expect(verified.body.versions[0].content.summary).toContain('occurred');
    await admin.patch('/api/employees/expert-1').send({ employmentStatus: 'Departed' }).expect(200);
    const asked = await admin
      .post('/api/ask')
      .send({ question: 'Redis payment connection exhaustion' })
      .expect(200);
    expect(asked.body.sources.length).toBeGreaterThan(0);
    expect(asked.body.sources.every((s: any) => s.status === 'Verified')).toBe(true);
    expect(asked.body.sources[0].evidence.length).toBeGreaterThan(0);
    const audit = await admin.get(`/api/audit?entityId=${card.id}`).expect(200);
    expect(audit.body.some((a: any) => a.action === 'Knowledge verified')).toBe(true);
  });
  it('preserves expert answers when a provider fails, and resumes without duplication', async () => {
    const result = await admin
      .post('/api/interviews')
      .send({ employeeId: 'expert-1', area: 'Payments', objective: 'Capture' });
    ai.fail = true;
    await admin
      .post(`/api/interviews/${result.body.id}/messages`)
      .send({ content: 'Redis connections are limited.' })
      .expect(502);
    let saved = await admin.get(`/api/interviews/${result.body.id}`);
    expect(saved.body.messages).toHaveLength(1);
    expect(saved.body.messages[0].sender).toBe('expert');
    ai.fail = false;
    await admin.post(`/api/interviews/${result.body.id}/messages`).send({}).expect(200);
    saved = await admin.get(`/api/interviews/${result.body.id}`);
    expect(saved.body.messages).toHaveLength(2);
  });
  it('rejects hallucinated source IDs without saving any drafts', async () => {
    const started = await admin
      .post('/api/interviews')
      .send({ employeeId: 'expert-1', area: 'Payments', objective: 'Capture' });
    await admin
      .post(`/api/interviews/${started.body.id}/messages`)
      .send({ content: 'Redis issue.' });
    const before = store.all('knowledge', 'demo-organisation').length;
    ai.badSource = true;
    await admin.post(`/api/interviews/${started.body.id}/extract`).send({}).expect(502);
    expect(store.all('knowledge', 'demo-organisation')).toHaveLength(before);
  });
  it('enforces paused and completed interview states', async () => {
    const interview = store.all<Interview>('interviews', 'demo-organisation')[0];
    await admin
      .post(`/api/interviews/${interview.id}/messages`)
      .send({ content: 'Answer' })
      .expect(409);
    await admin.patch(`/api/interviews/${interview.id}`).send({ status: 'Active' }).expect(200);
    await admin.patch(`/api/interviews/${interview.id}`).send({ status: 'Completed' }).expect(200);
    await admin
      .post(`/api/interviews/${interview.id}/messages`)
      .send({ content: 'Answer' })
      .expect(409);
  });
  it('supports human contributions without pretending to call AI', async () => {
    const result = await admin
      .post('/api/knowledge')
      .send({
        title: 'Real contributor note',
        summary: 'A documented process with original evidence.',
        area: 'Operations',
        type: 'Procedure',
        expertId: 'expert-1',
        sourceNote: 'Original contributor explanation.',
      })
      .expect(201);
    expect(result.body.confidence).toBe(0);
    expect(result.body.status).toBe('Needs Verification');
    expect(result.body.evidence[0].excerpt).toBe('Original contributor explanation.');
  });
});
describe('Review, conflict, and retrieval safety', () => {
  it('does not include unresolved or rejected knowledge in answers', async () => {
    const result = await admin
      .post('/api/ask')
      .send({ question: 'PaymentWorker manual automatic restart' })
      .expect(200);
    expect(result.body.mode).toBe('insufficient');
    expect(result.body.sources).toHaveLength(0);
    expect(result.body.related.length).toBeGreaterThan(0);
    await admin
      .post('/api/knowledge/card-1/review')
      .send({ action: 'reject', version: 1, comment: 'Not applicable' })
      .expect(200);
    const result2 = await admin
      .post('/api/ask')
      .send({ question: '502 traffic spikes' })
      .expect(200);
    expect(result2.body.sources.some((s: any) => s.id === 'card-1')).toBe(false);
  });
  it('refuses verification while a conflict is open, then records human resolution', async () => {
    await admin
      .post('/api/knowledge/card-2/review')
      .send({ action: 'verify', version: 1 })
      .expect(409);
    await admin
      .post('/api/conflicts/conflict-1/resolve')
      .send({
        resolution: 'replace',
        comment: 'Confirmed the new production pipeline restarts the worker.',
      })
      .expect(200);
    expect(store.get<Knowledge>('knowledge', 'card-2', 'demo-organisation')!.status).toBe(
      'Outdated',
    );
    expect(store.get<Knowledge>('knowledge', 'card-14', 'demo-organisation')!.status).toBe(
      'Verified',
    );
    await admin
      .post('/api/conflicts/conflict-1/resolve')
      .send({ resolution: 'keep', comment: 'Again' })
      .expect(409);
  });
  it('finds the controlled PaymentWorker contradiction and blocks stale review updates', async () => {
    const result = await admin.post('/api/knowledge').send({
      title: 'New PaymentWorker automation',
      summary: 'PaymentWorker restarts automatically after deployment.',
      area: 'Deployment',
      type: 'Procedure',
      expertId: 'expert-3',
      sourceNote: 'CI/CD automatically restarts PaymentWorker.',
    });
    const detection = await admin
      .post('/api/conflicts/detect')
      .send({ knowledgeId: result.body.id })
      .expect(200);
    expect(result.body.status).toBe('Conflict Detected');
    expect(detection.body.conflicts).toHaveLength(0); // Existing conflicts are not duplicated.
    await admin
      .post('/api/knowledge/card-7/review')
      .send({ action: 'verify', version: 1 })
      .expect(200);
    await admin
      .post('/api/knowledge/card-7/review')
      .send({ action: 'reject', version: 1, comment: 'Old browser tab' })
      .expect(409);
  });
  it('requires explanations and records clarification evidence', async () => {
    await admin
      .post('/api/knowledge/card-7/review')
      .send({ action: 'clarify', version: 1 })
      .expect(400);
    await admin
      .post('/api/knowledge/card-7/review')
      .send({ action: 'clarify', version: 1, comment: 'Which eviction policy applies?' })
      .expect(200);
    const employee = request.agent(app);
    await employee
      .post('/api/auth/login')
      .send({ email: 'rahul@continuum.demo', password: 'Continuum2026!' });
    const clarified = await employee
      .post('/api/knowledge/card-7/clarification')
      .send({ comment: 'The production payment pool uses noeviction.' })
      .expect(200);
    expect(clarified.body.status).toBe('Needs Verification');
    expect(clarified.body.evidence).toHaveLength(2);
  });
  it('rejects unsupported AI answer citations', async () => {
    ai.badSource = true;
    await admin.post('/api/ask').send({ question: 'payment 502 Redis' }).expect(502);
  });
  it('returns insufficient evidence without making a model call', async () => {
    ai.fail = true;
    const answer = await admin
      .post('/api/ask')
      .send({ question: 'How do lunar rovers operate?' })
      .expect(200);
    expect(answer.body.mode).toBe('insufficient');
  });
  it('moves overdue verified knowledge into review with an audit trail', async () => {
    const card = store.get<Knowledge>('knowledge', 'card-1', 'demo-organisation')!;
    store.put('knowledge', { ...card, reviewDueAt: '2020-01-01T00:00:00Z' });
    const result = await admin.post('/api/revalidation').send({}).expect(200);
    expect(result.body.count).toBe(1);
    expect(store.get<Knowledge>('knowledge', 'card-1', 'demo-organisation')!.status).toBe(
      'Needs Verification',
    );
  });
});
describe('Documents and reporting', () => {
  it('extracts text from real PDF and DOCX payloads', async () => {
    for (const [name, buffer] of [
      ['incident.pdf', samplePdf()],
      ['handover.docx', sampleDocx()],
    ] as const) {
      const uploaded = await admin
        .post('/api/documents/upload')
        .field('employeeId', 'expert-1')
        .attach('file', buffer, name)
        .expect(201);
      expect(uploaded.body.text).toContain('Redis connection');
    }
  });
  it('extracts UTF-8 uploads and restricts originals to authenticated users', async () => {
    const uploaded = await admin
      .post('/api/documents/upload')
      .field('employeeId', 'expert-1')
      .attach('file', Buffer.from('# Incident\nRedis connection warning.'), 'incident.md')
      .expect(201);
    expect(uploaded.body.text).toContain('Redis');
    expect(uploaded.body.storageKey).toBeUndefined();
    await request(app).get(`/api/documents/${uploaded.body.id}/download`).expect(401);
    const download = await admin.get(`/api/documents/${uploaded.body.id}/download`).expect(200);
    expect(download.headers['content-disposition']).toContain('incident.md');
  });
  it('rejects executable, binary, corrupt, and mismatched interview uploads', async () => {
    await admin
      .post('/api/documents/upload')
      .field('employeeId', 'expert-1')
      .attach('file', Buffer.from('exe'), 'run.exe')
      .expect(400);
    await admin
      .post('/api/documents/upload')
      .field('employeeId', 'expert-1')
      .attach('file', Buffer.from([0, 1, 2]), 'binary.txt')
      .expect(400);
    await admin
      .post('/api/documents/upload')
      .field('employeeId', 'expert-1')
      .attach('file', Buffer.from('invalid'), 'bad.pdf')
      .expect(400);
    const interview = store.all<Interview>('interviews', 'demo-organisation')[0];
    await admin
      .post('/api/documents/upload')
      .field('employeeId', 'expert-2')
      .field('interviewId', interview.id)
      .field('note', 'Mismatch')
      .expect(400);
  });
  it('reports actual stored counts and preserves source-linked summaries', async () => {
    const health = await admin.get('/api/reports/health').expect(200);
    expect(health.body.total).toBe(store.all('knowledge', 'demo-organisation').length);
    expect(health.body.risks.find((p: any) => p.id === 'expert-1').risk).toBe('High');
    const report = await admin
      .post('/api/reports/handover')
      .send({ employeeId: 'expert-1' })
      .expect(200);
    expect(report.body.cards.length).toBeGreaterThan(0);
    expect(
      report.body.sourceIds.every((id: string) => report.body.cards.some((c: any) => c.id === id)),
    ).toBe(true);
  });
});
