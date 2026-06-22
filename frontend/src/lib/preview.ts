export async function checkHostDemoPreview(previewUrl: string): Promise<boolean> {
  const normalizedBase = previewUrl.endsWith("/") ? previewUrl.slice(0, -1) : previewUrl;
  const response = await fetch(`${normalizedBase}/api/health`, {
    method: "GET",
    mode: "cors",
  });
  return response.ok;
}
