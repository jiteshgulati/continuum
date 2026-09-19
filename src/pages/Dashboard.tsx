import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  BookOpen,
  ShieldCheck,
  Clock3,
  GitBranch,
  ChevronDown,
  TriangleAlert,
  MoreHorizontal,
  CalendarDays,
} from 'lucide-react';
import { useApp } from '../context';
import { Avatar, Badge, PageHead, PanelTitle, Empty } from '../ui';
import { coverage, date, riskOf } from '../api';

export function Dashboard() {
  const { data } = useApp();
  const [range, setRange] = useState('30');
  const cards = data.knowledge;
  const verified = cards.filter((c) => c.status === 'Verified');
  const queue = cards.filter((c) => c.status === 'Needs Verification');
  const open = data.conflicts.filter((c) => c.status === 'Open');
  const departing = data.employees.filter((e) => e.employmentStatus === 'Departing');
  const risks = [...data.employees]
    .filter((p) => riskOf(p) !== 'Low')
    .sort(
      (a, b) =>
        Number(riskOf(b) === 'High') - Number(riskOf(a) === 'High') ||
        b.criticalAreas - a.criticalAreas,
    );
  const percent = coverage(cards);
  const days = Number(range);
  const recent = cards.filter((c) => Date.parse(c.createdAt) > Date.now() - days * 86400000);
  const barsFor = (items: { createdAt: string }[]) =>
    Array.from(
      { length: 12 },
      (_, i) =>
        items.filter((x) => {
          const age = Date.now() - Date.parse(x.createdAt);
          return (
            age >= (days * 86400000 * (11 - i)) / 12 && age < (days * 86400000 * (12 - i)) / 12
          );
        }).length,
    );
  const metrics = [
    {
      label: 'Knowledge cards',
      value: cards.length,
      sub: `${recent.length} captured in ${days} days`,
      icon: BookOpen,
      color: 'lime',
      bars: barsFor(cards),
      to: '/knowledge',
    },
    {
      label: 'Verified knowledge',
      value: verified.length,
      sub: `${percent}% of your collective knowledge`,
      icon: ShieldCheck,
      color: 'green',
      bars: barsFor(verified),
      to: '/knowledge?status=Verified',
    },
    {
      label: 'Needs verification',
      value: queue.length,
      sub: 'Ready for a human perspective',
      icon: Clock3,
      color: 'amber',
      bars: barsFor(queue),
      to: data.user.role === 'Employee' ? '/knowledge?status=Needs+Verification' : '/verification',
    },
    {
      label: 'Open conflicts',
      value: open.length,
      sub: open.length ? 'A little clarity goes a long way' : 'Your knowledge is in agreement',
      icon: GitBranch,
      color: 'red',
      bars: barsFor(open),
      to: data.user.role === 'Employee' ? '/knowledge' : '/conflicts',
    },
  ];
  return (
    <>
      <PageHead
        eyebrow="THE BIG PICTURE"
        title="Institutional memory"
        description="A living view of what your team knows, and what needs to be preserved."
        action={
          <>
            <label className="range-select">
              <CalendarDays size={15} />
              <select
                aria-label="Activity period"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="30">Last 30 days</option>
                <option value="7">Last 7 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </label>
            <Link className="button primary" to="/people">
              <Plus size={16} />
              Start a handover
            </Link>
          </>
        }
      />
      <div className="overview-intro">
        <span className="status-dot" />
        <span>Knowledge is a team sport.</span>
        <span className="muted">Keep yours in play.</span>
        <span className="overview-date">
          {new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>
      <div className="metrics-grid">
        {metrics.map((m) => (
          <Link to={m.to} className={`metric ${m.color}`} key={m.label}>
            <div className="metric-top">
              <span>{m.label}</span>
              <m.icon size={17} />
            </div>
            <div className="metric-main">
              <strong>{m.value.toString().padStart(2, '0')}</strong>
              <div
                className="sparkline"
                title="Creation activity for records currently in this state"
                aria-hidden="true"
              >
                {m.bars.map((h, i) => (
                  <i
                    key={i}
                    style={{
                      height: h ? Math.max(4, (h / Math.max(...m.bars)) * 34) : 2,
                      opacity: h ? 0.8 : 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="metric-bottom">
              <span className="metric-indicator">
                {m.color === 'green' ? (
                  <ShieldCheck size={12} />
                ) : m.color === 'amber' ? (
                  <Clock3 size={12} />
                ) : (
                  <ArrowUpRight size={12} />
                )}
              </span>
              {m.sub}
            </div>
          </Link>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel risk-panel">
          <PanelTitle
            title="Knowledge flight risk"
            description="Critical knowledge. Too few people holding it."
            action={
              <Link className="text-link" to="/reports">
                View report <ArrowUpRight size={14} />
              </Link>
            }
          />
          <div className="risk-table">
            <div className="risk-table-head">
              <span>KNOWLEDGE AREA / EXPERT</span>
              <span>BACKUPS</span>
              <span>RISK LEVEL</span>
            </div>
            {risks.slice(0, 3).map((p, i) => (
              <Link to={`/people/${p.id}`} className="risk-row" key={p.id}>
                <div className={`risk-area-icon risk-icon-${i}`}>
                  <span>
                    {i === 0 ? (
                      <GitBranch size={20} />
                    ) : i === 1 ? (
                      <BookOpen size={20} />
                    ) : (
                      <ShieldCheck size={20} />
                    )}
                  </span>
                </div>
                <div className="risk-name">
                  <strong>{p.knowledgeAreas[0]}</strong>
                  <span>
                    {p.name} <span className="middot">·</span> {p.employmentStatus}
                  </span>
                </div>
                <span className="backups">
                  <UsersStack count={p.backupExperts} />
                  <span>
                    {p.backupExperts} {p.backupExperts === 1 ? 'expert' : 'experts'}
                  </span>
                </span>
                <Badge>{riskOf(p)}</Badge>
                <ArrowUpRight className="row-arrow" size={15} />
              </Link>
            ))}
            {!risks.length && (
              <Empty
                title="No high-risk dependencies"
                description="Add your experts to build a picture of knowledge risk."
              />
            )}
          </div>
          <div className="risk-foot">
            <TriangleAlert size={14} />
            <span>
              {risks.filter((p) => riskOf(p) === 'High').length} areas need attention before
              expertise walks out the door.
            </span>
          </div>
        </section>
        <section className="panel health-panel">
          <PanelTitle title="Knowledge health" action={<span className="subtle-pill">LIVE</span>} />
          <div className="health-body">
            <div
              className="health-ring"
              style={{
                background: `conic-gradient(var(--accent) 0% ${percent}%, #2a2d30 ${percent}% 100%)`,
              }}
            >
              <div>
                <strong>
                  {percent}
                  <small>%</small>
                </strong>
                <span>verified coverage</span>
              </div>
            </div>
            <div className="health-legend">
              <span>
                <i className="legend-dot lime" />
                Verified<strong>{verified.length}</strong>
              </span>
              <span>
                <i className="legend-dot dark" />
                Awaiting clarity<strong>{cards.length - verified.length}</strong>
              </span>
            </div>
          </div>
          <div className="health-footer">
            <span className="tiny-spark">✳</span>
            <p>
              Every verified card is one less
              <br />
              thing only one person knows.
            </p>
          </div>
        </section>
      </div>
      <section className="panel departing-panel">
        <PanelTitle
          title="Handover in focus"
          description="Help departing experts leave their knowledge in good hands."
          action={
            <Link className="text-link" to="/people">
              All people <ArrowRight size={14} />
            </Link>
          }
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>EXPERT</th>
                <th>KNOWLEDGE AREAS</th>
                <th>VERIFIED COVERAGE</th>
                <th>DEPARTURE</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {departing.map((p, i) => {
                const own = cards.filter((c) => c.expertId === p.id);
                const captured = coverage(own);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link className="person-cell" to={`/people/${p.id}`}>
                        <Avatar name={p.name} index={i} />
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.roleTitle}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <div className="tags">
                        {p.knowledgeAreas.slice(0, 2).map((a) => (
                          <span className="tag" key={a}>
                            {a}
                          </span>
                        ))}
                        {p.knowledgeAreas.length > 2 && (
                          <span className="tag muted">+{p.knowledgeAreas.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="progress-cell">
                        <div className="progress-track">
                          <i style={{ width: `${captured}%` }} />
                        </div>
                        <span>{captured}%</span>
                      </div>
                    </td>
                    <td className="date-cell">
                      {p.departureDate ? date(p.departureDate) : 'Not set'}
                    </td>
                    <td>
                      <Badge>{p.employmentStatus}</Badge>
                    </td>
                    <td>
                      <Link className="table-action" to={`/people/${p.id}`}>
                        View handover
                        <ArrowUpRight size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!departing.length && (
            <Empty
              title="No departures on the horizon"
              description="You can capture valuable knowledge at any time."
            />
          )}
        </div>
      </section>
      <div className="section-heading">
        <div>
          <h2>Recently captured</h2>
          <p>Experience, made reusable.</p>
        </div>
        <Link className="text-link" to="/knowledge">
          Explore the library
          <ArrowRight size={14} />
        </Link>
      </div>
      <div className="recent-grid">
        {[...cards]
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
          .slice(0, 3)
          .map((c) => {
            const p = data.employees.find((p) => p.id === c.expertId);
            return (
              <Link key={c.id} to={`/knowledge/${c.id}`} className="recent-card">
                <div className="recent-top">
                  <span className="card-type">
                    <BookOpen size={15} />
                    {c.type}
                  </span>
                  <ArrowUpRight size={15} />
                </div>
                <h3>{c.title}</h3>
                <p>{c.summary}</p>
                <div className="recent-tags">
                  <span className="tag">{c.area}</span>
                  <Badge>{c.status}</Badge>
                </div>
                <div className="recent-foot">
                  <Avatar name={p?.name || 'Expert'} />
                  <span>{p?.name}</span>
                  <small>
                    {new Date(c.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </small>
                </div>
              </Link>
            );
          })}
      </div>
    </>
  );
}
function UsersStack({ count }: { count: number }) {
  return (
    <span className="users-stack">
      {count === 0 ? (
        <span className="empty-user">—</span>
      ) : (
        Array.from({ length: Math.min(count, 3) }, (_, i) => <span key={i}>●</span>)
      )}
    </span>
  );
}
