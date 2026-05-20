import { useState, useEffect, useRef } from 'react';
import type { KeyboardEvent, CSSProperties } from 'react';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';

// ===================================================================
// EditableText — hover-to-edit Textbaustein für Dokumenten-Vorschau
// -------------------------------------------------------------------
// Verwendung:
//   <EditableText value={text} defaultValue={originalText} onChange={setText}>
//     {text}
//   </EditableText>
//
// Verhalten:
//   • Standard-Ansicht: Text wird wie gewohnt gerendert
//   • Hover → dezent hinterlegter Hintergrund + Stift-Icon
//   • Klick → wird editierbar (contentEditable-Textarea)
//   • Enter ohne Shift / Blur → speichern
//   • Escape → verwerfen
//   • Button „Zurücksetzen" → Original-Default wiederherstellen
// ===================================================================

interface Props {
  /** aktueller Text (wird von außen kontrolliert) */
  value: string;
  /** Callback bei Speicherung */
  onChange: (next: string) => void;
  /** Original-Text (z. B. aus gespeicherten Stammdaten), für Reset-Button */
  defaultValue?: string;
  /** Mehrzeilig? (Default: true) – bei false wird Enter zum Speichern verwendet */
  multiline?: boolean;
  /** Zusätzliche Inline-Styles für den umschließenden span/div */
  style?: CSSProperties;
  /** Tooltip-Titel beim Hover über dem Pencil-Icon */
  editLabel?: string;
  /** bei true kann nicht editiert werden (z. B. für Vorschau ohne Interaktion) */
  readOnly?: boolean;
  /** Inline-Modus: span statt div, keine block-level Bearbeitung */
  inline?: boolean;
}

export function EditableText({
  value,
  onChange,
  defaultValue,
  multiline = true,
  style,
  editLabel = 'Bearbeiten',
  readOnly = false,
  inline = false,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  // Draft folgt `value` solange wir nicht editieren — wir berechnen das im Render
  // (mit `useRef` als Cache) statt im Effect, weil `setState`-im-Effect zu kaskadierenden
  // Renders führen kann (Regel `react-hooks/set-state-in-effect`).
  const [draft, setDraft] = useState(value);
  const lastSyncedValueRef = useRef(value);
  if (!isEditing && lastSyncedValueRef.current !== value) {
    lastSyncedValueRef.current = value;
    setDraft(value);
  }
  const [isHovered, setIsHovered] = useState(false);
  const textRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && textRef.current) {
      textRef.current.focus();
      if (textRef.current instanceof HTMLTextAreaElement) {
        // Auto-resize nach Fokus
        textRef.current.style.height = 'auto';
        textRef.current.style.height = textRef.current.scrollHeight + 'px';
      } else {
        textRef.current.select();
      }
    }
  }, [isEditing]);

  const commit = () => {
    if (draft !== value) onChange(draft);
    setIsEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const reset = () => {
    if (defaultValue !== undefined) {
      setDraft(defaultValue);
      onChange(defaultValue);
      setIsEditing(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && !e.shiftKey && !multiline) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
  };

  if (readOnly) {
    const Wrapper = inline ? 'span' : 'div';
    return <Wrapper style={style}>{value}</Wrapper>;
  }

  const Wrapper = inline ? 'span' : 'div';

  if (isEditing) {
    // Edit-Mode
    const Field = multiline ? 'textarea' : 'input';
    const fieldStyle: CSSProperties = {
      width: '100%',
      font: 'inherit',
      color: 'inherit',
      background: 'rgba(79, 107, 255, 0.05)',
      border: '1.5px solid #4F6BFF',
      borderRadius: '4px',
      padding: '4px 8px',
      margin: 0,
      outline: 'none',
      boxShadow: '0 0 0 3px rgba(79, 107, 255, 0.12)',
      boxSizing: 'border-box',
      resize: 'none',
      lineHeight: 'inherit',
      textAlign: (style?.textAlign as CSSProperties['textAlign']) || 'left',
      overflow: 'hidden',
      minHeight: multiline ? '1.6em' : undefined,
    };

    return (
      <Wrapper
        style={{
          position: 'relative',
          display: inline ? 'inline-block' : 'block',
          width: inline ? 'auto' : '100%',
          ...style,
        }}
      >
        <Field
          ref={textRef as never}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            // Auto-grow
            if (multiline && e.target instanceof HTMLTextAreaElement) {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }
          }}
          onKeyDown={handleKey}
          onBlur={(e) => {
            // Nicht auf Click eines Buttons schließen (sie sind absolute positioniert außerhalb)
            const relatedTarget = e.relatedTarget as HTMLElement | null;
            if (relatedTarget && relatedTarget.closest('[data-editable-actions]')) return;
            commit();
          }}
          style={fieldStyle}
          rows={multiline ? 1 : undefined}
        />
        <div
          data-editable-actions
          style={{
            position: 'absolute',
            top: '-28px',
            right: 0,
            display: 'flex',
            gap: '4px',
            zIndex: 10,
            padding: '4px 6px',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {defaultValue !== undefined && draft !== defaultValue && (
            <EditBtn label="Zurücksetzen" onClick={reset} color="#6b7280">
              <RotateCcw size={12} />
            </EditBtn>
          )}
          <EditBtn label="Abbrechen (Esc)" onClick={cancel} color="#6b7280">
            <X size={12} />
          </EditBtn>
          <EditBtn label="Speichern (⌘+Enter)" onClick={commit} color="#4F6BFF" primary>
            <Check size={12} />
          </EditBtn>
        </div>
      </Wrapper>
    );
  }

  // View-Mode
  const isCustomized = defaultValue !== undefined && value !== defaultValue;
  const viewStyle: CSSProperties = {
    position: 'relative',
    display: inline ? 'inline' : 'block',
    padding: inline ? '1px 2px' : '2px 4px',
    margin: inline ? '0 -2px' : '0 -4px',
    borderRadius: '3px',
    background: isHovered ? 'rgba(79, 107, 255, 0.08)' : (isCustomized ? 'rgba(79, 107, 255, 0.04)' : 'transparent'),
    cursor: 'text',
    outline: isHovered ? '1px dashed #4F6BFF' : (isCustomized ? '1px dotted rgba(79, 107, 255, 0.3)' : 'none'),
    transition: 'background 120ms, outline-color 120ms',
    ...style,
  };

  return (
    <Wrapper
      style={viewStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
      title={editLabel}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {value || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Klicken zum Ausfüllen…</span>}
      {isHovered && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-10px',
            right: '-4px',
            background: '#4F6BFF',
            color: '#ffffff',
            borderRadius: '999px',
            width: '18px',
            height: '18px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(79,107,255,0.3)',
            pointerEvents: 'none',
            zIndex: 9,
          }}
        >
          <Pencil size={10} />
        </span>
      )}
    </Wrapper>
  );
}

// ---------------------------------------------------------------
// kleiner Edit-Button
// ---------------------------------------------------------------

function EditBtn({
  children,
  onClick,
  label,
  color,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  color: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // blur des Textareas verhindern
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '22px',
        height: '22px',
        borderRadius: '4px',
        background: primary ? color : 'transparent',
        color: primary ? '#ffffff' : color,
        border: primary ? 'none' : `1px solid ${color}33`,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}
