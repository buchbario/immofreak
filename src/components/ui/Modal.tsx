import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Header title. Plain string or rich node (icon + text). */
  title: ReactNode;
  /** Optional one-line description shown under the title. */
  description?: ReactNode;
  /** Body content. */
  children: ReactNode;
  /** Optional sticky footer. Pass `null` to hide. Pass any node to render. */
  footer?: ReactNode;
  /** Optional element rendered on the left side of the footer (e.g. delete button). */
  footerLeft?: ReactNode;
  size?: ModalSize;
  /** If true, clicking the backdrop won't close the modal. */
  preventBackdropClose?: boolean;
}

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',     // 448px — short forms, confirmations
  md: 'max-w-lg',     // 512px — single-section forms
  lg: 'max-w-2xl',    // 672px — multi-section forms
  xl: 'max-w-4xl',    // 896px — complex / data-heavy forms
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  footerLeft,
  size = 'md',
  preventBackdropClose,
}: ModalProps) {
  // Body-scroll lock + Escape-to-close. Bewusst beide in einem Effect, damit beim
  // Schließen die Listener und der Lock atomar entfernt werden.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = () => {
    if (!preventBackdropClose) onClose();
  };

  const renderedFooter =
    footer !== undefined
      ? footer
      : (footerLeft !== undefined ? <></> : null);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-overlay" onClick={handleBackdropClick} />
      <div className={`modal-content ${SIZES[size]}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-text">
            <div className="modal-title">{title}</div>
            {description && <div className="modal-description">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close"
            aria-label="Schließen"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {(renderedFooter || footerLeft) && (
          <div className="modal-footer">
            {footerLeft && <div className="footer-left">{footerLeft}</div>}
            {renderedFooter}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Form primitives — opt-in, but make every form modal look consistent. ───

interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/**
 * A labeled form field with optional help text and error state.
 * Wrap any input/select/textarea/NumberInput in this for consistent layout.
 */
export function Field({ label, required, help, error, htmlFor, className, children }: FieldProps) {
  return (
    <div className={`field ${className ?? ''}`}>
      {label && (
        <label className="input-label" htmlFor={htmlFor}>
          {label}
          {required && <span className="required" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <div className="field-error" role="alert">{error}</div>
      ) : help ? (
        <div className="field-help">{help}</div>
      ) : null}
    </div>
  );
}

interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

/**
 * A grouped section inside a modal body. Use to break long forms into
 * scannable parts ("Stammdaten", "Finanzen", "Notizen").
 */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <div className="form-section">
      {title && (
        <div>
          <div className="form-section-title">{title}</div>
          {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

interface FormRowProps {
  cols?: 2 | 3;
  children: ReactNode;
}

/** Responsive multi-column row inside a section (1 col on mobile, N cols on sm+). */
export function FormRow({ cols = 2, children }: FormRowProps) {
  return <div className={`form-row cols-${cols}`}>{children}</div>;
}
