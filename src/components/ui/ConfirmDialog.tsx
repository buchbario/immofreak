import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export function ConfirmDialog({ open, onClose, onCancel, onConfirm, title, message }: ConfirmDialogProps) {
  const isOpen = open ?? true;
  const handleClose = onClose ?? onCancel ?? (() => {});

  return (
    <Modal open={isOpen} onClose={handleClose} title={title} size="sm">
      <div className="flex gap-3 mb-6">
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <AlertTriangle size={18} className="text-red-500" />
        </div>
        <p className="text-sm pt-2 text-muted-foreground-2">{message}</p>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleClose}
          className="btn btn-md btn-secondary"
        >
          Abbrechen
        </button>
        <button
          onClick={() => { onConfirm(); handleClose(); }}
          className="btn btn-md btn-danger"
        >
          Löschen
        </button>
      </div>
    </Modal>
  );
}
