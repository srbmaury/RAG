import { api } from './api';
import type { Doc } from './types';

type UploadedDocument = Doc & { duplicate?: boolean };
type UploadStatus = (percent: number) => void;

/** Upload a file, retrying interrupted staged chunks without repeating accepted bytes. */
export async function uploadDocument(
  workspaceId: string,
  file: File,
  progress: UploadStatus,
): Promise<UploadedDocument[]> {
  if (file.size <= 8 * 1024 * 1024) {
    const body = new FormData();
    body.append('files', file);
    const result = await api<{ documents: UploadedDocument[] }>(
      `/workspaces/${workspaceId}/documents`,
      { method: 'POST', body },
    );
    return result.documents;
  }

  const job = await api<{ id: string; part_bytes: number }>(`/workspaces/${workspaceId}/uploads`, {
    method: 'POST',
    body: JSON.stringify({ name: file.name, size: file.size }),
  });
  let staged = true;
  try {
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + job.part_bytes, file.size);
      let sent = false;
      for (let attempt = 0; attempt < 3 && !sent; attempt++) {
        try {
          await api(`/workspaces/${workspaceId}/uploads/${job.id}?offset=${offset}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: file.slice(offset, end),
          });
          sent = true;
        } catch (error) {
          const state = await api<{ offset: number }>(
            `/workspaces/${workspaceId}/uploads/${job.id}`,
          );
          if (state.offset === end) sent = true;
          else if (state.offset !== offset || attempt === 2) throw error;
        }
      }
      offset = end;
      progress(Math.round((offset / file.size) * 100));
    }
    const document = await api<UploadedDocument>(
      `/workspaces/${workspaceId}/uploads/${job.id}/complete`,
      { method: 'POST' },
    );
    staged = false;
    return [document];
  } finally {
    if (staged) {
      await api(`/workspaces/${workspaceId}/uploads/${job.id}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }
  }
}
