import type { SubmissionTaskAssets } from "./types";

export const IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;

function joinResourceUrl(baseUrl: string, relativePath: string) {
  if (!baseUrl) {
    return relativePath;
  }
  const normalizedBasePath = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBasePath}${relativePath.replace(/^\/+/, "")}`;
}

export function resolveDescriptionImageSrc(rawPath: string, taskAssets?: SubmissionTaskAssets | null) {
  const trimmedPath = rawPath.trim();
  if (!trimmedPath) {
    return "";
  }
  if (/^(https?:|data:)/i.test(trimmedPath)) {
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

export function collectDescriptionImages(description: string, taskAssets?: SubmissionTaskAssets | null) {
  const images: Array<{ alt: string; src: string }> = [];
  const seen = new Set<string>();

  for (const match of description.matchAll(IMAGE_MARKDOWN_PATTERN)) {
    const alt = (match[1] || "").trim();
    const src = resolveDescriptionImageSrc(match[2] || "", taskAssets);
    if (!src || seen.has(src)) {
      continue;
    }
    seen.add(src);
    images.push({ alt, src });
  }

  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (IMAGE_MARKDOWN_PATTERN.test(line)) {
      IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
      continue;
    }
    IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
    const rawPath = resolveDescriptionImageSrc(line, taskAssets);
    if (!rawPath) {
      continue;
    }
    const looksLikeImagePath =
      /\.(png|jpe?g|gif|webp|svg)$/i.test(line) ||
      /^(https?:|data:)/i.test(line) ||
      /^(?:\.\/)?(?:reference|assets)\//i.test(line);
    if (!looksLikeImagePath || seen.has(rawPath)) {
      continue;
    }
    seen.add(rawPath);
    images.push({ alt: "", src: rawPath });
  }

  return images;
}

export function getFirstDescriptionImage(description: string, taskAssets?: SubmissionTaskAssets | null): string | null {
  const first = collectDescriptionImages(description, taskAssets)[0];
  return first?.src ?? null;
}
