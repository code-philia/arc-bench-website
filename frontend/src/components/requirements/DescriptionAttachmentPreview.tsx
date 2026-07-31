import { FileOutlined, FileTextOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";

import type { DescriptionAttachment } from "../../lib/descriptionMedia";

function fileNameFromPath(rawPath: string) {
  const normalized = rawPath.split(/[?#]/)[0];
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || rawPath;
}

function parseDelimitedPreview(content: string, delimiter: "," | "\t") {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 6)
    .map((line) => line.split(delimiter).slice(0, 5));
}

function stringifyJsonPreview(content: string) {
  try {
    const parsed = JSON.parse(content) as unknown;
    return JSON.stringify(parsed, null, 2).split(/\r?\n/).slice(0, 8).join("\n");
  } catch {
    return content.split(/\r?\n/).slice(0, 8).join("\n");
  }
}

function AttachmentTextPreview({ attachment }: { attachment: DescriptionAttachment }) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    fetch(attachment.src, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load attachment preview");
        }
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.src]);

  const previewMode = attachment.kind === "table"
    ? (attachment.extension === "tsv" ? "tsv" : "csv")
    : (attachment.extension === "json" ? "json" : "text");

  const tableRows = useMemo(() => {
    if (!content || previewMode === "json" || previewMode === "text") {
      return [];
    }
    return parseDelimitedPreview(content, previewMode === "tsv" ? "\t" : ",");
  }, [content, previewMode]);

  const textPreview = useMemo(() => {
    if (!content || previewMode === "csv" || previewMode === "tsv") {
      return "";
    }
    return previewMode === "json"
      ? stringifyJsonPreview(content)
      : content.split(/\r?\n/).slice(0, 8).join("\n");
  }, [content, previewMode]);

  if (loading) {
    return <div className="requirement-attachment-preview-placeholder">Loading preview...</div>;
  }
  if (loadFailed) {
    return <div className="requirement-attachment-preview-placeholder">Preview unavailable</div>;
  }
  if (tableRows.length > 0) {
    return (
      <div className="requirement-attachment-table-scroll">
        <table className="requirement-attachment-table">
          <tbody>
            {tableRows.map((row, rowIndex) => (
              <tr key={`${attachment.src}-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${attachment.src}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (textPreview) {
    return <pre className="requirement-attachment-text-preview">{textPreview}</pre>;
  }
  return <div className="requirement-attachment-preview-placeholder">No preview content</div>;
}

export default function DescriptionAttachmentPreview({
  attachment,
  variant = "detail",
  onDelete,
  deleteLabel = "Delete",
  deleting = false,
}: {
  attachment: DescriptionAttachment;
  variant?: "detail" | "markdown";
  onDelete?: () => void;
  deleteLabel?: string;
  deleting?: boolean;
}) {
  const fileName = attachment.alt || fileNameFromPath(attachment.rawPath);
  const extensionLabel = attachment.extension ? attachment.extension.toUpperCase() : "FILE";
  const className = `requirement-attachment-card ${variant === "markdown" ? "markdown-variant" : "detail-variant"}`;

  return (
    <figure className={className}>
      <div className="requirement-attachment-preview-shell">
        {attachment.kind === "image" ? (
          <img src={attachment.src} alt={fileName} className="requirement-attachment-image" loading="lazy" />
        ) : null}
        {attachment.kind === "video" ? (
          <video src={attachment.src} className="requirement-attachment-video" controls preload="metadata" />
        ) : null}
        {attachment.kind === "audio" ? (
          <div className="requirement-attachment-audio-shell">
            <PlayCircleOutlined className="requirement-attachment-audio-icon" />
            <audio src={attachment.src} className="requirement-attachment-audio" controls preload="metadata" />
          </div>
        ) : null}
        {attachment.kind === "pdf" ? (
          <iframe src={attachment.src} title={fileName} className="requirement-attachment-pdf" />
        ) : null}
        {attachment.kind === "table" || attachment.kind === "text" ? (
          <AttachmentTextPreview attachment={attachment} />
        ) : null}
        {attachment.kind === "file" ? (
          <div className="requirement-attachment-generic">
            <FileOutlined className="requirement-attachment-generic-icon" />
            <FileTextOutlined className="requirement-attachment-generic-subicon" />
          </div>
        ) : null}
      </div>
      <figcaption className="requirement-attachment-caption">
        <div className="requirement-attachment-caption-main">
          <span className="requirement-attachment-name">{fileName}</span>
          <span className="requirement-attachment-badge">{extensionLabel}</span>
        </div>
        <div className="requirement-attachment-actions">
          <a href={attachment.src} target="_blank" rel="noreferrer" className="requirement-attachment-link">
            Open
          </a>
          {onDelete ? (
            <button
              type="button"
              className="requirement-attachment-link requirement-attachment-delete"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : deleteLabel}
            </button>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
