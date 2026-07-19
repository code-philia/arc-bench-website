import { useState, useEffect } from "react";
import {
  HistoryIcon,
  CodeIcon,
  EditIcon,
  InfoIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  XIcon,
} from "./CustomIcons";

/**
 * Workflow Controls - provides quick access to useful actions when execution is paused
 */
export function InteractiveControls({
  status,
  onRewind,
  onEditCode,
  onEditRequirements,
}: {
  status: string;
  onRewind?: () => void;
  onEditCode?: () => void;
  onEditRequirements?: () => void;
}) {
  const isPaused = status === "PAUSED";
  const isFinished = status === "PASSED" || status === "FAILED" || status === "INTERRUPTED";

  if (!isPaused && !isFinished) return null;

  return (
    <div className="interactive-controls-panel">
      <div className="control-header">
        <h3>Workflow Actions</h3>
      </div>

      <div className="control-tips">
        {isPaused && (
          <div className="control-tip-item info">
          <InfoIcon size={14} />
          <p>Execution is paused. What would you like to do?</p>
        </div>
        )}
      </div>

      <div className="control-buttons-group">
        {isPaused && (
          <>
            <button
              type="button"
              onClick={onRewind}
              className="control-button"
              title="Rewind to a previous commit"
            >
              <HistoryIcon size={18} />
              <span>Rewind</span>
            </button>

            <button
              type="button"
              onClick={onEditCode}
              className="control-button"
              title="Edit code or tests"
            >
              <CodeIcon size={18} />
              <span>Edit Code</span>
            </button>

            <button
              type="button"
              onClick={onEditRequirements}
              className="control-button"
              title="Edit requirements"
            >
              <EditIcon size={18} />
              <span>Edit Requirements</span>
            </button>
          </>
        )}

        {isFinished && (
          <button
            type="button"
            onClick={onRewind}
            className="control-button"
            title="Rewind to a previous commit"
          >
            <HistoryIcon size={18} />
            <span>Rewind</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for important actions
 */
export function ConfirmDialog({
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isOpen,
  type = "info",
}: {
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
  type?: "info" | "warning" | "danger";
}) {
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        
        <div className="confirm-actions">
          <button type="button" onClick={onCancel} className="confirm-button secondary">
            {cancelText}
          </button>
          <button type="button" onClick={onConfirm} className={`confirm-button ${type}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Simple toast notifications
 */
export function Toast({
  message,
  type = "info",
  isVisible,
  onClose,
}: {
  message: string;
  type?: "info" | "success" | "error" | "warning";
  isVisible: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div className={`toast-notification ${type}`}>
      {type === "success" && <CheckCircleIcon size={18} />}
      {type === "error" && <PauseCircleIcon size={18} />}
      {type === "warning" && <InfoIcon size={18} />}
      {type === "info" && <InfoIcon size={18} />}
      <span>{message}</span>
      <button type="button" onClick={onClose} className="toast-close">
        <XIcon size={14} />
      </button>
    </div>
  );
}
