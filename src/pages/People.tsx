import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Search,
  Users,
  BookOpen,
  ShieldCheck,
  Play,
  FileText,
  Pencil,
  Upload,
} from 'lucide-react';
import { useApp, useAction } from '../context';
import { api, post, patch, coverage, date, riskOf, type Employee, type Interview } from '../api';
import { Avatar, Badge, Empty, ErrorBox, Modal, PageHead, PanelTitle, Spinner } from '../ui';
export function People() {
  const { data } = useApp();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All people');
  const [add, setAdd] = useState(false);
  const people = data.employees.filter(
    (p) =>
      `${p.name} ${p.roleTitle} ${p.department} ${p.knowledgeAreas.join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === 'All people' || p.employmentStatus === status),
  );
  return (
    <>
      <PageHead
        eyebrow="THE PEOPLE BEHIND THE KNOWLEDGE"
        title="Your collective expertise"
        description="Know who knows what. Make sure their experience stays with the team."
        action={
          data.user.role === 'Admin' && (
            <button className="button primary" onClick={() => setAdd(true)}>
              <Plus size={16} />
              Add expert
            </button>
          )
        }
      />
      <div className="toolbar">
        <div className="tabs">
          {['All people', 'Active', 'Departing', 'Departed'].map((s) => (
            <button className={status === s ? 'active' : ''} onClick={() => setStatus(s)} key={s}>
              {s}
              <span>
                {s === 'All people'
                  ? data.employees.length
                  : data.employees.filter((p) => p.employmentStatus === s).length}
              </span>
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={16} />
          <input
            aria-label="Search people"
            placeholder="Search people, skills, teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="people-grid">
        {people.map((p, i) => {
          const cards = data.knowledge.filter((c) => c.expertId === p.id);
          return (
            <Link className="person-card" to={`/people/${p.id}`} key={p.id}>
              <div className="person-card-top">
                <Avatar name={p.name} index={i} large />
                <Badge>{p.employmentStatus}</Badge>
              </div>
              <h2>{p.name}</h2>
              <p>{p.roleTitle}</p>
              <span className="person-department">{p.department}</span>
              <div className="tags">
                {p.knowledgeAreas.map((a) => (
                  <span className="tag" key={a}>
                    {a}
                  </span>
                ))}
              </div>
              <div className="person-coverage">
                <span>
                  Verified knowledge coverage<strong>{coverage(cards)}%</strong>
                </span>
                <div className="progress-track">
                  <i style={{ width: `${coverage(cards)}%` }} />
                </div>
              </div>
              <div className="person-stats">
                <span>
                  <BookOpen size={14} />
                  {cards.length} cards
                </span>
                <span>
                  <Users size={14} />
                  {p.backupExperts} backups
                </span>
                <Badge>{riskOf(p)}</Badge>
              </div>
              <div className="person-card-foot">
                View profile & handovers
                <ArrowUpRight size={16} />
              </div>
            </Link>
          );
        })}
      </div>
      {!people.length && (
        <Empty
          title="No experts found"
          description="Try another search or add someone to your workspace."
        />
      )}
      {add && <EmployeeModal onClose={() => setAdd(false)} />}
    </>
  );
}
export function EmployeeModal({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const { data } = useApp();
  const selfService = data.user.role === 'Employee';
  const { busy, error, run } = useAction();
  return (
    <Modal title={employee ? 'Edit expert profile' : 'Add an expert'} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const body = {
              name: f.get('name'),
              roleTitle: f.get('roleTitle'),
              department: f.get('department'),
              employmentStatus: f.get('status'),
              knowledgeAreas: String(f.get('areas'))
                .split(',')
                .map((x) => x.trim())
                .filter(Boolean),
              backupExperts: Number(f.get('backups')),
              criticalAreas: Number(f.get('critical')),
              departureDate: String(f.get('departure') || ''),
            };
            if (employee)
              await patch(
                `/employees/${employee.id}`,
                selfService
                  ? {
                      name: body.name,
                      roleTitle: body.roleTitle,
                      department: body.department,
                      knowledgeAreas: body.knowledgeAreas,
                    }
                  : body,
              );
            else await post('/employees', body);
            onClose();
          }, 'Expert profile saved.');
        }}
      >
        {error && <ErrorBox message={error} />}
        <label>
          Full name
          <input name="name" defaultValue={employee?.name} required minLength={2} />
        </label>
        <div className="form-grid">
          <label>
            Job title
            <input name="roleTitle" defaultValue={employee?.roleTitle} required minLength={2} />
          </label>
          <label>
            Department
            <input
              name="department"
              defaultValue={employee?.department || 'Engineering'}
              required
            />
          </label>
        </div>
        <label>
          Knowledge areas<span className="field-hint">Separate with commas</span>
          <input
            name="areas"
            defaultValue={employee?.knowledgeAreas.join(', ')}
            placeholder="Payments, Redis, Deployment"
            required
          />
        </label>
        {!selfService && (
          <>
            <div className="form-grid">
              <label>
                Employment status
                <select name="status" defaultValue={employee?.employmentStatus || 'Active'}>
                  <option>Active</option>
                  <option>Departing</option>
                  <option>Departed</option>
                </select>
              </label>
              <label>
                Departure date
                <input type="date" name="departure" defaultValue={employee?.departureDate} />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Backup experts
                <input
                  name="backups"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={employee?.backupExperts || 0}
                />
              </label>
              <label>
                Critical knowledge areas
                <input
                  name="critical"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={employee?.criticalAreas || 0}
                />
              </label>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? <Spinner /> : 'Save expert'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function StartHandover({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  return (
    <Modal title="Begin knowledge handover" onClose={onClose}>
      <div className="modal-person">
        <Avatar name={employee.name} />
        <span>
          <strong>{employee.name}</strong>
          <small>{employee.roleTitle}</small>
        </span>
      </div>
      <p className="muted">
        Capture the incidents, exceptions, and hard-won lessons that don’t live in a runbook.
      </p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            const session = await post<Interview>('/interviews', {
              employeeId: employee.id,
              area: f.get('area'),
              objective: f.get('objective'),
            });
            navigate(`/interviews/${session.id}`);
            onClose();
          });
        }}
      >
        {error && <ErrorBox message={error} />}
        <label>
          Knowledge area
          <select name="area">
            {employee.knowledgeAreas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </label>
        <label>
          What should this handover preserve?
          <textarea
            name="objective"
            rows={3}
            defaultValue={`Capture ${employee.knowledgeAreas[0]} incidents, procedures, and warnings before the next handover.`}
            required
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? (
              <Spinner />
            ) : (
              <>
                <Play size={15} />
                Start handover
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function PersonDetail() {
  const { id } = useParams();
  const { data } = useApp();
  const employee = data.employees.find((x) => x.id === id);
  const [start, setStart] = useState(false);
  const [edit, setEdit] = useState(false);
  const cards = data.knowledge.filter((x) => x.expertId === id);
  const sessions = data.interviews.filter((x) => x.employeeId === id);
  if (!employee) return <Empty title="Expert not found" />;
  const canEdit = data.user.role !== 'Employee' || employee.userId === data.user.id;
  const canHandover = canEdit || employee.userId === data.user.id;
  return (
    <>
      <Link className="back-link" to="/people">
        <ArrowLeft size={15} />
        All people
      </Link>
      <div className="profile-heading">
        <Avatar name={employee.name} large />
        <div>
          <div className="eyebrow">{employee.department}</div>
          <h1>{employee.name}</h1>
          <p>{employee.roleTitle}</p>
        </div>
        <Badge>{employee.employmentStatus}</Badge>
        <div className="profile-actions">
          {canEdit && (
            <button className="button" onClick={() => setEdit(true)}>
              <Pencil size={15} />
              Edit profile
            </button>
          )}
          {canHandover && (
            <button className="button primary" onClick={() => setStart(true)}>
              <Plus size={16} />
              Begin knowledge handover
            </button>
          )}
        </div>
      </div>
      <div className="profile-metrics">
        <div>
          <span>Verified coverage</span>
          <strong>{coverage(cards)}%</strong>
        </div>
        <div>
          <span>Knowledge cards</span>
          <strong>{cards.length}</strong>
        </div>
        <div>
          <span>Critical areas</span>
          <strong>{employee.criticalAreas}</strong>
        </div>
        <div>
          <span>Backup experts</span>
          <strong>{employee.backupExperts}</strong>
        </div>
        <div>
          <span>Knowledge flight risk</span>
          <Badge>{riskOf(employee)}</Badge>
        </div>
      </div>
      <div className="two-column">
        <section className="panel padded">
          <PanelTitle
            title="Knowledge contributed"
            description="The experience this expert is preserving."
          />
          {cards.length ? (
            cards.map((c) => (
              <Link className="list-item" to={`/knowledge/${c.id}`} key={c.id}>
                <BookOpen size={17} />
                <span>
                  <strong>{c.title}</strong>
                  <small>
                    {c.area} · {c.type}
                  </small>
                </span>
                <Badge>{c.status}</Badge>
                <ArrowUpRight size={15} />
              </Link>
            ))
          ) : (
            <Empty
              title="A new chapter starts here"
              description="Begin a handover to capture this expert’s knowledge."
            />
          )}
        </section>
        <div className="stack">
          <section className="panel padded">
            <PanelTitle title="Expertise & dependencies" />
            <div className="tags roomy">
              {employee.knowledgeAreas.map((a) => (
                <span className="tag" key={a}>
                  {a}
                </span>
              ))}
            </div>
            <dl className="detail-list">
              <div>
                <dt>Employment</dt>
                <dd>{employee.employmentStatus}</dd>
              </div>
              <div>
                <dt>Departure</dt>
                <dd>{employee.departureDate ? date(employee.departureDate) : 'Not scheduled'}</dd>
              </div>
              <div>
                <dt>Backup experts</dt>
                <dd>{employee.backupExperts}</dd>
              </div>
            </dl>
            {riskOf(employee) === 'High' && (
              <div className="warning-note">
                This knowledge depends on a departing expert with no backup. Prioritise capture and
                verification.
              </div>
            )}
          </section>
          <section className="panel padded">
            <PanelTitle title="Recent handovers" />
            {sessions.map((s) => (
              <Link className="session-link" to={`/interviews/${s.id}`} key={s.id}>
                <span>
                  <strong>{s.area}</strong>
                  <small>
                    {date(s.createdAt)} · {s.messages.filter((m) => m.sender === 'expert').length}{' '}
                    answers
                  </small>
                </span>
                <Badge>{s.status}</Badge>
              </Link>
            ))}
            {!sessions.length && <p className="muted">No handovers have been started yet.</p>}
          </section>
        </div>
      </div>
      {start && <StartHandover employee={employee} onClose={() => setStart(false)} />}
      {edit && <EmployeeModal employee={employee} onClose={() => setEdit(false)} />}
    </>
  );
}
