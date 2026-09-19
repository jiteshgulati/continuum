import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Send,
  Sparkles,
  Pause,
  Play,
  FileText,
  Plus,
  Upload,
  Check,
  Download,
  ShieldCheck,
} from 'lucide-react';
import { useApp, useAction } from '../context';
import { api, post, patch, date, type Interview, type Document, type Knowledge } from '../api';
import { Avatar, Badge, Empty, ErrorBox, Modal, PanelTitle, Spinner, Logo } from '../ui';
type Session = Interview & { documents: Document[] };
export function InterviewPage() {
  const { id } = useParams();
  const { data, refresh, toast } = useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState('');
  const [answer, setAnswer] = useState('');
  const [evidence, setEvidence] = useState(false);
  const { busy, error, run } = useAction();
  const bottom = useRef<HTMLDivElement>(null);
  const employee = data.employees.find((p) => p.id === session?.employeeId);
  async function load() {
    try {
      const loaded = await api<Session>(`/interviews/${id}`);
      setSession(loaded);
      setLoadError('');
      return loaded;
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [session?.messages.length]);
  async function send(content?: string) {
    await run(async () => {
      try {
        await post(`/interviews/${id}/messages`, { content });
      } finally {
        const saved = await load();
        if (content && saved?.messages.some((m) => m.sender === 'expert' && m.content === content))
          setAnswer('');
      }
    });
  }
  async function status(value: string) {
    await run(async () => {
      await patch(`/interviews/${id}`, { status: value });
      await load();
    });
  }
  async function extract() {
    await run(async () => {
      const result = await post<{ cards: Knowledge[]; warning?: string }>(
        `/interviews/${id}/extract`,
      );
      await load();
      toast(result.warning || `${result.cards.length} knowledge drafts sent for verification.`);
    });
  }
  if (loadError) return <ErrorBox message={loadError} />;
  if (!session) return <Spinner label="Loading handover…" />;
  return (
    <>
      <Link to={`/people/${session.employeeId}`} className="back-link">
        <ArrowLeft size={15} />
        {employee?.name}’s profile
      </Link>
      <div className="interview-heading">
        <div>
          <div className="eyebrow">CAPTURE WHAT EXPERIENCE TEACHES</div>
          <h1>{session.area} handover</h1>
          <p>{session.objective}</p>
        </div>
        <Badge>{session.status}</Badge>
        <div className="head-actions">
          {session.status !== 'Completed' && (
            <>
              <button
                className="button"
                disabled={busy}
                onClick={() => status(session.status === 'Paused' ? 'Active' : 'Paused')}
              >
                {session.status === 'Paused' ? <Play size={15} /> : <Pause size={15} />}
                {session.status === 'Paused' ? 'Resume' : 'Pause'}
              </button>
              <button className="button" disabled={busy} onClick={() => status('Completed')}>
                End interview
              </button>
            </>
          )}
          <button
            className="button primary"
            disabled={
              busy ||
              !session.messages.some((m) => m.sender === 'expert') ||
              session.extractedCardIds.length > 0
            }
            onClick={extract}
          >
            <Sparkles size={16} />
            {session.extractedCardIds.length ? 'Drafts generated' : 'Generate knowledge drafts'}
          </button>
        </div>
      </div>
      {!data.ai.configured && (
        <div className="info-box">
          <Sparkles size={17} />
          <span>
            The AI provider needs configuration. Your answers and evidence can still be saved. Set
            the API key and model in the server environment to enable interviews and extraction.{' '}
            <Link to="/settings">View setup</Link>
          </span>
        </div>
      )}
      {error && <ErrorBox message={error} />}
      <div className="interview-layout">
        <section className="panel conversation-panel">
          <div className="conversation-header">
            <span>
              <span className="status-dot" />
              Knowledge interview
            </span>
            <span className="micro-copy">
              {data.ai.provider} · {data.ai.configured ? 'Connected' : 'Not configured'}
            </span>
          </div>
          <div className="conversation-messages">
            {!session.messages.length && (
              <div className="interview-welcome">
                <Logo small />
                <h2>Let’s start with what only you know.</h2>
                <p>
                  Think about a real incident, an unexpected workaround, or a decision a new
                  teammate would need to understand.
                </p>
                <button
                  className="button"
                  disabled={busy || session.status !== 'Active'}
                  onClick={() => send()}
                >
                  <Sparkles size={16} />
                  Generate opening question
                </button>
              </div>
            )}
            {session.messages.map((m) => (
              <div className={`message ${m.sender}`} key={m.id}>
                {m.sender === 'assistant' ? (
                  <Logo small />
                ) : (
                  <Avatar name={employee?.name || 'Expert'} />
                )}
                <div>
                  <div className="message-byline">
                    <strong>{m.sender === 'assistant' ? 'Continuum' : employee?.name}</strong>
                    <span>
                      {new Date(m.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p>{m.content}</p>
                </div>
              </div>
            ))}
            {busy && (
              <div className="thinking">
                <Spinner label="Working with your knowledge…" />
              </div>
            )}
            {!busy &&
              session.messages.at(-1)?.sender === 'expert' &&
              session.status === 'Active' && (
                <button className="button retry-question" onClick={() => send()}>
                  <Sparkles size={15} />
                  Generate next question
                </button>
              )}
            {session.status === 'Completed' && (
              <div className="completion-note">
                <ShieldCheck size={23} />
                <h3>This handover is preserved.</h3>
                <p>
                  {session.extractedCardIds.length
                    ? 'Your knowledge drafts are ready for a human review.'
                    : 'Generate knowledge drafts when you’re ready. The original transcript is saved.'}
                </p>
                {session.extractedCardIds.map((cardId) => (
                  <Link key={cardId} className="text-link" to={`/knowledge/${cardId}`}>
                    View knowledge draft
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            )}
            <div ref={bottom} />
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              if (answer.trim()) void send(answer);
            }}
          >
            <textarea
              aria-label="Your interview answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={
                session.status === 'Paused'
                  ? 'Resume this interview to continue…'
                  : session.status === 'Completed'
                    ? 'Interview completed'
                    : 'Share what happened, what you did, and what you learned…'
              }
              disabled={busy || session.status !== 'Active'}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  if (answer.trim()) void send(answer);
                }
              }}
            />
            <div>
              <button type="button" className="text-button" onClick={() => setEvidence(true)}>
                <Plus size={15} />
                Add evidence
              </button>
              <span>Ctrl + Enter to send</span>
              <button
                className="button primary"
                disabled={busy || !answer.trim() || session.status !== 'Active'}
              >
                <Send size={15} />
                Send answer
              </button>
            </div>
          </form>
        </section>
        <aside className="stack">
          <section className="panel padded">
            <PanelTitle title="Knowledge taking shape" action={<Sparkles size={17} />} />
            <p className="muted">Discoveries from your conversation.</p>
            {session.discoveries.length ? (
              session.discoveries.map((d, i) => (
                <div className="discovery" key={i}>
                  <Check size={14} />
                  {d}
                </div>
              ))
            ) : (
              <div className="discovery-placeholder">
                Incidents, warnings, procedures, and dependencies will appear here as your interview
                develops.
              </div>
            )}
          </section>
          <section className="panel padded">
            <PanelTitle
              title="Supporting evidence"
              action={
                <button
                  className="icon-button"
                  aria-label="Add evidence"
                  onClick={() => setEvidence(true)}
                >
                  <Plus size={17} />
                </button>
              }
            />
            {session.documents.map((d) => (
              <div className="document-item" key={d.id}>
                <FileText size={17} />
                <span>
                  <strong>{d.fileName}</strong>
                  <small>{d.text.length.toLocaleString()} characters extracted</small>
                </span>
                <Badge>{d.status}</Badge>
              </div>
            ))}
            <button className="upload-prompt" onClick={() => setEvidence(true)}>
              <Upload size={22} />
              <strong>Add a note or document</strong>
              <span>PDF, DOCX, TXT, MD · Up to 10 MB</span>
            </button>
            <p className="micro-copy">
              Source material helps a reviewer distinguish experience from assumptions.
            </p>
          </section>
          <section className="panel padded">
            <PanelTitle title="Session details" />
            <dl className="detail-list">
              <div>
                <dt>Expert</dt>
                <dd>{employee?.name}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{date(session.createdAt)}</dd>
              </div>
              <div>
                <dt>Answers captured</dt>
                <dd>{session.messages.filter((m) => m.sender === 'expert').length}</dd>
              </div>
              <div>
                <dt>Save status</dt>
                <dd className="accent">Saved automatically</dd>
              </div>
            </dl>
            <button
              className="text-button"
              onClick={() => {
                const blob = new Blob(
                  [
                    session.messages
                      .map(
                        (m) =>
                          `${m.sender === 'expert' ? employee?.name : 'Continuum'}: ${m.content}`,
                      )
                      .join('\n\n'),
                  ],
                  { type: 'text/plain' },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `handover-${session.id}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={14} />
              Download transcript
            </button>
          </section>
        </aside>
      </div>
      {evidence && (
        <EvidenceModal
          employeeId={session.employeeId}
          interviewId={session.id}
          onClose={() => setEvidence(false)}
          onSaved={async () => {
            await load();
          }}
        />
      )}
    </>
  );
}
export function EvidenceModal({
  employeeId,
  interviewId,
  onClose,
  onSaved,
}: {
  employeeId: string;
  interviewId?: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { data } = useApp();
  const [mode, setMode] = useState('note');
  const [saved, setSaved] = useState<Document | null>(null);
  const { busy, error, run } = useAction();
  return (
    <Modal title="Add supporting evidence" onClose={onClose}>
      <div className="tabs">
        <button className={mode === 'note' ? 'active' : ''} onClick={() => setMode('note')}>
          Text note
        </button>
        <button className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>
          Upload document
        </button>
      </div>
      {error && <ErrorBox message={error} />}
      {saved ? (
        <div className="form-stack">
          <div className="success-note">
            <Check size={20} />
            Evidence saved: {saved.fileName}
          </div>
          <pre className="source-text">{saved.text.slice(0, 1200)}</pre>
          {saved.analysis && <p>{saved.analysis}</p>}
          <p className="muted">
            This source is ready for knowledge extraction. You can also ask the model to summarise
            it and check for contradictions.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                setSaved(await post<Document>(`/documents/${saved.id}/analyse`));
                await onSaved();
              }, 'Evidence analysed.')
            }
          >
            {busy ? (
              <Spinner />
            ) : (
              <>
                <Sparkles size={16} />
                Analyse document
              </>
            )}
          </button>
          <button className="button primary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            form.set('employeeId', employeeId);
            if (interviewId) form.set('interviewId', interviewId);
            void run(async () => {
              const result = await api<Document>('/documents/upload', {
                method: 'POST',
                body: form,
              });
              setSaved(result);
              await onSaved();
            }, 'Evidence saved.');
          }}
        >
          {mode === 'note' ? (
            <>
              <label>
                Note title
                <input name="title" placeholder="Incident report, deployment notes…" required />
              </label>
              <label>
                Original note
                <textarea
                  name="note"
                  rows={8}
                  required
                  placeholder="Include what happened, the conditions, the response, and what someone should avoid."
                />
              </label>
            </>
          ) : (
            <label className="file-input-area">
              <Upload size={27} />
              <strong>Choose a document</strong>
              <span>PDF, DOCX, TXT or Markdown · Maximum 10 MB</span>
              <input type="file" name="file" accept=".pdf,.docx,.txt,.md" required />
            </label>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? <Spinner label="Extracting text…" /> : 'Save evidence'}
          </button>
        </form>
      )}
    </Modal>
  );
}
