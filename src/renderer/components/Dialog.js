import React, { useCallback, useEffect, useRef } from 'react';
import { Icon } from './Icon.js';

// 通用模态容器：统一处理 ESC、背景点击、焦点还原和背景滚动锁。
export function ModalShell({ title, onClose, children, footer, maxWidth = 600, busy = false }) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const target = panelRef.current && panelRef.current.querySelector('[data-autofocus]');
      if (target) {
        target.focus();
        if (target.select) target.select();
      }
    }, 40);

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      const el = previousFocus.current;
      if (el && el.focus) requestAnimationFrame(() => el.focus());
    };
  }, []);

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && !busy) {
        event.stopPropagation();
        onClose();
      }
    },
    [onClose, busy]
  );

  const handleBackdrop = useCallback(
    (event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    },
    [onClose, busy]
  );

  return (
    <div className="modal-overlay" onClick={handleBackdrop} onKeyDown={handleKeyDown}>
      <div className="modal" style={{ maxWidth }} ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="btn btn-icon btn-secondary" disabled={busy} aria-label="关闭">
            <Icon name="x" size={20}/>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({ state, onResolve }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!state.open) return undefined;
    const timer = setTimeout(() => cancelRef.current && cancelRef.current.focus(), 40);
    const handler = (event) => {
      if (event.key === 'Escape') onResolve(false);
    };
    window.addEventListener('keydown', handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handler);
    };
  }, [state.open, onResolve]);

  if (!state.open) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onResolve(false)}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{state.title}</h3>
          <button onClick={() => onResolve(false)} className="btn btn-icon btn-secondary" aria-label="关闭">
            <Icon name="x" size={20}/>
          </button>
        </div>
        <div className="modal-body">
          <p className="confirm-message">{state.message}</p>
        </div>
        <div className="modal-footer">
          <button ref={cancelRef} onClick={() => onResolve(false)} className="btn btn-secondary">
            {state.cancelText}
          </button>
          <button
            onClick={() => onResolve(true)}
            className={'btn ' + (state.tone === 'danger' ? 'btn-danger' : 'btn-primary')}
          >
            {state.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={'toast toast-' + (toast.tone || 'success')} role="status">
      <Icon name={toast.tone === 'error' ? 'alert' : 'check'} size={16}/>
      <span>{toast.message}</span>
    </div>
  );
}
