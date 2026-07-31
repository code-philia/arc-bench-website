import type { SubmissionTaskAssets } from "./types";

export const IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;
export const LINK_MARKDOWN_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

export type DescriptionAttachmentKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "table"
  | "text"
  | "file";

export type DescriptionAttachment = {
  alt: string;
  extension: string;
  kind: DescriptionAttachmentKind;
  rawPath: string;
  src: string;
};

function joinResourceUrl(baseUrl: string, relativePath: string) {
  if (!baseUrl) {
    return relativePath;
  }
  const normalizedBasePath = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBasePath}${relativePath.replace(/^\/+/, "")}`;
}

function normalizeResourcePath(rawPath: string) {
  return rawPath.trim().replace(/^\.\//, "");
}

export function looksLikeManagedAttachmentPath(rawPath: string) {
  const normalized = normalizeResourcePath(rawPath);
  return /^(reference|assets)\//i.test(normalized) || /\/(?:reference|assets)\//i.test(normalized);
}

export function resolveDescriptionAssetSrc(rawPath: string, taskAssets?: SubmissionTaskAssets | null) {
  const trimmedPath = rawPath.trim();
  if (!trimmedPath) {
    return "";
  }
  if (/^(https?:|data:|blob:)/i.test(trimmedPath)) {
    return trimmedPath;
  }
  if (trimmedPath.startsWith("/")) {
    return trimmedPath;
  }
  if (trimmedPath.startsWith("./reference/") || trimmedPath.startsWith("reference/")) {
    const relativePath = trimmedPath.replace(/^\.\//, "").replace(/^reference\//, "");
    return taskAssets?.references_base_url ? joinResourceUrl(taskAssets.references_base_url, relativePath) : trimmedPath;
  }
  if (trimmedPath.startsWith("./assets/") || trimmedPath.startsWith("assets/")) {
    const relativePath = trimmedPath.replace(/^\.\//, "").replace(/^assets\//, "");
    return taskAssets?.assets_base_url ? joinResourceUrl(taskAssets.assets_base_url, relativePath) : trimmedPath;
  }
  return trimmedPath;
}

export function inferAttachmentKind(rawPath: string): DescriptionAttachmentKind {
  const normalized = rawPath.trim().toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(normalized) || /^data:image\//i.test(normalized)) {
    return "image";
  }
  if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(normalized)) {
    return "video";
  }
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(normalized)) {
    return "audio";
  }
  if (/\.pdf$/i.test(normalized)) {
    return "pdf";
  }
  if (/\.(csv|tsv)$/i.test(normalized)) {
    return "table";
  }
  if (/\.(txt|md|markdown|json|ya?ml|log)$/i.test(normalized)) {
    return "text";
  }
  return "file";
}

function attachmentExtension(rawPath: string) {
  const normalized = rawPath.trim().split(/[?#]/)[0];
  const lastSegment = normalized.split("/").pop() ?? normalized;
  const lastDot = lastSegment.lastIndexOf(".");
  return lastDot >= 0 ? lastSegment.slice(lastDot + 1).toLowerCase() : "";
}

function pushAttachment(
  bucket: DescriptionAttachment[],
  seen: Set<string>,
  rawPath: string,
  taskAssets?: SubmissionTaskAssets | null,
  alt = "",
) {
  const src = resolveDescriptionAssetSrc(rawPath, taskAssets);
  if (!src || seen.has(src)) {
    return;
  }
  seen.add(src);
  bucket.push({
    alt,
    extension: attachmentExtension(rawPath),
    kind: inferAttachmentKind(rawPath),
    rawPath: normalizeResourcePath(rawPath),
    src,
  });
}

export function collectDescriptionAttachments(description: string, taskAssets?: SubmissionTaskAssets | null) {
  const attachments: DescriptionAttachment[] = [];
  const seen = new Set<string>();

  for (const match of description.matchAll(IMAGE_MARKDOWN_PATTERN)) {
    pushAttachment(attachments, seen, match[2] || "", taskAssets, (match[1] || "").trim());
  }

  for (const match of description.matchAll(LINK_MARKDOWN_PATTERN)) {
    const prefix = match.index !== undefined && match.index > 0 ? description[match.index - 1] : "";
    if (prefix === "!") {
      continue;
    }
    pushAttachment(attachments, seen, match[2] || "", taskAssets, (match[1] || "").trim());
  }

  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (IMAGE_MARKDOWN_PATTERN.test(line) || LINK_MARKDOWN_PATTERN.test(line)) {
      IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
      LINK_MARKDOWN_PATTERN.lastIndex = 0;
      continue;
    }
    IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
    LINK_MARKDOWN_PATTERN.lastIndex = 0;
    if (!looksLikeManagedAttachmentPath(line) && !/^(https?:|data:|blob:)/i.test(line)) {
      continue;
    }
    pushAttachment(attachments, seen, line, taskAssets, "");
  }

  return attachments;
}

export function collectDescriptionImages(description: string, taskAssets?: SubmissionTaskAssets | null) {
  return collectDescriptionAttachments(description, taskAssets)
    .filter((attachment) => attachment.kind === "image")
    .map((attachment) => ({ alt: attachment.alt, src: attachment.src }));
}

export function getFirstDescriptionImage(description: string, taskAssets?: SubmissionTaskAssets | null): string | null {
  const first = collectDescriptionAttachments(description, taskAssets).find((attachment) => attachment.kind === "image");
  return first?.src ?? null;
}
