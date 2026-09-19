import { useEffect, useRef, type ReactNode } from 'react';
import { X, ArrowUpRight, FileText, LoaderCircle, Check, AlertTriangle } from 'lucide-react';
import { initials } from './api';
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand ${small ? 'small' : ''}`}>
      <span className="brand-symbol">
        <svg viewBox="0 0 32 32">
          <path d="M23 8H14a8 8 0 0 0 0 16h9M21 13h-7a3 3 0 0 0 0 6h7" />
        </svg>
      </span>
      {!small && (
        <span>
          continuum<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const value = String(children);
  const type =
    tone ||
    (['Verified', 'Low', 'Active', 'Analysed', 'Resolved'].includes(value)
      ? 'green'
      : ['High', 'Conflict Detected', 'Disputed', 'Departed'].includes(value)
        ? 'red'
        : [
              'Needs Verification',
              'Needs Clarification',
              'Medium',
              'Departing',
              'Paused',
              'Open',
            ].includes(value)
          ? 'amber'
          : 'gray');
  return (
    <span className={`badge ${type}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function Avatar({
  name,
  index = 0,
  large = false,
}: {
  name: string;
  index?: number;
  large?: boolean;
}) {
  return (
    <span className={`avatar avatar-${index % 5} ${large ? 'large' : ''}`}>{initials(name)}</span>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <FileText size={28} />
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}
export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <span className="loading">
      <LoaderCircle className="spin" size={17} />
      {label}
    </span>
  );
}
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="head-actions">{action}</div>}
    </div>
  );
}
export function PanelTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="error-box" role="alert">
      <AlertTriangle size={18} />
      <span>{message}</span>
    </div>
  );
}
export function ActionLink({ children }: { children: ReactNode }) {
  return (
    <span className="action-link">
      {children}
      <ArrowUpRight size={14} />
    </span>
  );
}
export function CheckIcon() {
  return (
    <span className="check-icon">
      <Check size={12} />
    </span>
  );
}
