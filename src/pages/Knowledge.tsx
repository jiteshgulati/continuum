import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Search,
  Plus,
  LayoutGrid,
  List,
  ShieldCheck,
  FileText,
  MessageSquare,
  Clock3,
  History,
  Check,
  GitBranch,
  ExternalLink,
} from 'lucide-react';
import { useApp, useAction } from '../context';
import { api, post, date, type Knowledge, type Evidence, type Document } from '../api';
import { Avatar, Badge, Empty, ErrorBox, Modal, PageHead, PanelTitle, Spinner } from '../ui';
export function KnowledgeLibrary() {
  const { data } = useApp();
  const [params, setParams] = useSearchParams();
  const [area, setArea] = useState('All areas');
  const [type, setType] = useState('All types');
  const [expert, setExpert] = useState('All experts');
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('grid');
  const [add, setAdd] = useState(false);
  const q = params.get('q') || '';
  const status = params.get('status') || 'All statuses';
  const filtered = data.knowledge
    .filter(
      (c) =>
        `${c.title} ${c.summary} ${c.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase()) &&
        (status === 'All statuses' || c.status === status) &&
        (area === 'All areas' || c.area === area) &&
        (type === 'All types' || c.type === type) &&
        (expert === 'All experts' || c.expertId === expert),
    )
    .sort((a, b) =>
      sort === 'verified'
        ? Date.parse(b.lastVerifiedAt || '1970') - Date.parse(a.lastVerifiedAt || '1970')
        : Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  function setParam(key: string, value: string) {
    setParams((p) => {
      p.set(key, value);
      return p;
    });
  }
  return (
    <>
      <PageHead
        eyebrow="EXPERIENCE, MADE REUSABLE"
        title="Knowledge library"
        description="Your team’s operational memory. Every card has a story and a source."
        action={
          <button className="button primary" onClick={() => setAdd(true)}>
            <Plus size={16} />
            Add knowledge
          </button>
        }
      />
      <div className="library-search">
        <Search size={19} />
        <input
          aria-label="Search library"
          value={q}
          placeholder="Find an incident, a workaround, or the reason why…"
          onChange={(e) => setParam('q', e.target.value)}
        />
        <span>{data.knowledge.length} knowledge cards</span>
      </div>
      <div className="filter-bar">
        <select
          aria-label="Status filter"
          value={status}
          onChange={(e) => setParam('status', e.target.value)}
        >
          {[
            'All statuses',
            'Verified',
            'Needs Verification',
            'Needs Clarification',
            'Conflict Detected',
            'Disputed',
            'Outdated',
            'Archived',
            'Rejected',
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Knowledge area filter"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        >
          {['All areas', ...new Set(data.knowledge.map((c) => c.area))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select aria-label="Type filter" value={type} onChange={(e) => setType(e.target.value)}>
          {['All types', ...new Set(data.knowledge.map((c) => c.type))].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Contributor filter"
          value={expert}
          onChange={(e) => setExpert(e.target.value)}
        >
          <option>All experts</option>
          {data.employees.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="filter-spacer" />
        <select aria-label="Sort knowledge" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="verified">Last verified</option>
        </select>
        <div className="view-toggle">
          <button
            aria-label="Grid view"
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            aria-label="List view"
            className={view === 'list' ? 'active' : ''}
            onClick={() => setView('list')}
          >
            <List size={16} />
          </button>
        </div>
      </div>
      <div className="results-count">
        {filtered.length} {filtered.length === 1 ? 'card' : 'cards'}
        <span> · Traceable by design</span>
      </div>
      <div className={view === 'grid' ? 'library-grid' : 'library-list'}>
        {filtered.map((c) => {
          const person = data.employees.find((p) => p.id === c.expertId);
          return (
            <Link className="recent-card" key={c.id} to={`/knowledge/${c.id}`}>
              <div className="recent-top">
                <span className="card-type">
                  <BookOpen size={15} />
                  {c.type}
                </span>
                <Badge>{c.status}</Badge>
              </div>
              <h3>{c.title}</h3>
              <p>{c.summary}</p>
              <div className="recent-tags">
                <span className="tag">{c.area}</span>
                <span className="source-count">
                  <FileText size={12} />
                  {c.evidence.length} {c.evidence.length === 1 ? 'source' : 'sources'}
                </span>
              </div>
              <div className="recent-foot">
                <Avatar name={person?.name || 'Expert'} />
                <span>{person?.name || 'Expert'}</span>
                <small>
                  v{c.version}
                  <ArrowUpRight size={14} />
                </small>
              </div>
            </Link>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title="No knowledge matches yet"
          description="Try different filters, add a source note, or begin a handover."
        />
      )}
      {add && <AddKnowledge onClose={() => setAdd(false)} />}
    </>
  );
}
function AddKnowledge({ onClose }: { onClose: () => void }) {
  const { data, toast } = useApp();
  const { busy, error, run } = useAction();
  const people = data.employees.filter(
    (p) => data.user.role !== 'Employee' || p.userId === data.user.id,
  );
  return (
    <Modal title="Contribute knowledge" onClose={onClose} wide>
      <p className="muted">
        Write what you know and preserve the source. A reviewer will verify it before it becomes
        guidance.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const result = await post<Knowledge & { warning?: string }>('/knowledge', {
              title: f.get('title'),
              summary: f.get('summary'),
              area: f.get('area'),
              type: f.get('type'),
              expertId: f.get('expertId'),
              sourceNote: f.get('sourceNote'),
              actions: String(f.get('actions')).split('\n').filter(Boolean),
              warnings: String(f.get('warnings')).split('\n').filter(Boolean),
            });
            toast(
              result.warning ||
                (result.status === 'Conflict Detected'
                  ? 'Knowledge saved. A contradiction was flagged for human review.'
                  : 'Knowledge submitted for verification.'),
            );
            onClose();
          });
        }}
      >
        {error && <ErrorBox message={error} />}
        <label>
          Title
          <input
            name="title"
            required
            minLength={3}
            placeholder="What should the next person know?"
          />
        </label>
        <div className="form-grid">
          <label>
            Expert source
            <select name="expertId">
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Knowledge area
            <input name="area" required placeholder="Payments" />
          </label>
        </div>
        <label>
          Knowledge type
          <select name="type">
            {['Incident', 'Procedure', 'Warning', 'Decision', 'Dependency', 'Customer context'].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Summary
          <textarea name="summary" required rows={3} />
        </label>
        <div className="form-grid">
          <label>
            Recommended actions<span className="field-hint">One action per line</span>
            <textarea name="actions" rows={3} />
          </label>
          <label>
            Warnings<span className="field-hint">One warning per line</span>
            <textarea name="warnings" rows={3} />
          </label>
        </div>
        <label>
          Original source note
          <textarea
            name="sourceNote"
            required
            rows={4}
            placeholder="Preserve the original experience, incident details, or context that supports this card."
          />
        </label>
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !people.length}>
            {busy ? <Spinner /> : 'Submit for verification'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function SourceModal({ source, onClose }: { source: Evidence; onClose: () => void }) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (source.sourceType !== 'interview')
      api<Document>(`/documents/${source.sourceId}`)
        .then(setDoc)
        .catch((e) => setError(e.message));
  }, [source.sourceId, source.sourceType]);
  return (
    <Modal title={source.label} onClose={onClose} wide>
      {error && <ErrorBox message={error} />}
      <div className="source-meta">
        <Badge tone={source.supportType === 'Supporting' ? 'green' : 'red'}>
          {source.supportType}
        </Badge>
        <span>{source.sourceType}</span>
        {doc && (
          <a
            className="text-link"
            href={`/api/documents/${doc.id}/download`}
            target="_blank"
            rel="noreferrer"
          >
            Open original
            <ExternalLink size={14} />
          </a>
        )}
      </div>
      <pre className="source-text">{doc?.text || source.excerpt}</pre>
      {doc?.analysis && (
        <div className="info-box">
          <strong>AI analysis</strong>
          <p>{doc.analysis}</p>
        </div>
      )}
    </Modal>
  );
}
export function KnowledgeDetail() {
  const { id } = useParams();
  const { data } = useApp();
  const card = data.knowledge.find((c) => c.id === id);
  const [source, setSource] = useState<Evidence | null>(null);
  const [tab, setTab] = useState('Knowledge');
  const [edit, setEdit] = useState(false);
  const [comment, setComment] = useState('');
  const { busy, error, run } = useAction();
  if (!card) return <Empty title="Knowledge card not found" />;
  const expert = data.employees.find((p) => p.id === card.expertId);
  const reviewer = data.user.role !== 'Employee';
  const audit = data.audit.filter((a) => a.entityId === id);
  const needsClarification =
    card.status === 'Needs Clarification' && (reviewer || expert?.userId === data.user.id);
  function review(action: string) {
    void run(
      () => post(`/knowledge/${id}/review`, { action, comment, version: card!.version }),
      `Review decision saved.`,
    );
  }
  return (
    <>
      <Link className="back-link" to="/knowledge">
        <ArrowLeft size={15} />
        Knowledge library
      </Link>
      <div className="knowledge-detail-heading">
        <div className="recent-tags">
          <span className="tag">{card.area}</span>
          <span className="tag">{card.type}</span>
          <Badge>{card.status}</Badge>
        </div>
        <h1>{card.title}</h1>
        <div className="knowledge-byline">
          <Avatar name={expert?.name || 'Expert'} />
          <Link to={`/people/${expert?.id}`}>{expert?.name || 'Expert'}</Link>
          <span>Captured {date(card.createdAt)}</span>
          <span>Version {card.version}</span>
        </div>
      </div>
      {['Disputed', 'Conflict Detected', 'Outdated', 'Rejected', 'Archived'].includes(
        card.status,
      ) && (
        <div className="warning-note">
          This card is {card.status.toLowerCase()} and is excluded from current guidance.{' '}
          {card.status === 'Conflict Detected' && reviewer && (
            <Link to="/conflicts">Review the conflicting sources →</Link>
          )}
        </div>
      )}
      <div className="two-column detail-columns">
        <div>
          <div className="tabs detail-tabs">
            {['Knowledge', 'Evidence', 'Version history'].map((t) => (
              <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t}
                {t === 'Evidence' && <span>{card.evidence.length}</span>}
              </button>
            ))}
          </div>
          <section className="panel padded knowledge-body">
            {tab === 'Knowledge' ? (
              <>
                <h2>What you need to know</h2>
                <p className="lead-text">{card.summary}</p>
                {card.symptoms.length > 0 && (
                  <section>
                    <h3>Symptoms & signals</h3>
                    <ul>
                      {card.symptoms.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {card.actions.length > 0 && (
                  <section>
                    <h3>Recommended actions</h3>
                    <ol className="action-steps">
                      {card.actions.map((x, i) => (
                        <li key={i}>
                          <span>{i + 1}</span>
                          {x}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                {card.warnings.length > 0 && (
                  <section className="warning-block">
                    <h3>Things to watch out for</h3>
                    {card.warnings.map((x, i) => (
                      <p key={i}>{x}</p>
                    ))}
                  </section>
                )}
                {card.reasoning && (
                  <section>
                    <h3>Why this matters</h3>
                    <p>{card.reasoning}</p>
                  </section>
                )}
                {card.dependencies.length > 0 && (
                  <section>
                    <h3>Dependencies</h3>
                    <div className="tags">
                      {card.dependencies.map((x, i) => (
                        <span className="tag" key={i}>
                          {x}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
                {card.exceptions.length > 0 && (
                  <section>
                    <h3>Exceptions & conditions</h3>
                    {card.exceptions.map((x, i) => (
                      <p key={i}>{x}</p>
                    ))}
                  </section>
                )}
                {card.clarificationQuestions.length > 0 && (
                  <section>
                    <h3>Open questions</h3>
                    <ul>
                      {card.clarificationQuestions.map((x, i) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : tab === 'Evidence' ? (
              <>
                <h2>Follow the evidence</h2>
                <p className="muted">
                  Original sources are preserved independently of reviewer edits.
                </p>
                {card.evidence.map((e, i) => (
                  <button className="evidence-block" key={i} onClick={() => setSource(e)}>
                    <div>
                      <FileText size={17} />
                      <strong>{e.label}</strong>
                      <ArrowUpRight size={15} />
                    </div>
                    <p>
                      {e.excerpt.slice(0, 300)}
                      {e.excerpt.length > 300 ? '…' : ''}
                    </p>
                    <Badge>{e.supportType}</Badge>
                  </button>
                ))}
              </>
            ) : (
              <>
                <h2>A record of every decision</h2>
                <div className="timeline">
                  {[...card.versions].reverse().map((v) => (
                    <div className="timeline-item" key={v.version}>
                      <span className="timeline-dot" />
                      <strong>
                        Version {v.version}
                        <small>{date(v.createdAt)}</small>
                      </strong>
                      <p>{v.reason}</p>
                      <span>{v.actor}</span>
                      <details>
                        <summary>View saved content</summary>
                        <pre className="source-text">{JSON.stringify(v.content, null, 2)}</pre>
                      </details>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
        <aside className="stack">
          <section className="panel padded">
            <PanelTitle title="Trust & provenance" action={<ShieldCheck size={18} />} />
            <dl className="detail-list">
              <div>
                <dt>Verification</dt>
                <dd>
                  <Badge>{card.status}</Badge>
                </dd>
              </div>
              <div>
                <dt>Verified by</dt>
                <dd>{card.verifiedBy || 'Awaiting review'}</dd>
              </div>
              <div>
                <dt>Last verified</dt>
                <dd>{date(card.lastVerifiedAt)}</dd>
              </div>
              <div>
                <dt>Review due</dt>
                <dd>{card.reviewDueAt ? date(card.reviewDueAt) : 'After verification'}</dd>
              </div>
              <div>
                <dt>Source evidence</dt>
                <dd>{card.evidence.length} sources</dd>
              </div>
              <div>
                <dt>AI confidence signal</dt>
                <dd>
                  {card.confidence ? `${Math.round(card.confidence * 100)}%` : 'Human contribution'}
                </dd>
              </div>
            </dl>
            <p className="micro-copy">
              Confidence is a model estimate. Human verification determines trust.
            </p>
          </section>
          {card.reviewComment && (
            <section className="panel padded">
              <h3>Reviewer’s note</h3>
              <p className="muted">{card.reviewComment}</p>
            </section>
          )}
          {needsClarification && (
            <section className="panel padded">
              <h3>Respond to clarification</h3>
              <textarea
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add the missing context…"
                aria-label="Clarification response"
              />
              <button
                className="button primary full"
                disabled={busy || !comment.trim()}
                onClick={() =>
                  run(
                    () => post(`/knowledge/${id}/clarification`, { comment }),
                    'Clarification sent for review.',
                  )
                }
              >
                Submit clarification
              </button>
            </section>
          )}
          {reviewer && (
            <section className="panel padded review-panel">
              <h3>Human review</h3>
              <p className="muted">Read the evidence before making a decision.</p>
              {error && <ErrorBox message={error} />}
              <label>
                Reviewer comment
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Explain your decision or ask a question…"
                />
              </label>
              <button
                className="button primary full"
                disabled={busy}
                onClick={() => review('verify')}
              >
                <Check size={16} />
                Verify knowledge
              </button>
              <button className="button full" disabled={busy} onClick={() => setEdit(true)}>
                Edit & verify
              </button>
              <div className="review-actions">
                <button className="button" disabled={busy} onClick={() => review('clarify')}>
                  Ask for clarity
                </button>
                <button className="button danger" disabled={busy} onClick={() => review('reject')}>
                  Reject
                </button>
                <button className="text-button" disabled={busy} onClick={() => review('dispute')}>
                  Mark disputed
                </button>
                <button className="text-button" disabled={busy} onClick={() => review('archive')}>
                  Archive
                </button>
              </div>
            </section>
          )}
          {!reviewer && error && <ErrorBox message={error} />}
        </aside>
      </div>
      {source && <SourceModal source={source} onClose={() => setSource(null)} />}
      {edit && <EditVerify card={card} onClose={() => setEdit(false)} />}
    </>
  );
}
function EditVerify({ card, onClose }: { card: Knowledge; onClose: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <Modal title="Edit & verify knowledge" onClose={onClose} wide>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            await post(`/knowledge/${card.id}/review`, {
              action: 'verify',
              version: card.version,
              comment: f.get('comment'),
              edits: {
                title: f.get('title'),
                summary: f.get('summary'),
                actions: String(f.get('actions')).split('\n').filter(Boolean),
                warnings: String(f.get('warnings')).split('\n').filter(Boolean),
                reasoning: f.get('reasoning'),
                exceptions: String(f.get('exceptions')).split('\n').filter(Boolean),
              },
            });
            onClose();
          }, 'New version verified.');
        }}
      >
        {error && <ErrorBox message={error} />}
        <label>
          Title
          <input name="title" defaultValue={card.title} required />
        </label>
        <label>
          Summary
          <textarea name="summary" rows={3} defaultValue={card.summary} required />
        </label>
        <div className="form-grid">
          <label>
            Actions (one per line)
            <textarea name="actions" rows={4} defaultValue={card.actions.join('\n')} />
          </label>
          <label>
            Warnings (one per line)
            <textarea name="warnings" rows={4} defaultValue={card.warnings.join('\n')} />
          </label>
        </div>
        <label>
          Reasoning
          <textarea name="reasoning" defaultValue={card.reasoning} />
        </label>
        <label>
          Exceptions (one per line)
          <textarea name="exceptions" defaultValue={card.exceptions.join('\n')} />
        </label>
        <label>
          Reason for this change
          <textarea
            name="comment"
            required
            placeholder="Explain what you confirmed and corrected."
          />
        </label>
        <p className="micro-copy">
          The original version and all source evidence will remain in history.
        </p>
        <div className="modal-actions">
          <button className="button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Spinner /> : 'Save & verify new version'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
