import { ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";

export function EntryModal({ title, subtitle, onClose, children, footer, size = "standard", className = "" }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "compact" | "standard" | "wide";
  className?: string;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <section
        className={`entry-modal entry-modal-${size}${className ? ` ${className}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="entry-modal-header">
          <div className="entry-modal-heading">
            <h2 id="entry-modal-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="entry-modal-body">{children}</div>
        {footer ? (
          <footer className="entry-modal-footer">{footer}</footer>
        ) : null}
      </section>
    </div>
  );
}

export function FormField({ label, optional = false, hint, className = "", children }: {
  label: string;
  optional?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`modal-field${className ? ` ${className}` : ""}`}>
      <span className="modal-field-label">
        {label}
        {optional ? (
          <span className="modal-field-optional">Optional</span>
        ) : null}
      </span>
      {children}
      {hint ? <span className="modal-field-hint">{hint}</span> : null}
    </label>
  );
}

export function ModalSection({ title, description, children, className = "" }: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`modal-section${className ? ` ${className}` : ""}`}>
      {title || description ? (
        <div className="modal-section-heading">
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DisclosureSection({ title, summary, children, defaultOpen = false, className = "" }: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={`modal-disclosure${className ? ` ${className}` : ""}`}
      open={defaultOpen || undefined}
    >
      <summary>
        <span className="modal-disclosure-title">{title}</span>
        {summary ? (
          <span className="modal-disclosure-summary">{summary}</span>
        ) : null}
        <ChevronDown className="modal-disclosure-chevron" aria-hidden="true" />
      </summary>
      <div className="modal-disclosure-content">{children}</div>
    </details>
  );
}

export function ModalActions({ onCancel, primaryLabel, primaryType = "button", onPrimary, disabled = false, primaryDisabled = disabled, secondaryAction }: {
  onCancel: () => void;
  primaryLabel: string;
  primaryType?: "button" | "submit";
  onPrimary?: () => void;
  disabled?: boolean;
  primaryDisabled?: boolean;
  secondaryAction?: ReactNode;
}) {
  return (
    <>
      <div className="entry-modal-footer-secondary">{secondaryAction}</div>
      <div className="entry-modal-footer-actions">
        <button
          type="button"
          className="modal-button modal-button-secondary"
          onClick={onCancel}
          disabled={disabled}
        >
          Cancel
        </button>
        <button
          type={primaryType}
          className="modal-button modal-button-primary"
          onClick={onPrimary}
          disabled={primaryDisabled}
        >
          {primaryLabel}
        </button>
      </div>
    </>
  );
}