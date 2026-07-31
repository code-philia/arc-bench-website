export function getHostDemoPreviewBase(): string {
  const configuredBase = import.meta.env.VITE_HOST_DEMO_PREVIEW_BASE?.trim();
  const origin = typeof window !== "undefined" ? window.location.hostname : "127.0.0.1";
  const base = configuredBase && configuredBase.length > 0 ? configuredBase : `http://${origin}:3000`;
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

export async function checkHostDemoPreview(previewUrl: string): Promise<boolean> {
  const normalizedBase = previewUrl.endsWith("/") ? previewUrl.slice(0, -1) : previewUrl;
  const response = await fetch(`${normalizedBase}/api/health`, {
    method: "GET",
  });
  return response.ok;
}
