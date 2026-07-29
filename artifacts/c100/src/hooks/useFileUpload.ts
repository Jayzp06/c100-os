import { useCallback, useState } from 'react';

export type UploadWorkspace =
  | 'governance'
  | 'secretary'
  | 'finances'
  | 'historian'
  | 'conduct'
  | 'procedure';

export interface UploadResult {
  uploadUrl: string;
  objectPath: string;
  expiresAt: string;
  metadata: { name: string; size: number; contentType: string };
}

export interface UseFileUploadOptions {
  /** Which officer workspace owns the uploaded files. Required. */
  workspace: UploadWorkspace;
  /** Max file size in bytes (default: 20 MB) */
  maxBytes?: number;
  /** Allowed MIME types. Pass empty array to allow all. */
  allowedTypes?: string[];
  onSuccess?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for the presigned-URL file upload flow.
 *
 * 1. POST /api/storage/uploads/request-url  (JSON metadata + workspace)
 * 2. PUT <presigned-url>                     (file bytes → GCS directly)
 *
 * The `workspace` option is required and must match the officer workspace
 * the caller has permission to access.  The server enforces this permission
 * check and embeds the workspace in the storage path so downloads are
 * workspace-scoped too.
 *
 * Returns the objectPath to store in the database, served via
 * GET /api/storage/objects/{workspace}/{uuid}.
 */
export function useFileUpload(options: UseFileUploadOptions) {
  const {
    workspace,
    maxBytes = 20 * 1024 * 1024,
    allowedTypes = [],
    onSuccess,
    onError,
  } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult | null> => {
      setError(null);
      setProgress(0);

      // Client-side validation
      if (file.size > maxBytes) {
        const err = new Error(
          `File exceeds maximum size of ${(maxBytes / 1024 / 1024).toFixed(0)} MB`,
        );
        setError(err);
        onError?.(err);
        return null;
      }

      if (allowedTypes.length > 0) {
        const allowed = allowedTypes.some((t) => {
          if (t.endsWith('/*')) return file.type.startsWith(t.slice(0, -2));
          return file.type === t;
        });
        if (!allowed) {
          const err = new Error(`File type "${file.type}" is not allowed`);
          setError(err);
          onError?.(err);
          return null;
        }
      }

      setIsUploading(true);

      try {
        // Step 1: request presigned URL
        setProgress(10);
        const metaRes = await fetch('/api/storage/uploads/request-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace,
            name: file.name,
            size: file.size,
            contentType: file.type || 'application/octet-stream',
          }),
        });

        if (!metaRes.ok) {
          const data = await metaRes.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to get upload URL');
        }

        const result: UploadResult = await metaRes.json();
        setProgress(30);

        // Step 2: upload directly to GCS
        const uploadRes = await fetch(result.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload file to storage');
        }

        setProgress(100);
        onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Upload failed');
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [workspace, maxBytes, allowedTypes, onSuccess, onError],
  );

  return { uploadFile, isUploading, progress, error };
}
