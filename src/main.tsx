import React, { useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Library,
  Sparkles,
  ShieldCheck,
  GitBranch,
  ChartNoAxesCombined,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Plus,
  ArrowUpRight,
  LogOut,
  Menu,
  X,
  Command,
  Eye,
  EyeOff,
} from 'lucide-react';
import { api, post, type Bootstrap } from './api';
import { AppContext } from './context';
import { Avatar, Logo, ErrorBox, Spinner } from './ui';
import { Dashboard } from './pages/Dashboard';
import { People, PersonDetail } from './pages/People';
import { KnowledgeLibrary, KnowledgeDetail } from './pages/Knowledge';
import { InterviewPage } from './pages/Interview';
import { AskPage } from './pages/Ask';
import { Verification, Conflicts, Reports, SettingsPage } from './pages/Management';
import './styles.css';

function Login({ onLogin }: { onLogin: () => void }) {
  const [signup, setSignup] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);
  const [forgot, setForgot] = useState(false);
  useEffect(() => {
    api<{ demo: boolean }>('/auth/config')
      .then((x) => setDemo(x.demo))
      .catch(() => {});
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    if (signup && f.get('password') !== f.get('confirm')) {
      setError('Passwords do not match.');
      setBusy(false);
      return;
    }
    try {
      await post(`/auth/${signup ? 'signup' : 'login'}`, {
        email: f.get('email'),
        password: f.get('password'),
        name: f.get('name'),
        organisation: f.get('organisation'),
        department: f.get('department'),
        remember: f.get('remember') === 'on',
      });
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function demoLogin() {
    setBusy(true);
    setError('');
    try {
      await post('/auth/login', {
        email: 'alex@continuum.demo',
        password: 'Continuum2026!',
        remember: false,
      });
      onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Logo />
        <div className="login-story-main">
          <div className="eyebrow">THE KNOWLEDGE THAT STAYS</div>
          <h1>
            People move on.
            <br />
            Knowledge
            <br />
            <em>shouldn’t.</em>
          </h1>
          <p>
            Turn your team’s hard-earned experience into institutional memory. Captured with care.
            Verified by people. Ready for what’s next.
          </p>
          <div className="memory-orbit">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit-core">
              <Logo small />
            </div>
            <span className="orbit-label l1">
              <ShieldCheck size={15} /> Verified knowledge
            </span>
            <span className="orbit-label l2">
              <Users size={15} /> Human experience
            </span>
            <span className="orbit-label l3">
              <GitBranch size={15} /> Connected context
            </span>
          </div>
        </div>
        <div className="login-foot">Built for the things a document can’t tell you.</div>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <div className="eyebrow">YOUR TEAM’S COLLECTIVE MEMORY</div>
          <h2>{signup ? 'Start your workspace' : 'Welcome back'}</h2>
          <p>
            {signup
              ? 'Give your team’s knowledge a place to grow.'
              : 'Good knowledge deserves continuity.'}
          </p>
          {error && <ErrorBox message={error} />}
          <form onSubmit={submit}>
            {signup && (
              <>
                <label>
                  Your name
                  <input name="name" required placeholder="Alex Morgan" autoComplete="name" />
                </label>
                <div className="form-grid">
                  <label>
                    Organisation
                    <input name="organisation" required placeholder="Acme Engineering" />
                  </label>
                  <label>
                    Department
                    <input name="department" required placeholder="Engineering" />
                  </label>
                </div>
              </>
            )}
            <label>
              Work email
              <input
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? 'text' : 'password'}
                  required
                  minLength={signup ? 12 : 1}
                  placeholder={signup ? 'At least 12 characters' : 'Enter your password'}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? 'Hide password' : 'Show password'}
                >
                  {visible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {signup && (
              <label>
                Confirm password
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                />
              </label>
            )}
            {!signup && (
              <div className="form-inline">
                <label className="checkbox">
                  <input type="checkbox" name="remember" />
                  Remember me
                </label>
                <button type="button" className="text-button" onClick={() => setForgot(!forgot)}>
                  Forgot password?
                </button>
              </div>
            )}
            {forgot && (
              <div className="info-box">
                Email recovery is not configured for this local workspace. Contact your workspace
                administrator for account assistance.
              </div>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? (
                <Spinner label="Signing in…" />
              ) : (
                <>
                  {signup ? 'Create workspace' : 'Sign in to Continuum'}
                  <ArrowUpRight size={17} />
                </>
              )}
            </button>
          </form>
          {demo && !signup && (
            <>
              <div className="divider-text">OR EXPLORE FIRST</div>
              <button className="button full" disabled={busy} onClick={demoLogin}>
                Open example workspace
                <ArrowUpRight size={16} />
              </button>
              <p className="demo-note">Sample team and knowledge. Real, persistent workflows.</p>
            </>
          )}
          <p className="login-switch">
            {signup ? 'Already have an account?' : 'New to Continuum?'}{' '}
            <button
              className="text-button accent"
              onClick={() => {
                setSignup(!signup);
                setError('');
              }}
            >
              {signup ? 'Sign in' : 'Create account'}
            </button>
          </p>
        </div>
        <p className="login-bottom">Your expertise. Your evidence. Your institutional memory.</p>
      </div>
    </div>
  );
}
const nav = [
  ['/', 'Overview', LayoutDashboard],
  ['/people', 'People', Users],
  ['/knowledge', 'Knowledge library', Library],
  ['/ask', 'Ask Continuum', Sparkles],
  ['/verification', 'Verification', ShieldCheck],
  ['/conflicts', 'Conflicts', GitBranch],
  ['/reports', 'Reports', ChartNoAxesCombined],
] as const;
function Shell({
  data,
  refresh,
  onLogout,
}: {
  data: Bootstrap;
  refresh: () => Promise<void>;
  onLogout: () => void;
}) {
  const [toast, setToast] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const needs = data.knowledge.filter((x) => x.status === 'Needs Verification').length;
  const canReview = data.user.role !== 'Employee';
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[aria-label="Search knowledge"]')?.focus();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
  useEffect(() => {
    setMobile(false);
    setNotifications(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const selected = nav.find(([p]) =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p),
  );
  return (
    <AppContext.Provider value={{ data, refresh, toast: setToast }}>
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
          <Link to="/" className="sidebar-brand">
            <Logo />
          </Link>
          <button className="workspace-switch" onClick={() => navigate('/settings')}>
            <span className="workspace-icon">{data.organisation.name[0]}</span>
            <span>
              {data.organisation.name}
              <small>{data.organisation.isDemo ? 'Example workspace' : 'Team workspace'}</small>
            </span>
            <ChevronDown size={14} />
          </button>
          <div className="nav-label">WORKSPACE</div>
          <nav>
            {nav
              .filter(([path]) => canReview || !['/verification', '/conflicts'].includes(path))
              .map(([path, label, Icon]) => (
                <NavLink key={path} to={path} end={path === '/'}>
                  <Icon size={18} />
                  <span>{label}</span>
                  {path === '/verification' && needs > 0 && <b className="nav-count">{needs}</b>}
                  {path === '/ask' && <span className="ai-tag">AI</span>}
                </NavLink>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="memory-note">
              <span className="tiny-spark">✳</span>
              <p>
                Great teams leave
                <br />
                <strong>nothing important behind.</strong>
              </p>
              <Link to="/people">
                Capture knowledge <ArrowUpRight size={13} />
              </Link>
            </div>
            <NavLink className="settings-nav" to="/settings">
              <Settings size={18} />
              Settings
            </NavLink>
            <div className="sidebar-user">
              <Avatar name={data.user.name} />
              <span>
                <strong>{data.user.name}</strong>
                <small>{data.user.role}</small>
              </span>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await post('/auth/logout');
                  onLogout();
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>
        {mobile && (
          <button
            className="sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => setMobile(false)}
          />
        )}
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                onClick={() => setMobile(!mobile)}
                aria-label="Open navigation"
              >
                <Menu size={20} />
              </button>
              <span>Workspace</span>
              <span className="slash">/</span>
              <strong>{selected?.[1] || 'Workspace settings'}</strong>
            </div>
            <div className="topbar-right">
              <form
                className="global-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  navigate(`/knowledge?q=${encodeURIComponent(search)}`);
                }}
              >
                <Search size={15} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search knowledge"
                  placeholder="Search anything…"
                />
                <kbd>
                  <Command size={10} /> K
                </kbd>
              </form>
              <div className="notification-wrap">
                <button
                  className={`icon-button notification-button ${data.notifications.some((n) => !n.read) ? 'unread' : ''}`}
                  aria-label="Notifications"
                  onClick={() => setNotifications(!notifications)}
                >
                  <Bell size={19} />
                </button>
                {notifications && (
                  <div className="notification-popover">
                    <div className="panel-title">
                      <h3>Notifications</h3>
                      <button
                        className="text-button"
                        onClick={async () => {
                          await post('/notifications/read');
                          await refresh();
                        }}
                      >
                        Mark all read
                      </button>
                    </div>
                    {data.notifications.length ? (
                      data.notifications.slice(0, 8).map((n) => (
                        <Link className={n.read ? 'read' : ''} to={n.href} key={n.id}>
                          {!n.read && <i />}
                          {n.message}
                        </Link>
                      ))
                    ) : (
                      <p>You’re all caught up.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="topbar-separator" />
              <Avatar name={data.user.name} />
            </div>
          </header>
          <main className="page-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<PersonDetail />} />
              <Route path="/knowledge" element={<KnowledgeLibrary />} />
              <Route path="/knowledge/:id" element={<KnowledgeDetail />} />
              <Route path="/interviews/:id" element={<InterviewPage />} />
              <Route path="/ask" element={<AskPage />} />
              <Route
                path="/verification"
                element={canReview ? <Verification /> : <Navigate to="/" />}
              />
              <Route path="/conflicts" element={canReview ? <Conflicts /> : <Navigate to="/" />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <footer className="page-footer">
              <span>
                <span className="status-dot" /> Your team’s knowledge, connected.
              </span>
              <span>Continuum · Institutional memory</span>
            </footer>
          </main>
        </div>
        {toast && (
          <div className="toast" role="status">
            <ShieldCheck size={18} />
            {toast}
            <button
              className="icon-button"
              onClick={() => setToast('')}
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
function App() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  async function refresh() {
    setData(await api<Bootstrap>('/bootstrap'));
  }
  async function load() {
    setLoading(true);
    setFailure('');
    try {
      const response = await fetch('/api/auth/me');
      if (response.status === 401) {
        setData(null);
        return;
      }
      if (!response.ok) throw new Error('The server could not be reached.');
      await refresh();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    const expired = () => setData(null);
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  if (loading)
    return (
      <div className="boot">
        <Logo />
        <Spinner label="Opening your workspace…" />
      </div>
    );
  if (failure)
    return (
      <div className="boot">
        <Logo />
        <ErrorBox message={failure} />
        <button className="button" onClick={load}>
          Retry connection
        </button>
      </div>
    );
  return data ? (
    <Shell data={data} refresh={refresh} onLogout={() => setData(null)} />
  ) : (
    <Login onLogin={load} />
  );
}
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="boot">
        <Logo />
        <h2>This page couldn’t load.</h2>
        <button className="button" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
// Preserve the mounted root when Vite refreshes this entry module during development.
const root = (import.meta.hot?.data.root as Root | undefined)
  ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
