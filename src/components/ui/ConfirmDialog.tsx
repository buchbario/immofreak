import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  /** Confirm button label, default "Löschen". */
  confirmLabel?: string;
  /** Cancel button label, default "Abbrechen". */
  cancelLabel?: string;
  /** Visual tone of the confirm action. */
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open,
  onClose,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Löschen',
  cancelLabel = 'Abbrechen',
  variant = 'danger',
}: ConfirmDialogProps) {
  const isOpen = open ?? true;
  const handleClose = onClose ?? onCancel ?? (() => {});

  const ringColor = variant === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(79,107,255,0.12)';
  const iconColor = variant === 'danger' ? 'text-red-500' : 'text-[#4F6BFF]';
  const confirmBtn = variant === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      size="sm"
      title={
        <span className="inline-flex items-center gap-2.5">
          <span
            className="size-9 rounded-full inline-flex items-center justify-center flex-shrink-0"
            style={{ background: ringColor }}
          >
            <AlertTriangle size={17} className={iconColor} strokeWidth={2.2} />
          </span>
          <span>{title}</span>
        </span>
      }
      footer={
        <>
          <button onClick={handleClose} className="btn btn-md btn-secondary">
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); handleClose(); }}
            className={`btn btn-md ${confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
    </Modal>
  );
}
