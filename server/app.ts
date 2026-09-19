import express, { type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { existsSync } from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { Store } from './db';
import { fileStorage, type FileStorage } from './storage';
import {
  checkPassword,
  createUser,
  digest,
  findUser,
  hashPassword,
  newSession,
  publicUser,
  sessionUser,
} from './auth';
import {
  ConfiguredAI,
  ServiceError,
  answerSchema,
  conflictsSchema,
  extractedSchema,
  questionSchema,
  tasks,
  type AIProvider,
} from './ai';
import type {
  Base,
  User,
  Employee,
  Interview,
  Knowledge,
  Document,
  Conflict,
  Notification,
} from './types';

const text = z.string().trim().min(1).max(6000);
const employeeFields = z.object({
  name: z.string().trim().min(2).max(100),
  roleTitle: z.string().trim().min(2).max(100),
  department: z.string().trim().min(2).max(100),
  employmentStatus: z.enum(['Active', 'Departing', 'Departed']),
  knowledgeAreas: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  backupExperts: z.number().int().min(0).max(100),
  criticalAreas: z.number().int().min(0).max(100),
  departureDate: z.string().max(20).optional(),
});
const cardFields = z.object({
  title: z.string().trim().min(3).max(200),
  summary: text,
  area: z.string().trim().min(1).max(100),
  type: z.enum(['Incident', 'Procedure', 'Warning', 'Decision', 'Dependency', 'Customer context']),
  symptoms: z.array(text).max(30).default([]),
  actions: z.array(text).max(30).default([]),
  warnings: z.array(text).max(30).default([]),
  reasoning: z.string().max(6000).default(''),
  dependencies: z.array(text).max(30).default([]),
  exceptions: z.array(text).max(30).default([]),
  tags: z.array(text).max(20).default([]),
});
const safeDocument = (doc: Document) => {
  const { storageKey, ...safe } = doc;
  return safe;
};
const snapshot = (card: Knowledge) => {
  const { versions, ...content } = card;
  return content;
};
export function riskOf(employee: Employee) {
  return employee.employmentStatus !== 'Active' &&
    employee.backupExperts === 0 &&
    employee.criticalAreas > 0
    ? 'High'
    : employee.backupExperts <= 1
      ? 'Medium'
      : 'Low';
}
const stopWords = new Set(
  'what which should could would about with this that have does during from your how the and for are can check please tell system'.split(
    ' ',
  ),
);
export function retrieve(cards: Knowledge[], question: string) {
  const tokens = [...new Set(question.toLowerCase().match(/[a-z0-9]+/g) || [])].filter(
    (x) => x.length > 2 && !stopWords.has(x),
  );
  return cards
    .map((card) => {
      const haystack =
        `${card.title} ${card.area} ${card.summary} ${card.tags.join(' ')} ${card.symptoms.join(' ')}`.toLowerCase();
      const score = tokens.reduce(
        (sum, t) =>
          sum + (haystack.includes(t) ? (card.title.toLowerCase().includes(t) ? 3 : 1) : 0),
        0,
      );
      return { card, score };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(b.card.lastVerifiedAt || b.card.createdAt) -
          Date.parse(a.card.lastVerifiedAt || a.card.createdAt),
    )
    .slice(0, 5)
    .map((x) => x.card);
}

export function createApp(
  store = new Store(),
  ai: AIProvider = new ConfiguredAI(),
  files: FileStorage = fileStorage(),
) {
  const app = express();
  app.disable('x-powered-by');
  const busy = new Set<string>();
  const rates = new Map<string, { count: number; reset: number }>();
  const limited = (key: string, max: number, window = 60000) => {
    const now = Date.now();
    if (rates.size > 10000) for (const [k, v] of rates) if (v.reset < now) rates.delete(k);
    let rate = rates.get(key);
    if (!rate || rate.reset < now) {
      rate = { count: 0, reset: now + window };
      rates.set(key, rate);
    }
    if (++rate.count > max)
      throw new ServiceError(429, 'Too many requests. Please wait a moment and retry.');
  };
  const locked = async <T>(key: string, fn: () => Promise<T>) => {
    if (busy.has(key))
      throw new ServiceError(409, 'This operation is already in progress. Please wait.');
    busy.add(key);
    try {
      return await fn();
    } finally {
      busy.delete(key);
    }
  };
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin) {
        const allowed = new Set([
          process.env.APP_ORIGIN,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          `http://127.0.0.1:${process.env.PORT || 3001}`,
          `http://localhost:${process.env.PORT || 3001}`,
        ]);
        if (!allowed.has(origin))
          return next(new ServiceError(403, 'This request origin is not allowed.'));
      }
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  const current = (res: Response) => res.locals.user as User;
  const requireRole = (res: Response, roles: string[]) => {
    if (!roles.includes(current(res).role))
      throw new ServiceError(403, 'Your role does not have permission to perform this action.');
  };
  const get = <T extends Base>(kind: string, id: string, res: Response): T => {
    const item = store.get<T>(kind, id, current(res).orgId);
    if (!item) throw new ServiceError(404, 'This item could not be found.');
    return item;
  };
  const ownEmployee = (employee: Employee, res: Response) => {
    if (current(res).role === 'Employee' && employee.userId !== current(res).id)
      throw new ServiceError(403, 'You can only modify your own profile and handovers.');
  };
  const ownInterview = (interview: Interview, res: Response) =>
    ownEmployee(get<Employee>('employees', interview.employeeId, res), res);
  const notify = (orgId: string, message: string, href: string, userId?: string) =>
    store.put<Notification>('notifications', {
      ...store.base(orgId),
      message,
      href,
      read: false,
      userId,
    });
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
  };
  const login = (res: Response, user: User, remember = false) => {
    const session = newSession(store, user, remember);
    res.cookie('continuum_session', session.token, { ...cookieOptions, maxAge: session.age });
    res.json({ user: publicUser(user) });
  };
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/auth/config', (_req, res) =>
    res.json({ demo: process.env.NODE_ENV !== 'production' || process.env.ENABLE_DEMO === 'true' }),
  );
  app.post('/api/auth/login', (req, res) => {
    limited(`login:${req.ip}`, 15, 600000);
    const body = z
      .object({ email: z.email(), password: z.string().max(200), remember: z.boolean().optional() })
      .parse(req.body);
    const user = findUser(store, body.email);
    if (!user || !checkPassword(body.password, user.passwordHash))
      throw new ServiceError(401, 'The email or password is incorrect.');
    login(res, user, body.remember);
  });
  app.post('/api/auth/signup', (req, res) => {
    limited(`signup:${req.ip}`, 8, 3600000);
    const body = z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.email(),
        password: z.string().min(12).max(128),
        organisation: z.string().trim().min(2).max(100),
        department: z.string().trim().min(2).max(100),
      })
      .parse(req.body);
    if (findUser(store, body.email))
      throw new ServiceError(409, 'An account with this email already exists.');
    const user = store.transaction(() => {
      const orgId = randomUUID();
      store.put('organisations', {
        ...store.base(orgId),
        id: orgId,
        name: body.organisation,
        reviewIntervalDays: 90,
      });
      const user = createUser(store, {
        ...store.base(orgId),
        name: body.name,
        email: body.email.toLowerCase(),
        role: 'Admin',
        passwordHash: hashPassword(body.password),
      });
      store.put<Employee>('employees', {
        ...store.base(orgId),
        userId: user.id,
        name: body.name,
        roleTitle: 'Workspace administrator',
        department: body.department,
        employmentStatus: 'Active',
        knowledgeAreas: ['General'],
        backupExperts: 0,
        criticalAreas: 0,
      });
      store.audit(orgId, user.name, orgId, 'Workspace created');
      return user;
    });
    login(res, user);
  });
  app.use('/api', (req, res, next) => {
    const user = sessionUser(store, req);
    if (!user) return res.status(401).json({ error: 'Please sign in to continue.' });
    res.locals.user = user;
    next();
  });
  app.get('/api/auth/me', (_req, res) => res.json({ user: publicUser(current(res)) }));
  app.post('/api/auth/logout', (req, res) => {
    const token = req.headers.cookie
      ?.split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith('continuum_session='))
      ?.slice(18);
    if (token) store.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
    res.clearCookie('continuum_session', cookieOptions);
    res.json({ ok: true });
  });
  app.get('/api/bootstrap', (_req, res) => {
    const user = current(res);
    const org = store.get<Base & { name: string; reviewIntervalDays: number; isDemo?: boolean }>(
      'organisations',
      user.orgId,
      user.orgId,
    );
    res.json({
      user: publicUser(user),
      organisation: org,
      ai: { provider: ai.label, configured: ai.configured },
      employees: store.all<Employee>('employees', user.orgId),
      knowledge: store.all<Knowledge>('knowledge', user.orgId),
      conflicts: store.all<Conflict>('conflicts', user.orgId),
      interviews: store
        .all<Interview>('interviews', user.orgId)
        .filter(
          (x) =>
            user.role !== 'Employee' ||
            store.get<Employee>('employees', x.employeeId, user.orgId)?.userId === user.id,
        ),
      notifications: store
        .all<Notification>('notifications', user.orgId)
        .filter((x) => !x.userId || x.userId === user.id),
      audit: store.all('audit', user.orgId).slice(0, 50),
    });
  });
  app.post('/api/notifications/read', (_req, res) => {
    const user = current(res);
    for (const n of store
      .all<Notification>('notifications', user.orgId)
      .filter((x) => !x.userId || x.userId === user.id))
      store.put('notifications', { ...n, read: true });
    res.json({ ok: true });
  });
  app.post('/api/employees', (req, res) => {
    requireRole(res, ['Admin']);
    const body = employeeFields.parse(req.body);
    const item = store.put<Employee>('employees', { ...store.base(current(res).orgId), ...body });
    store.audit(item.orgId, current(res).name, item.id, 'Employee added', item.name);
    res.status(201).json(item);
  });
  app.patch('/api/employees/:id', (req, res) => {
    const employee = get<Employee>('employees', req.params.id, res);
    ownEmployee(employee, res);
    const updates = employeeFields.partial().parse(req.body);
    if (
      current(res).role === 'Employee' &&
      (updates.employmentStatus ||
        updates.backupExperts !== undefined ||
        updates.criticalAreas !== undefined ||
        updates.departureDate !== undefined)
    )
      throw new ServiceError(
        403,
        'Only an administrator or reviewer can update employment and risk settings.',
      );
    const item = store.put('employees', { ...employee, ...updates });
    store.audit(item.orgId, current(res).name, item.id, 'Profile updated', JSON.stringify(updates));
    res.json(item);
  });
  app.get('/api/employees/:id', (req, res) => {
    const employee = get<Employee>('employees', req.params.id, res);
    res.json({
      ...employee,
      documents: store
        .all<Document>('documents', employee.orgId)
        .filter((x) => x.employeeId === employee.id)
        .map(safeDocument),
    });
  });
  app.post('/api/members', (req, res) => {
    requireRole(res, ['Admin']);
    const body = z
      .object({
        name: z.string().min(2).max(100),
        email: z.email(),
        password: z.string().min(12).max(128),
        role: z.enum(['Employee', 'Reviewer']),
        employeeId: z.string().optional(),
      })
      .parse(req.body);
    if (findUser(store, body.email))
      throw new ServiceError(409, 'This email already has an account.');
    if (body.employeeId && get<Employee>('employees', body.employeeId, res).userId)
      throw new ServiceError(409, 'This profile is already linked to an account.');
    const user = store.transaction(() => {
      const user = createUser(store, {
        ...store.base(current(res).orgId),
        name: body.name,
        email: body.email.toLowerCase(),
        role: body.role,
        passwordHash: hashPassword(body.password),
      });
      if (body.employeeId) {
        const employee = get<Employee>('employees', body.employeeId, res);
        store.put('employees', { ...employee, userId: user.id });
      } else
        store.put<Employee>('employees', {
          ...store.base(user.orgId),
          name: user.name,
          userId: user.id,
          roleTitle: 'Team member',
          department: 'General',
          knowledgeAreas: ['General'],
          employmentStatus: 'Active',
          backupExperts: 0,
          criticalAreas: 0,
        });
      store.audit(user.orgId, current(res).name, user.id, 'Member created', user.role);
      return user;
    });
    res.status(201).json(publicUser(user));
  });
  app.patch('/api/settings', (req, res) => {
    requireRole(res, ['Admin']);
    const body = z
      .object({
        name: z.string().trim().min(2).max(100),
        reviewIntervalDays: z.number().int().min(7).max(730),
      })
      .parse(req.body);
    const org = get<Base>('organisations', current(res).orgId, res);
    store.put('organisations', { ...org, ...body });
    store.audit(org.orgId, current(res).name, org.id, 'Workspace settings updated');
    res.json({ ok: true });
  });
  app.post('/api/auth/password', (req, res) => {
    const body = z
      .object({ currentPassword: z.string().max(128), newPassword: z.string().min(12).max(128) })
      .parse(req.body);
    const user = current(res);
    if (!checkPassword(body.currentPassword, user.passwordHash))
      throw new ServiceError(400, 'Your current password is incorrect.');
    store.transaction(() => {
      store.put('users', { ...user, passwordHash: hashPassword(body.newPassword) });
      store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    });
    login(res, user);
  });

  app.post('/api/interviews', (req, res) => {
    const body = z
      .object({
        employeeId: z.string(),
        area: z.string().min(1).max(100),
        objective: z.string().min(1).max(1000),
      })
      .parse(req.body);
    ownEmployee(get<Employee>('employees', body.employeeId, res), res);
    const interview = store.put<Interview>('interviews', {
      ...store.base(current(res).orgId),
      ...body,
      createdBy: current(res).id,
      status: 'Active',
      messages: [],
      discoveries: [],
      extractedCardIds: [],
    });
    store.audit(interview.orgId, current(res).name, interview.id, 'Handover started', body.area);
    res.status(201).json(interview);
  });
  app.get('/api/interviews/:id', (req, res) => {
    const interview = get<Interview>('interviews', req.params.id, res);
    ownInterview(interview, res);
    res.json({
      ...interview,
      documents: store
        .all<Document>('documents', interview.orgId)
        .filter((x) => x.interviewId === interview.id)
        .map(safeDocument),
    });
  });
  app.patch('/api/interviews/:id', (req, res) => {
    const interview = get<Interview>('interviews', req.params.id, res);
    ownInterview(interview, res);
    if (busy.has(interview.id))
      throw new ServiceError(409, 'Wait for the current interview operation to finish.');
    if (interview.status === 'Completed')
      throw new ServiceError(
        409,
        'This interview is complete. Start a new handover to capture more.',
      );
    const { status } = z
      .object({ status: z.enum(['Active', 'Paused', 'Completed']) })
      .parse(req.body);
    store.put('interviews', { ...interview, status });
    store.audit(
      interview.orgId,
      current(res).name,
      interview.id,
      `Handover ${status.toLowerCase()}`,
    );
    res.json({ ok: true });
  });
  app.post('/api/interviews/:id/messages', async (req, res) => {
    const result = await locked(req.params.id, async () => {
      let interview = get<Interview>('interviews', req.params.id, res);
      ownInterview(interview, res);
      if (interview.status !== 'Active')
        throw new ServiceError(409, 'Resume this interview before adding an answer.');
      const { content } = z
        .object({ content: z.string().trim().max(12000).optional() })
        .parse(req.body);
      if (content) {
        interview = {
          ...interview,
          messages: [
            ...interview.messages,
            { id: randomUUID(), sender: 'expert', content, createdAt: new Date().toISOString() },
          ],
        };
        store.put('interviews', interview);
      }
      if (interview.messages.at(-1)?.sender === 'assistant') return interview;
      limited(`ai:${current(res).id}`, 20);
      const result = await ai.generate(
        tasks.question,
        {
          employee: get<Employee>('employees', interview.employeeId, res),
          area: interview.area,
          objective: interview.objective,
          messages: interview.messages.slice(-30),
        },
        questionSchema,
      );
      return store.put('interviews', {
        ...interview,
        messages: [
          ...interview.messages,
          {
            id: randomUUID(),
            sender: 'assistant' as const,
            content: result.question,
            createdAt: new Date().toISOString(),
          },
        ],
        discoveries: result.discoveries,
      });
    });
    res.json(result);
  });

  async function detect(
    orgId: string,
    actor: string,
    source: { text: string; id: string; kind: 'document' | 'knowledge' },
    area?: string,
  ) {
    const cards = store
      .all<Knowledge>('knowledge', orgId)
      .filter(
        (c) => c.id !== source.id && !['Archived', 'Rejected', 'Outdated'].includes(c.status),
      );
    const related = retrieve(cards, `${area || ''} ${source.text.slice(0, 3000)}`);
    let findings: { knowledgeId: string; reason: string; severity: 'High' | 'Medium' | 'Low' }[] =
      [];
    // Deterministic rule for the concrete hackathon example; never presented as AI analysis.
    for (const card of related) {
      const existing = `${card.summary} ${card.actions.join(' ')}`;
      const automated = /automatic|automatically/i;
      const manual = /manually|manual restart/i;
      if (
        /PaymentWorker/i.test(existing) &&
        /PaymentWorker/i.test(source.text) &&
        ((manual.test(existing) && automated.test(source.text)) ||
          (automated.test(existing) && manual.test(source.text)))
      )
        findings.push({
          knowledgeId: card.id,
          reason:
            'These PaymentWorker procedures disagree about whether a restart is manual or automatic. A reviewer must confirm the applicable deployment process.',
          severity: 'High',
        });
    }
    if (ai.configured && related.length) {
      const result = await ai.generate(
        tasks.conflict,
        {
          newSource: source,
          existingKnowledge: related.map((c) => ({
            id: c.id,
            title: c.title,
            summary: c.summary,
            actions: c.actions,
            warnings: c.warnings,
          })),
        },
        conflictsSchema,
      );
      for (const item of result.conflicts)
        if (
          related.some((c) => c.id === item.knowledgeId) &&
          !findings.some((x) => x.knowledgeId === item.knowledgeId)
        )
          findings.push(item);
    }
    const opened: Conflict[] = [];
    store.transaction(() => {
      for (const f of findings) {
        if (
          store
            .all<Conflict>('conflicts', orgId)
            .some(
              (c) =>
                c.status === 'Open' &&
                c.knowledgeAId === f.knowledgeId &&
                (c.knowledgeBId === source.id || c.evidenceId === source.id),
            )
        )
          continue;
        const card = store.get<Knowledge>('knowledge', f.knowledgeId, orgId)!;
        if (['Archived', 'Rejected', 'Outdated'].includes(card.status)) continue;
        const conflict = store.put<Conflict>('conflicts', {
          ...store.base(orgId),
          knowledgeAId: card.id,
          ...(source.kind === 'knowledge'
            ? { knowledgeBId: source.id }
            : { evidenceId: source.id }),
          reason: f.reason,
          severity: f.severity,
          status: 'Open',
        });
        setVersion(
          card,
          { status: 'Conflict Detected' },
          actor,
          'Potential contradiction detected',
        );
        if (source.kind === 'knowledge') {
          const second = store.get<Knowledge>('knowledge', source.id, orgId);
          if (second)
            setVersion(
              second,
              { status: 'Conflict Detected' },
              actor,
              'Potential contradiction detected',
            );
        }
        store.audit(orgId, actor, conflict.id, 'Conflict opened', f.reason);
        notify(orgId, 'A knowledge conflict needs review.', '/conflicts');
        opened.push(conflict);
      }
    });
    return opened;
  }
  function setVersion(card: Knowledge, updates: Partial<Knowledge>, actor: string, reason: string) {
    const next = { ...card, ...updates, version: card.version + 1 };
    next.versions = [
      ...card.versions,
      {
        version: next.version,
        content: snapshot(next),
        actor,
        createdAt: new Date().toISOString(),
        reason,
      },
    ];
    return store.put('knowledge', next);
  }
  app.post('/api/interviews/:id/extract', async (req, res) => {
    const result = await locked(req.params.id, async () => {
      const interview = get<Interview>('interviews', req.params.id, res);
      ownInterview(interview, res);
      if (interview.extractedCardIds.length)
        return {
          cards: interview.extractedCardIds.map((id) => get<Knowledge>('knowledge', id, res)),
        };
      if (!interview.messages.some((m) => m.sender === 'expert'))
        throw new ServiceError(400, 'Add at least one expert answer before extracting knowledge.');
      limited(`ai:${current(res).id}`, 20);
      const docs = store
        .all<Document>('documents', interview.orgId)
        .filter((x) => x.interviewId === interview.id);
      const sources = [
        {
          id: interview.id,
          label: 'Handover interview',
          type: 'interview' as const,
          text: interview.messages.map((m) => `${m.sender}: ${m.content}`).join('\n'),
        },
        ...docs.map((d) => ({
          id: d.id,
          label: d.fileName,
          type: 'document' as const,
          text: d.text.slice(0, 30000),
        })),
      ];
      const result = await ai.generate(
        tasks.extract,
        { area: interview.area, sources },
        extractedSchema,
      );
      if (result.cards.some((c) => c.sourceIds.some((id) => !sources.some((s) => s.id === id))))
        throw new ServiceError(
          502,
          'The model returned an unknown source. Please retry extraction.',
        );
      const cards = store.transaction(() => {
        const cards = result.cards.map((c) => {
          const { sourceIds, ...fields } = c;
          const card: Knowledge = {
            ...store.base(interview.orgId),
            ...fields,
            expertId: interview.employeeId,
            status: 'Needs Verification',
            version: 1,
            versions: [],
            evidence: sourceIds.map((id) => {
              const source = sources.find((x) => x.id === id)!;
              return {
                sourceId: id,
                sourceType: source.type,
                excerpt: source.text,
                label: source.label,
                supportType: 'Supporting' as const,
              };
            }),
          };
          card.versions = [
            {
              version: 1,
              content: snapshot(card),
              actor: current(res).name,
              createdAt: card.createdAt,
              reason: 'AI extraction; awaiting human verification',
            },
          ];
          store.put('knowledge', card);
          store.audit(card.orgId, current(res).name, card.id, 'Knowledge extracted', card.title);
          return card;
        });
        store.put('interviews', {
          ...interview,
          status: 'Completed',
          extractedCardIds: cards.map((c) => c.id),
        });
        notify(
          interview.orgId,
          `${cards.length} new knowledge cards need verification.`,
          '/verification',
        );
        return cards;
      });
      let conflictWarning = '';
      for (const card of cards) {
        try {
          await detect(
            card.orgId,
            current(res).name,
            { id: card.id, kind: 'knowledge', text: `${card.summary}\n${card.actions.join('\n')}` },
            card.area,
          );
        } catch {
          conflictWarning = 'Cards were saved, but conflict analysis failed. Retry from Conflicts.';
        }
      }
      return {
        cards: cards.map((c) => get<Knowledge>('knowledge', c.id, res)),
        warning: conflictWarning,
      };
    });
    res.json(result);
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
    fileFilter: (_req, file, cb) => {
      if (!['.pdf', '.txt', '.md', '.docx'].includes(extname(file.originalname).toLowerCase()))
        return cb(
          new ServiceError(400, 'Supported files: PDF, DOCX, TXT and Markdown (up to 10 MB).'),
        );
      cb(null, true);
    },
  });
  app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    const body = z
      .object({
        employeeId: z.string(),
        interviewId: z.string().optional(),
        note: z.string().trim().max(100000).optional(),
        title: z.string().max(120).optional(),
      })
      .parse(req.body);
    ownEmployee(get<Employee>('employees', body.employeeId, res), res);
    if (body.interviewId) {
      const interview = get<Interview>('interviews', body.interviewId, res);
      if (interview.employeeId !== body.employeeId)
        throw new ServiceError(400, 'The document and interview must belong to the same employee.');
      ownInterview(interview, res);
    }
    if (!req.file && !body.note) throw new ServiceError(400, 'Choose a file or enter a note.');
    const base = store.base(current(res).orgId);
    let content = body.note || '';
    let storageKey: string | undefined;
    let fileName = body.title || 'Handover note';
    if (req.file) {
      fileName = basename(req.file.originalname).replace(/[^a-zA-Z0-9._ -]/g, '_');
      const extension = extname(fileName).toLowerCase();
      try {
        if (extension === '.pdf') {
          const parser = new PDFParse({ data: req.file.buffer });
          try {
            content = (await parser.getText()).text;
          } finally {
            await parser.destroy();
          }
        } else if (extension === '.docx') {
          content = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
        } else {
          if (req.file.buffer.includes(0)) throw new Error('Binary file');
          content = new TextDecoder('utf-8', { fatal: true }).decode(req.file.buffer);
        }
      } catch {
        throw new ServiceError(
          400,
          'The document could not be read. Upload an unencrypted text-based PDF, valid DOCX, or UTF-8 text file. Scanned PDFs need OCR first.',
        );
      }
      if (!content.trim())
        throw new ServiceError(
          400,
          'No text was found in this file. Scanned PDFs are not supported.',
        );
      if (content.length > 500000)
        throw new ServiceError(
          400,
          'This document contains too much text. Please split it into smaller documents.',
        );
      storageKey = `${base.id}${extension}`;
      await files.put(storageKey, req.file.buffer);
    }
    const doc = store.put<Document>('documents', {
      ...base,
      employeeId: body.employeeId,
      interviewId: body.interviewId,
      fileName,
      storageKey,
      text: content,
      status: 'Extracted',
    });
    store.audit(doc.orgId, current(res).name, doc.id, 'Evidence added', fileName);
    res.status(201).json(safeDocument(doc));
  });
  app.get('/api/documents/:id', (req, res) =>
    res.json(safeDocument(get<Document>('documents', req.params.id, res))),
  );
  app.get('/api/documents/:id/download', async (req, res) => {
    const doc = get<Document>('documents', req.params.id, res);
    if (!doc.storageKey) return res.type('text/plain').send(doc.text);
    res.attachment(doc.fileName).send(await files.read(doc.storageKey));
  });
  app.post('/api/documents/:id/analyse', async (req, res) => {
    const doc = get<Document>('documents', req.params.id, res);
    ownEmployee(get<Employee>('employees', doc.employeeId, res), res);
    limited(`ai:${current(res).id}`, 20);
    try {
      const analysis = await ai.generate(
        'Summarise the supplied evidence and identify procedures, warnings, and gaps. Do not invent facts. Return {summary:string}.',
        { sourceId: doc.id, text: doc.text.slice(0, 50000) },
        z.object({ summary: z.string().min(1).max(8000) }),
      );
      const conflicts = await detect(doc.orgId, current(res).name, {
        id: doc.id,
        kind: 'document',
        text: doc.text,
      });
      const updated = store.put('documents', {
        ...doc,
        status: 'Analysed' as const,
        analysis: analysis.summary,
        analysisError: undefined,
      });
      store.audit(
        doc.orgId,
        current(res).name,
        doc.id,
        'Document analysed',
        `${conflicts.length} potential conflicts`,
      );
      res.json(safeDocument(updated));
    } catch (error) {
      store.put('documents', {
        ...doc,
        analysisError: 'Analysis failed. Your extracted text is preserved.',
      });
      store.audit(doc.orgId, current(res).name, doc.id, 'Document analysis failed');
      throw error;
    }
  });

  app.get('/api/knowledge', (_req, res) =>
    res.json(store.all<Knowledge>('knowledge', current(res).orgId)),
  );
  app.get('/api/knowledge/:id', (req, res) =>
    res.json(get<Knowledge>('knowledge', req.params.id, res)),
  );
  app.post('/api/knowledge', async (req, res) => {
    const body = cardFields.extend({ expertId: z.string(), sourceNote: text }).parse(req.body);
    const employee = get<Employee>('employees', body.expertId, res);
    ownEmployee(employee, res);
    limited(`contribution:${current(res).id}`, 20);
    const { sourceNote, ...fields } = body;
    const card = store.transaction(() => {
      const doc = store.put<Document>('documents', {
        ...store.base(current(res).orgId),
        employeeId: body.expertId,
        fileName: 'Contributor source note',
        text: sourceNote,
        status: 'Extracted',
      });
      const card: Knowledge = {
        ...store.base(current(res).orgId),
        ...fields,
        status: 'Needs Verification',
        confidence: 0,
        clarificationQuestions: [],
        evidence: [
          {
            sourceId: doc.id,
            sourceType: 'note',
            excerpt: sourceNote,
            label: doc.fileName,
            supportType: 'Supporting',
          },
        ],
        version: 1,
        versions: [],
      };
      card.versions = [
        {
          version: 1,
          content: snapshot(card),
          actor: current(res).name,
          createdAt: card.createdAt,
          reason: 'Contributor submitted knowledge',
        },
      ];
      store.put('knowledge', card);
      store.audit(card.orgId, current(res).name, card.id, 'Knowledge submitted', card.title);
      notify(card.orgId, 'A contributor submitted a knowledge card.', '/verification');
      return card;
    });
    let warning: string | undefined;
    try {
      await detect(
        card.orgId,
        current(res).name,
        {
          id: card.id,
          kind: 'knowledge',
          text: `${card.summary}\n${card.actions.join('\n')}\n${sourceNote}`,
        },
        card.area,
      );
    } catch {
      warning = 'Knowledge saved, but conflict analysis failed. Retry from Conflicts.';
      store.audit(card.orgId, current(res).name, card.id, 'Conflict analysis failed');
    }
    res.status(201).json({ ...get<Knowledge>('knowledge', card.id, res), warning });
  });
  app.post('/api/knowledge/:id/review', (req, res) => {
    requireRole(res, ['Admin', 'Reviewer']);
    const body = z
      .object({
        action: z.enum(['verify', 'reject', 'clarify', 'dispute', 'archive', 'submit']),
        comment: z.string().max(4000).default(''),
        version: z.number().int(),
        edits: cardFields.partial().optional(),
      })
      .parse(req.body);
    const card = get<Knowledge>('knowledge', req.params.id, res);
    if (card.version !== body.version)
      throw new ServiceError(
        409,
        'This card changed while you were reviewing it. Refresh before saving.',
      );
    if (['clarify', 'reject', 'dispute'].includes(body.action) && !body.comment.trim())
      throw new ServiceError(400, 'Add a comment explaining your decision.');
    const unresolved = store
      .all<Conflict>('conflicts', card.orgId)
      .some(
        (c) => c.status === 'Open' && (c.knowledgeAId === card.id || c.knowledgeBId === card.id),
      );
    if (body.action === 'verify' && unresolved)
      throw new ServiceError(409, 'Resolve this card’s open conflicts before verifying it.');
    const status = (
      {
        verify: 'Verified',
        reject: 'Rejected',
        clarify: 'Needs Clarification',
        dispute: 'Disputed',
        archive: 'Archived',
        submit: 'Needs Verification',
      } as const
    )[body.action];
    const org = store.get<Base & { reviewIntervalDays: number }>(
      'organisations',
      card.orgId,
      card.orgId,
    )!;
    const now = new Date().toISOString();
    const item = store.transaction(() => {
      const next = setVersion(
        card,
        {
          ...body.edits,
          status,
          reviewComment: body.comment,
          ...(body.action === 'verify'
            ? {
                lastVerifiedAt: now,
                verifiedBy: current(res).name,
                reviewDueAt: new Date(Date.now() + org.reviewIntervalDays * 86400000).toISOString(),
              }
            : {}),
        },
        current(res).name,
        body.comment || `Reviewer decision: ${status}`,
      );
      store.audit(
        card.orgId,
        current(res).name,
        card.id,
        `Knowledge ${status.toLowerCase()}`,
        body.comment,
      );
      notify(
        card.orgId,
        `${card.title}: ${status}`,
        `/knowledge/${card.id}`,
        store.get<Employee>('employees', card.expertId, card.orgId)?.userId,
      );
      return next;
    });
    res.json(item);
  });
  app.post('/api/knowledge/:id/clarification', (req, res) => {
    const card = get<Knowledge>('knowledge', req.params.id, res);
    ownEmployee(get<Employee>('employees', card.expertId, res), res);
    const { comment } = z.object({ comment: text }).parse(req.body);
    if (card.status !== 'Needs Clarification')
      throw new ServiceError(409, 'This card is not waiting for clarification.');
    const item = store.transaction(() => {
      const doc = store.put<Document>('documents', {
        ...store.base(card.orgId),
        employeeId: card.expertId,
        fileName: 'Expert clarification',
        text: comment,
        status: 'Extracted',
      });
      const next = setVersion(
        card,
        {
          status: 'Needs Verification',
          evidence: [
            ...card.evidence,
            {
              sourceId: doc.id,
              sourceType: 'note',
              label: doc.fileName,
              excerpt: comment,
              supportType: 'Supporting',
            },
          ],
        },
        current(res).name,
        'Expert clarification submitted',
      );
      store.audit(card.orgId, current(res).name, card.id, 'Clarification submitted', comment);
      notify(card.orgId, 'An expert answered a clarification request.', '/verification');
      return next;
    });
    res.json(item);
  });
  app.post('/api/ask', async (req, res) => {
    const { question } = z.object({ question: z.string().trim().min(3).max(2000) }).parse(req.body);
    const all = store.all<Knowledge>('knowledge', current(res).orgId);
    const open = store
      .all<Conflict>('conflicts', current(res).orgId)
      .filter((c) => c.status === 'Open');
    const usable = all.filter(
      (c) =>
        c.status === 'Verified' &&
        !open.some((x) => x.knowledgeAId === c.id || x.knowledgeBId === c.id),
    );
    const sources = retrieve(usable, question);
    const related = retrieve(
      all.filter((c) => !['Rejected', 'Archived', 'Outdated', 'Verified'].includes(c.status)),
      question,
    );
    const warnings = related.length
      ? ['Related knowledge is unverified or disputed. It was excluded from the answer.']
      : [];
    if (sources.some((c) => c.reviewDueAt && Date.parse(c.reviewDueAt) < Date.now()))
      warnings.push('Some source knowledge is due for revalidation. Confirm it still applies.');
    if (!sources.length)
      return res.json({
        answer:
          'Continuum could not find enough verified organisational knowledge to answer this reliably.',
        sources: [],
        related,
        warnings,
        mode: 'insufficient',
      });
    limited(`ai:${current(res).id}`, 20);
    const output = await ai.generate(
      tasks.answer,
      {
        question,
        cards: sources.map((c, i) => ({
          citation: i + 1,
          id: c.id,
          title: c.title,
          summary: c.summary,
          actions: c.actions,
          warnings: c.warnings,
          exceptions: c.exceptions,
          reasoning: c.reasoning,
        })),
      },
      answerSchema,
    );
    if (output.sourceIds.some((id) => !sources.some((c) => c.id === id)))
      throw new ServiceError(502, 'The model returned an unsupported citation. Please retry.');
    res.json({
      answer: output.answer,
      sources: sources
        .map((c, i) => ({ ...c, citation: i + 1 }))
        .filter((c) => output.sourceIds.includes(c.id)),
      related,
      warnings,
      mode: 'grounded',
    });
  });
  app.get('/api/conflicts', (_req, res) =>
    res.json(store.all<Conflict>('conflicts', current(res).orgId)),
  );
  app.post('/api/conflicts/detect', async (req, res) => {
    requireRole(res, ['Admin', 'Reviewer']);
    limited(`ai:${current(res).id}`, 20);
    const body = z
      .object({ knowledgeId: z.string().optional(), documentId: z.string().optional() })
      .refine(
        (x) => Boolean(x.knowledgeId) !== Boolean(x.documentId),
        'Choose one knowledge card or document.',
      )
      .parse(req.body);
    const source = body.knowledgeId
      ? get<Knowledge>('knowledge', body.knowledgeId, res)
      : get<Document>('documents', body.documentId!, res);
    const content =
      'summary' in source ? `${source.summary}\n${source.actions.join('\n')}` : source.text;
    res.json({
      conflicts: await detect(source.orgId, current(res).name, {
        id: source.id,
        kind: body.knowledgeId ? 'knowledge' : 'document',
        text: content,
      }),
      mode: ai.configured ? 'AI + PaymentWorker rule' : 'PaymentWorker rule only',
    });
  });
  app.post('/api/conflicts/:id/resolve', (req, res) => {
    requireRole(res, ['Admin', 'Reviewer']);
    const conflict = get<Conflict>('conflicts', req.params.id, res);
    if (conflict.status === 'Resolved')
      throw new ServiceError(409, 'This conflict is already resolved.');
    const body = z
      .object({
        resolution: z.enum(['keep', 'replace', 'merge', 'clarify']),
        comment: text,
        mergedSummary: z.string().max(6000).optional(),
      })
      .parse(req.body);
    if (body.resolution === 'merge' && !body.mergedSummary?.trim())
      throw new ServiceError(400, 'Provide the merged guidance with its conditions.');
    const result = store.transaction(() => {
      const first = get<Knowledge>('knowledge', conflict.knowledgeAId, res);
      const second = conflict.knowledgeBId
        ? get<Knowledge>('knowledge', conflict.knowledgeBId, res)
        : undefined;
      const actor = current(res).name;
      const verify = (c: Knowledge, updates: Partial<Knowledge> = {}) => {
        const other = store
          .all<Conflict>('conflicts', c.orgId)
          .some(
            (x) =>
              x.id !== conflict.id &&
              x.status === 'Open' &&
              (x.knowledgeAId === c.id || x.knowledgeBId === c.id),
          );
        const org = store.get<Base & { reviewIntervalDays: number }>(
          'organisations',
          c.orgId,
          c.orgId,
        )!;
        return setVersion(
          c,
          {
            ...updates,
            status: other ? 'Conflict Detected' : 'Verified',
            lastVerifiedAt: new Date().toISOString(),
            verifiedBy: actor,
            reviewDueAt: new Date(Date.now() + org.reviewIntervalDays * 86400000).toISOString(),
          },
          actor,
          body.comment,
        );
      };
      if (body.resolution === 'clarify') {
        setVersion(
          first,
          { status: 'Needs Clarification', reviewComment: body.comment },
          actor,
          body.comment,
        );
        notify(
          first.orgId,
          `${first.title} needs clarification.`,
          `/knowledge/${first.id}`,
          store.get<Employee>('employees', first.expertId, first.orgId)?.userId,
        );
        store.audit(
          first.orgId,
          actor,
          conflict.id,
          'Conflict clarification requested',
          body.comment,
        );
        return conflict;
      }
      if (body.resolution === 'keep') {
        verify(first);
        if (second) setVersion(second, { status: 'Outdated' }, actor, body.comment);
      }
      if (body.resolution === 'replace') {
        if (second) {
          setVersion(first, { status: 'Outdated' }, actor, body.comment);
          verify(second);
        } else {
          setVersion(first, { status: 'Outdated' }, actor, body.comment);
        }
      }
      if (body.resolution === 'merge') {
        const extra =
          second?.evidence ||
          (conflict.evidenceId
            ? [get<Document>('documents', conflict.evidenceId, res)].map((d) => ({
                sourceId: d.id,
                sourceType: 'document' as const,
                label: d.fileName,
                excerpt: d.text,
                supportType: 'Supporting' as const,
              }))
            : []);
        verify(first, {
          summary: body.mergedSummary!,
          actions: [],
          warnings: [],
          reasoning: body.comment,
          evidence: [...first.evidence, ...extra],
        });
        if (second) setVersion(second, { status: 'Archived' }, actor, body.comment);
      }
      const done = store.put('conflicts', {
        ...conflict,
        status: 'Resolved' as const,
        resolution: `${body.resolution}: ${body.comment}`,
        resolvedBy: actor,
        resolvedAt: new Date().toISOString(),
      });
      store.audit(first.orgId, actor, conflict.id, 'Conflict resolved', done.resolution);
      return done;
    });
    res.json(result);
  });
  app.get('/api/reports/health', (_req, res) => {
    const orgId = current(res).orgId;
    const cards = store.all<Knowledge>('knowledge', orgId);
    const people = store.all<Employee>('employees', orgId);
    res.json({
      generatedAt: new Date().toISOString(),
      total: cards.length,
      verified: cards.filter((c) => c.status === 'Verified').length,
      unverified: cards.filter((c) =>
        ['Needs Verification', 'Draft', 'Needs Clarification'].includes(c.status),
      ),
      stale: cards.filter(
        (c) => c.status === 'Verified' && c.reviewDueAt && Date.parse(c.reviewDueAt) < Date.now(),
      ),
      risks: people.map((p) => ({
        ...p,
        risk: riskOf(p),
        knowledgeCount: cards.filter((c) => c.expertId === p.id).length,
      })),
      conflicts: store.all<Conflict>('conflicts', orgId).filter((c) => c.status === 'Open'),
    });
  });
  app.post('/api/reports/handover', async (req, res) => {
    const { employeeId } = z.object({ employeeId: z.string() }).parse(req.body);
    const employee = get<Employee>('employees', employeeId, res);
    const cards = store
      .all<Knowledge>('knowledge', employee.orgId)
      .filter((c) => c.expertId === employee.id && !['Archived', 'Rejected'].includes(c.status));
    if (!cards.length)
      throw new ServiceError(400, 'Capture knowledge for this expert before generating a report.');
    limited(`ai:${current(res).id}`, 20);
    const result = await ai.generate(
      'Create a concise handover report from these cards. Include key systems, warnings, procedures, unresolved questions and verification states. Return {summary:string,sourceIds:string[]}. Do not hide unverified status.',
      {
        employee,
        cards: cards.map((c) => ({
          id: c.id,
          title: c.title,
          summary: c.summary,
          status: c.status,
          actions: c.actions,
          warnings: c.warnings,
          clarificationQuestions: c.clarificationQuestions,
        })),
      },
      answerSchema.omit({ answer: true }).extend({ summary: z.string().max(16000) }),
    );
    if (result.sourceIds.some((id) => !cards.some((c) => c.id === id)))
      throw new ServiceError(502, 'The report referenced an unknown card. Please retry.');
    res.json({ ...result, cards: cards.filter((c) => result.sourceIds.includes(c.id)) });
  });
  app.post('/api/revalidation', (_req, res) => {
    requireRole(res, ['Admin', 'Reviewer']);
    const orgId = current(res).orgId;
    const due = store
      .all<Knowledge>('knowledge', orgId)
      .filter(
        (c) => c.status === 'Verified' && c.reviewDueAt && Date.parse(c.reviewDueAt) < Date.now(),
      );
    store.transaction(() => {
      for (const c of due) {
        setVersion(
          c,
          { status: 'Needs Verification' },
          current(res).name,
          'Scheduled review interval elapsed',
        );
        store.audit(orgId, current(res).name, c.id, 'Revalidation requested');
      }
      if (due.length)
        notify(orgId, `${due.length} knowledge cards are due for review.`, '/verification');
    });
    res.json({ count: due.length });
  });
  app.get('/api/audit', (req, res) =>
    res.json(
      store
        .all('audit', current(res).orgId)
        .filter(
          (x) =>
            !req.query.entityId ||
            (x as Base & { entityId: string }).entityId === req.query.entityId,
        ),
    ),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
  if (existsSync(resolve('dist/index.html'))) {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError)
      return res
        .status(400)
        .json({ error: error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
    if (error instanceof ServiceError)
      return res.status(error.status).json({ error: error.message });
    if (error instanceof multer.MulterError)
      return res.status(400).json({
        error: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be 10 MB or smaller.' : error.message,
      });
    console.error(error);
    res.status(500).json({ error: 'The request could not be completed. Please try again.' });
  });
  return app;
}
