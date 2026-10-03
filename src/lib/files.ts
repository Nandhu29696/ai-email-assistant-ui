import api from "@/lib/api";

/** Download an authenticated API resource (plain <a href> links carry no auth cookie header on cross-origin APIs). */
export async function downloadWithAuth(path: string, filename: string) {
  const response = await api.get(path, { responseType: "blob", timeout: 120_000 });
  const url = URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
