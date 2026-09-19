import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
  GitBranch,
  Check,
  Plus,
  Download,
  Sparkles,
  RefreshCw,
  Settings,
  Users,
  KeyRound,
  ExternalLink,
} from 'lucide-react';
import { useApp, useAction } from '../context';
import {
  post,
  patch,
  date,
  coverage,
  riskOf,
  type Conflict,
  type Knowledge,
  type Document,
} from '../api';
import { Avatar, Badge, Empty, ErrorBox, Modal, PageHead, PanelTitle, Spinner } from '../ui';
import { EvidenceModal } from './Interview';
export function Verification() {
  const { data } = useApp();
  const [status, setStatus] = useState('Needs Verification');
  const queue = data.knowledge.filter((c) => c.status === status);
  return (
    <>
      <PageHead
        eyebrow="TRUST IS A HUMAN DECISION"
        title="Verification queue"
        description="Give captured experience the context and confidence it deserves."
        action={
          <div className="review-count">
            <ShieldCheck size={18} />
            {data.knowledge.filter((c) => c.status === 'Verified').length} cards verified
          </div>
        }
      />
      <div className="tabs toolbar">
        {['Needs Verification', 'Needs Clarification', 'Disputed', 'Verified'].map((s) => (
          <button className={s === status ? 'active' : ''} onClick={() => setStatus(s)} key={s}>
            {s}
            <span>{data.knowledge.filter((c) => c.status === s).length}</span>
          </button>
        ))}
      </div>
      <div className="verification-layout">
        <div className="stack">
          {queue.map((c) => {
            const p = data.employees.find((p) => p.id === c.expertId);
            return (
              <Link className="verification-card" to={`/knowledge/${c.id}`} key={c.id}>
                <div className="verification-icon">
                  <BookOpen size={22} />
                </div>
                <div>
                  <div className="recent-top">
                    <span className="card-type">
                      {c.area} <span>·</span> {c.type}
                    </span>
                    <Badge>{c.status}</Badge>
                  </div>
                  <h2>{c.title}</h2>
                  <p>{c.summary}</p>
                  <div className="verification-meta">
                    <Avatar name={p?.name || 'Expert'} />
                    <span>{p?.name}</span>
                    <span>·</span>
                    <span>{c.evidence.length} sources</span>
                    <span>·</span>
                    <span>{date(c.createdAt)}</span>
                    <strong>
                      Review evidence
                      <ArrowUpRight size={14} />
                    </strong>
                  </div>
                </div>
              </Link>
            );
          })}
          {!queue.length && (
            <Empty
              title="You’re all caught up"
              description="Knowledge waiting for this review stage will appear here."
            />
          )}
        </div>
        <aside>
          <section className="panel padded review-guide">
            <span className="guide-icon">
              <ShieldCheck size={28} />
            </span>
            <h2>Knowledge earns its place.</h2>
            <p>Human review turns someone’s experience into guidance the whole team can trust.</p>
            <ol>
              <li>
                <strong>Follow the source</strong>
                <span>Read the original interview and evidence.</span>
              </li>
              <li>
                <strong>Check the conditions</strong>
                <span>Look for missing context or exceptions.</span>
              </li>
              <li>
                <strong>Leave a clear decision</strong>
                <span>Verify, edit, or ask the expert for clarity.</span>
              </li>
            </ol>
            <div className="micro-copy">
              An AI confidence score is a signal, never a substitute for your judgement.
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
export function Conflicts() {
  const { data, refresh } = useApp();
  const [status, setStatus] = useState('Open');
  const [selected, setSelected] = useState<Conflict | null>(null);
  const [detect, setDetect] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id || '');
  const items = data.conflicts.filter((c) => c.status === status);
  return (
    <>
      <PageHead
        eyebrow="WHEN KNOWLEDGE DISAGREES"
        title="Bring context to conflict"
        description="Two sources. Different guidance. A human decision keeps your knowledge trustworthy."
        action={
          <>
            <button className="button" onClick={() => setEvidence(true)}>
              <Plus size={16} />
              Add evidence
            </button>
            <button className="button primary" onClick={() => setDetect(true)}>
              <GitBranch size={16} />
              Check for conflicts
            </button>
          </>
        }
      />
      <div className="tabs toolbar">
        {['Open', 'Resolved'].map((s) => (
          <button key={s} className={s === status ? 'active' : ''} onClick={() => setStatus(s)}>
            {s}
            <span>{data.conflicts.filter((c) => c.status === s).length}</span>
          </button>
        ))}
      </div>
      <div className="stack">
        {items.map((c) => {
          const first = data.knowledge.find((k) => k.id === c.knowledgeAId);
          const second = data.knowledge.find((k) => k.id === c.knowledgeBId);
          return (
            <section className="panel conflict-card" key={c.id}>
              <div className="conflict-card-head">
                <div>
                  <GitBranch size={18} />
                  <h2>{first?.area || 'Knowledge'}: conflicting guidance</h2>
                  <Badge>{c.severity}</Badge>
                </div>
                <span>{date(c.createdAt)}</span>
              </div>
              <p>{c.reason}</p>
              <div className="conflict-comparison">
                <Link to={`/knowledge/${first?.id}`}>
                  <div className="eyebrow">EXISTING KNOWLEDGE</div>
                  <h3>{first?.title}</h3>
                  <p>{first?.summary}</p>
                  <Badge>{first?.status}</Badge>
                </Link>
                <div className="conflict-divider">vs</div>
                {second ? (
                  <Link to={`/knowledge/${second.id}`}>
                    <div className="eyebrow">NEW KNOWLEDGE</div>
                    <h3>{second.title}</h3>
                    <p>{second.summary}</p>
                    <Badge>{second.status}</Badge>
                  </Link>
                ) : (
                  <div>
                    <div className="eyebrow">NEW EVIDENCE</div>
                    <h3>Uploaded document</h3>
                    <p>Review the original evidence before choosing which guidance applies.</p>
                    <a
                      className="text-link"
                      href={`/api/documents/${c.evidenceId}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read evidence
                      <ExternalLink size={13} />
                    </a>
                  </div>
                )}
              </div>
              <div className="conflict-card-foot">
                <span>
                  <ShieldCheck size={14} />
                  {c.status === 'Resolved'
                    ? `${c.resolution} · ${c.resolvedBy}`
                    : 'No automatic truth resolution. Your judgement matters.'}
                </span>
                {c.status === 'Open' && (
                  <button className="button primary" onClick={() => setSelected(c)}>
                    Resolve conflict
                    <ArrowUpRight size={14} />
                  </button>
                )}
              </div>
            </section>
          );
        })}
        {!items.length && (
          <Empty
            title={status === 'Open' ? 'No unresolved conflicts' : 'No resolved conflicts yet'}
            description="Compare new knowledge with existing guidance to identify contradictions."
          />
        )}
      </div>
      {selected && <ResolveConflict conflict={selected} onClose={() => setSelected(null)} />}
      {detect && <DetectModal onClose={() => setDetect(false)} />}
      {evidence && (
        <Modal title="Choose an evidence contributor" onClose={() => setEvidence(false)}>
          <div className="form-stack">
            <label>
              Expert source
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                {data.employees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <EvidencePicker employeeId={employeeId} />
          </div>
        </Modal>
      )}
    </>
  );
}
function EvidencePicker({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  const { refresh } = useApp();
  return (
    <>
      <button className="button primary" disabled={!employeeId} onClick={() => setOpen(true)}>
        Continue to upload
      </button>
      {open && (
        <EvidenceModal employeeId={employeeId} onClose={() => setOpen(false)} onSaved={refresh} />
      )}
    </>
  );
}
function ResolveConflict({ conflict, onClose }: { conflict: Conflict; onClose: () => void }) {
  const [resolution, setResolution] = useState('keep');
  const { busy, error, run } = useAction();
  return (
    <Modal title="Resolve conflicting knowledge" onClose={onClose} wide>
      <p className="muted">{conflict.reason}</p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(
            async () => {
              await post(`/conflicts/${conflict.id}/resolve`, {
                resolution,
                comment: f.get('comment'),
                mergedSummary: f.get('mergedSummary') || undefined,
              });
              onClose();
            },
            resolution === 'clarify'
              ? 'Clarification requested; conflict remains open.'
              : 'Conflict resolution recorded.',
          );
        }}
      >
        {error && <ErrorBox message={error} />}
        <label>
          Decision
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
            <option value="keep">Keep existing; mark new card outdated</option>
            <option value="replace">Use new guidance; mark existing outdated</option>
            <option value="merge">Merge with explicit conditions</option>
            <option value="clarify">Request clarification; keep conflict open</option>
          </select>
        </label>
        {resolution === 'replace' && !conflict.knowledgeBId && (
          <div className="warning-note">
            This marks the old card outdated. The new document remains evidence; contribute a new
            card before using it as guidance.
          </div>
        )}
        {resolution === 'merge' && (
          <label>
            Complete merged guidance and conditions
            <textarea
              name="mergedSummary"
              rows={6}
              required
              placeholder="State when each procedure applies, including all operational steps and warnings."
            />
            <span className="field-hint">
              This replaces the summary and clears the conflicting action/warning lists. Include all
              applicable instructions here.
            </span>
          </label>
        )}
        <label>
          Explain the evidence behind your decision
          <textarea name="comment" rows={4} required />
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Spinner /> : 'Record decision'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function DetectModal({ onClose }: { onClose: () => void }) {
  const { data } = useApp();
  const { busy, error, run } = useAction();
  const [result, setResult] = useState('');
  return (
    <Modal title="Check knowledge for contradictions" onClose={onClose}>
      <p className="muted">
        Compare a knowledge card with other relevant sources in this workspace.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const result = await post<{ conflicts: Conflict[]; mode: string }>(
              '/conflicts/detect',
              { knowledgeId: f.get('knowledgeId') },
            );
            setResult(
              `${result.conflicts.length} new conflicts found. Analysis mode: ${result.mode}.`,
            );
          });
        }}
      >
        {error && <ErrorBox message={error} />}
        <label>
          Knowledge to check
          <select name="knowledgeId">
            {data.knowledge
              .filter((c) => !['Archived', 'Rejected', 'Outdated'].includes(c.status))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
          </select>
        </label>
        {!data.ai.configured && (
          <div className="info-box">
            Without an API key, only the explicit PaymentWorker manual/automatic restart rule is
            available. General contradiction analysis needs the AI provider.
          </div>
        )}
        {result && <div className="success-note">{result}</div>}
        <button className="button primary full" disabled={busy || !data.knowledge.length}>
          {busy ? <Spinner label="Comparing evidence…" /> : 'Check for conflicts'}
        </button>
      </form>
    </Modal>
  );
}
export function Reports() {
  const { data } = useApp();
  const { busy, error, run } = useAction();
  const [employeeId, setEmployeeId] = useState(data.employees[0]?.id || '');
  const [report, setReport] = useState<{ summary: string; cards: Knowledge[] } | null>(null);
  const cards = data.knowledge;
  const areas = [...new Set(cards.map((c) => c.area))];
  const risks = [...data.employees].sort(
    (a, b) => Number(riskOf(b) === 'High') - Number(riskOf(a) === 'High'),
  );
  const stale = cards.filter(
    (c) => c.reviewDueAt && Date.parse(c.reviewDueAt) < Date.now() && c.status === 'Verified',
  );
  function download() {
    const lines = [
      'Continuum knowledge health report',
      `Generated: ${new Date().toISOString()}`,
      `Workspace: ${data.organisation.name}`,
      `Knowledge cards: ${cards.length}`,
      `Verified: ${cards.filter((c) => c.status === 'Verified').length}`,
      `Coverage: ${coverage(cards)}%`,
      `Open conflicts: ${data.conflicts.filter((c) => c.status === 'Open').length}`,
      '',
      'Expert dependencies',
      ...risks.map(
        (p) =>
          `${p.name} | ${p.knowledgeAreas.join(', ')} | ${riskOf(p)} risk | ${p.backupExperts} backups`,
      ),
      '',
      'Knowledge inventory',
      ...cards.map(
        (c) =>
          `${c.title} | ${c.status} | v${c.version} | ${window.location.origin}/knowledge/${c.id}`,
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'continuum-knowledge-health.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHead
        eyebrow="SEE THE GAPS. PRESERVE WHAT MATTERS."
        title="Knowledge health reports"
        description="A clear view of coverage, dependencies, and the work ahead."
        action={
          <button className="button" onClick={download}>
            <Download size={16} />
            Export report
          </button>
        }
      />
      <div className="profile-metrics report-metrics">
        <div>
          <span>Knowledge preserved</span>
          <strong>{cards.length}</strong>
        </div>
        <div>
          <span>Verified coverage</span>
          <strong>{coverage(cards)}%</strong>
        </div>
        <div>
          <span>High-risk dependencies</span>
          <strong>{risks.filter((p) => riskOf(p) === 'High').length}</strong>
        </div>
        <div>
          <span>Due for revalidation</span>
          <strong>{stale.length}</strong>
        </div>
      </div>
      <div className="two-column">
        <section className="panel padded">
          <PanelTitle
            title="Coverage by knowledge area"
            description="Verified cards as a share of captured knowledge."
          />
          {areas.map((area) => {
            const subset = cards.filter((c) => c.area === area);
            return (
              <div className="area-coverage" key={area}>
                <div>
                  <Link to={`/knowledge?q=${encodeURIComponent(area)}`}>{area}</Link>
                  <span>
                    {subset.filter((c) => c.status === 'Verified').length} / {subset.length}{' '}
                    verified
                  </span>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${coverage(subset)}%` }} />
                </div>
              </div>
            );
          })}
          {!areas.length && <Empty title="No knowledge captured yet" />}
        </section>
        <div className="stack">
          <section className="panel padded">
            <PanelTitle title="Single-expert dependencies" />
            {risks
              .filter((p) => p.backupExperts <= 1)
              .map((p) => (
                <Link className="list-item" to={`/people/${p.id}`} key={p.id}>
                  <Avatar name={p.name} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.knowledgeAreas.join(', ')}</small>
                  </span>
                  <Badge>{riskOf(p)}</Badge>
                </Link>
              ))}
          </section>
          <section className="panel padded">
            <PanelTitle title="Keep knowledge current" />
            <p className="muted">
              Your review interval is {data.organisation.reviewIntervalDays} days. {stale.length}{' '}
              verified cards are due for a fresh look.
            </p>
            {data.user.role !== 'Employee' && (
              <button
                className="button"
                disabled={busy}
                onClick={() =>
                  run(() => post('/revalidation'), 'Due cards moved into the verification queue.')
                }
              >
                <RefreshCw size={15} />
                Run revalidation check
              </button>
            )}
          </section>
        </div>
      </div>
      <section className="panel padded handover-report">
        <PanelTitle
          title="Expert handover report"
          description="A source-linked AI summary of systems, warnings, procedures, and unresolved questions."
          action={<Sparkles size={20} />}
        />
        {error && <ErrorBox message={error} />}
        <div className="inline-form">
          <select
            aria-label="Expert for handover report"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            {data.employees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className="button primary"
            disabled={busy || !employeeId}
            onClick={() =>
              run(async () => {
                setReport(await post('/reports/handover', { employeeId }));
              })
            }
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                <Sparkles size={16} />
                Generate report
              </>
            )}
          </button>
        </div>
        {report && (
          <div className="generated-report">
            <p>{report.summary}</p>
            <h3>Underlying knowledge</h3>
            {report.cards.map((c) => (
              <Link className="list-item" to={`/knowledge/${c.id}`} key={c.id}>
                <span>{c.title}</span>
                <Badge>{c.status}</Badge>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
export function SettingsPage() {
  const { data } = useApp();
  const { busy, error, run } = useAction();
  const [member, setMember] = useState(false);
  return (
    <>
      <PageHead
        eyebrow="YOUR WORKSPACE, WITH INTENTION"
        title="Workspace settings"
        description="Manage your organisation, team access, and knowledge review cadence."
      />
      {error && <ErrorBox message={error} />}
      <div className="settings-layout">
        <section className="panel padded">
          <PanelTitle title="Organisation" action={<Settings size={18} />} />
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(
                () =>
                  patch('/settings', {
                    name: f.get('name'),
                    reviewIntervalDays: Number(f.get('days')),
                  }),
                'Workspace settings saved.',
              );
            }}
          >
            <label>
              Organisation name
              <input
                name="name"
                defaultValue={data.organisation.name}
                disabled={data.user.role !== 'Admin'}
                required
              />
            </label>
            <label>
              Knowledge review interval (days)
              <input
                name="days"
                type="number"
                min={7}
                max={730}
                defaultValue={data.organisation.reviewIntervalDays}
                disabled={data.user.role !== 'Admin'}
              />
              <span className="field-hint">
                New verifications use this interval. Existing due dates are preserved.
              </span>
            </label>
            {data.user.role === 'Admin' && (
              <button className="button primary" disabled={busy}>
                Save settings
              </button>
            )}
          </form>
        </section>
        <section className="panel padded">
          <PanelTitle title="AI connection" action={<Sparkles size={18} />} />
          <div className="connection-state">
            <span className={`status-dot ${data.ai.configured ? '' : 'offline'}`} />
            <strong>{data.ai.provider}</strong>
            <Badge tone={data.ai.configured ? 'green' : 'amber'}>
              {data.ai.configured ? 'Configured' : 'Setup required'}
            </Badge>
          </div>
          <p className="muted">
            AI credentials stay on the server. Set these environment variables in the project’s{' '}
            <code>.env</code> file and restart the server:
          </p>
          <pre className="config-code">
            AI_PROVIDER=compatible{'\n'}AI_BASE_URL=https://your-provider/v1{'\n'}
            AI_API_KEY=your-server-side-key{'\n'}AI_MODEL=your-model-id
          </pre>
          <p className="micro-copy">
            Use a provider with Chat Completions and JSON response support. “Configured” indicates
            settings are present; the first request checks the connection.
          </p>
        </section>
        <section className="panel padded">
          <PanelTitle title="Team access" action={<Users size={18} />} />
          <p className="muted">
            Admins manage the workspace. Reviewers verify knowledge. Employees contribute their own
            expertise.
          </p>
          <div className="list-item">
            <Avatar name={data.user.name} />
            <span>
              <strong>{data.user.name}</strong>
              <small>{data.user.email}</small>
            </span>
            <Badge tone="gray">{data.user.role}</Badge>
          </div>
          {data.user.role === 'Admin' && (
            <button className="button" onClick={() => setMember(true)}>
              <Plus size={16} />
              Create team member
            </button>
          )}
          <p className="micro-copy">
            Member accounts use an initial password supplied by an administrator. Members can change
            it below.
          </p>
        </section>
        <section className="panel padded">
          <PanelTitle title="Your password" action={<KeyRound size={18} />} />
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              void run(async () => {
                await post('/auth/password', {
                  currentPassword: f.get('currentPassword'),
                  newPassword: f.get('newPassword'),
                });
                form.reset();
              }, 'Password changed. Other sessions have been signed out.');
            }}
          >
            <label>
              Current password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
                placeholder="At least 12 characters"
              />
            </label>
            <button className="button" disabled={busy}>
              Update password
            </button>
          </form>
        </section>
      </div>
      <section className="panel padded audit-panel">
        <PanelTitle
          title="Recent audit activity"
          description="A durable record of the decisions behind your knowledge."
        />
        {data.audit.slice(0, 12).map((a) => (
          <div className="audit-row" key={a.id}>
            <span className="timeline-dot" />
            <span>
              <strong>{a.action}</strong>
              <small>{a.detail}</small>
            </span>
            <span>{a.actor}</span>
            <small>{date(a.createdAt)}</small>
          </div>
        ))}
      </section>
      {member && <MemberModal onClose={() => setMember(false)} />}
    </>
  );
}
function MemberModal({ onClose }: { onClose: () => void }) {
  const { data } = useApp();
  const { busy, error, run } = useAction();
  return (
    <Modal title="Create a team member" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            await post('/members', {
              name: f.get('name'),
              email: f.get('email'),
              password: f.get('password'),
              role: f.get('role'),
              employeeId: f.get('employeeId') || undefined,
            });
            onClose();
          }, 'Team member created. Share their initial password securely.');
        }}
      >
        {error && <ErrorBox message={error} />}
        <label>
          Name
          <input name="name" required minLength={2} />
        </label>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Role
          <select name="role">
            <option>Employee</option>
            <option>Reviewer</option>
          </select>
        </label>
        <label>
          Link an expert profile
          <select name="employeeId">
            <option value="">Create a new profile</option>
            {data.employees
              .filter((p) => !p.userId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Initial password
          <input
            name="password"
            type="password"
            minLength={12}
            required
            autoComplete="new-password"
          />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? <Spinner /> : 'Create account'}
        </button>
      </form>
    </Modal>
  );
}
