import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowUp,
  Sparkles,
  ShieldCheck,
  BookOpen,
  GitBranch,
  Search,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context';
import { post, type Knowledge } from '../api';
import { Avatar, Badge, ErrorBox, Logo, Spinner } from '../ui';
interface Answer {
  answer: string;
  sources: (Knowledge & { citation?: number })[];
  related: Knowledge[];
  warnings: string[];
  mode: string;
}
export function AskPage() {
  const { data } = useApp();
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<{ question: string; result: Answer }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function ask(value = question) {
    if (!value.trim()) return;
    setBusy(true);
    setError('');
    try {
      const result = await post<Answer>('/ask', { question: value });
      setHistory((h) => [...h, { question: value, result }]);
      setQuestion('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="ask-page">
      <div className="ask-top">
        <span>
          <Sparkles size={17} />
          Ask Continuum
        </span>
        <span className="subtle-pill">GROUNDED IN YOUR TEAM’S KNOWLEDGE</span>
        {history.length > 0 && (
          <button
            className="text-button"
            onClick={() => {
              setHistory([]);
              setError('');
            }}
          >
            <RotateCcw size={14} />
            New conversation
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="ask-welcome">
          <div className="ask-symbol">
            <Sparkles size={34} />
          </div>
          <div className="eyebrow">SOMEONE ON YOUR TEAM HAS BEEN HERE BEFORE</div>
          <h1>
            Start with a question.
            <br />
            <span>Find the experience behind it.</span>
          </h1>
          <p>
            Answers from your organisation’s verified knowledge,
            <br />
            with the people, evidence, and context that make them trustworthy.
          </p>
          <div className="question-suggestions">
            {[
              { icon: GitBranch, text: 'Payment API is returning 502. What should I check?' },
              { icon: BookOpen, text: 'What should I know before a PostgreSQL migration?' },
              { icon: ShieldCheck, text: 'How do we safely roll back the payment service?' },
            ].map(({ icon: Icon, text }) => (
              <button
                key={text}
                disabled={busy}
                onClick={() => {
                  setQuestion(text);
                  void ask(text);
                }}
              >
                <Icon size={18} />
                <span>{text}</span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="answer-history">
          {history.map((item, i) => (
            <div className="answer-turn" key={i}>
              <div className="ask-user">
                <Avatar name={data.user.name} />
                <h2>{item.question}</h2>
              </div>
              <div className="answer-content">
                <Logo small />
                <div>
                  <div className="answer-label">
                    Continuum
                    <Badge tone={item.result.mode === 'grounded' ? 'green' : 'amber'}>
                      {item.result.mode === 'grounded'
                        ? 'Verified sources'
                        : 'More knowledge needed'}
                    </Badge>
                  </div>
                  <p className="answer-text">{item.result.answer}</p>
                  {item.result.warnings.map((w, j) => (
                    <div className="warning-note" key={j}>
                      {w}
                    </div>
                  ))}
                  {item.result.sources.length > 0 && (
                    <>
                      <div className="eyebrow sources-heading">FOLLOW THE KNOWLEDGE</div>
                      <div className="answer-sources">
                        {item.result.sources.map((s, j) => {
                          const expert = data.employees.find((p) => p.id === s.expertId);
                          return (
                            <Link className="answer-source" key={s.id} to={`/knowledge/${s.id}`}>
                              <span className="citation-number">{s.citation || j + 1}</span>
                              <div>
                                <strong>{s.title}</strong>
                                <small>
                                  {expert?.name} · {s.evidence.length} evidence sources · v
                                  {s.version}
                                </small>
                              </div>
                              <ShieldCheck size={16} />
                              <ArrowUpRight size={14} />
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {item.result.related.length > 0 && (
                    <details className="related-details">
                      <summary>
                        Related knowledge awaiting review ({item.result.related.length})
                      </summary>
                      {item.result.related.map((c) => (
                        <Link className="list-item" to={`/knowledge/${c.id}`} key={c.id}>
                          <span>{c.title}</span>
                          <Badge>{c.status}</Badge>
                        </Link>
                      ))}
                    </details>
                  )}
                  {!item.result.sources.length && (
                    <Link className="button" to="/people">
                      Find an expert
                      <ArrowUpRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {busy && (
        <div className="ask-thinking">
          <Spinner label="Looking through your verified knowledge…" />
        </div>
      )}
      {error && <ErrorBox message={error} />}
      <form
        className="ask-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <textarea
          aria-label="Ask a question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would you like your team’s experience to tell you?"
          rows={2}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void ask();
            }
          }}
        />
        <div>
          <span>
            <ShieldCheck size={14} />
            Verified knowledge first. Sources always.
          </span>
          <button
            className="send-question"
            aria-label="Send question"
            disabled={busy || !question.trim()}
          >
            <ArrowUp size={21} />
          </button>
        </div>
      </form>
      <div className="ask-disclaimer">
        {data.ai.configured ? data.ai.provider : 'AI setup required for generated answers'}{' '}
        <span>·</span> Knowledge is context. Always check whether it applies.
      </div>
    </div>
  );
}
