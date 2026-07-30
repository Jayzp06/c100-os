import { Readable } from 'stream';
import { z } from 'zod';
import { Router, type IRouter, type Response } from 'express';
import { ObjectNotFoundError, ObjectStorageService } from '../lib/objectStorage';
import { requireAuth } from '../lib/c100';
import { resolveRbacContext, hasPermissionGroup } from '../lib/rbac';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// The upload presigned-URL TTL in seconds (must match objectStorage.ts getObjectEntityUploadURL ttlSec).
const UPLOAD_TTL_SEC = 900;

/**
 * Workspace slug → permissions required to upload/download objects in that workspace.
 *
 * Object paths are structured as `/objects/{workspace}/{uuid}`, so the workspace
 * name is embedded in the storage key stored in the database.  On every download
 * the server extracts the workspace from the path and checks that the caller
 * holds at least one of the listed permission groups — enforcing per-workspace
 * object-level authorization without a separate ACL-metadata round-trip.
 *
 * This satisfies the "workspace-bound authorization" requirement: a Treasurer
 * cannot read a Conduct file because their `/objects/finances/…` permission
 * does not cover paths under `/objects/conduct/…`.
 */
// WORKSPACE_PERMISSION_GATE controls READ access (downloads via GET /storage/objects/…).
// view_governance_documents lets parliamentarians and other readers download files.
const WORKSPACE_PERMISSION_GATE: Record<string, string[]> = {
  governance: ['manage_governance_documents', 'view_governance_documents'],
  secretary: ['manage_minutes'],
  finances: ['manage_finances'],
  historian: ['manage_archives'],
  conduct: ['manage_conduct_records'],
  procedure: ['manage_procedure_records'],
};

/**
 * Server-side upload policy per workspace.
 *
 * maxBytes  — hard cap on the Content-Length the caller declares (the GCS
 *             presigned URL enforces the same limit on the actual PUT).
 * allowedTypes — when set, the declared contentType must be one of these
 *              exact MIME strings.  Omit to allow any type.
 *
 * These checks run BEFORE a presigned URL is issued, so no bytes ever
 * reach storage for over-size or wrong-type uploads.
 */
const WORKSPACE_UPLOAD_POLICY: Record<
  string,
  { maxBytes: number; allowedTypes?: string[] }
> = {
  governance: {
    maxBytes: 20 * 1024 * 1024, // 20 MB
    allowedTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  secretary:  { maxBytes: 20 * 1024 * 1024 },
  finances:   { maxBytes: 20 * 1024 * 1024 },
  historian:  {
    maxBytes: 100 * 1024 * 1024, // 100 MB — photos/video
    allowedTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime',
      'application/pdf',
    ],
  },
  conduct:    { maxBytes: 20 * 1024 * 1024 },
  procedure:  { maxBytes: 20 * 1024 * 1024 },
};

/** Extract the workspace slug from a `/objects/{workspace}/{uuid}` path. */
function extractWorkspace(objectPath: string): string | null {
  // objectPath is like /objects/governance/some-uuid
  const match = objectPath.match(/^\/objects\/([^/]+)\//);
  return match ? match[1] : null;
}

// WORKSPACE_UPLOAD_PERMISSION_GATE controls WRITE access (upload URL requests).
// Upload requires the manage_ permission — view-only roles (e.g. parliamentarian
// with view_governance_documents) must not be able to introduce new files.
const WORKSPACE_UPLOAD_PERMISSION_GATE: Record<string, string[]> = {
  governance: ['manage_governance_documents'],
  secretary: ['manage_minutes'],
  finances: ['manage_finances'],
  historian: ['manage_archives'],
  conduct: ['manage_conduct_records'],
  procedure: ['manage_procedure_records'],
};

/** Returns true if the member may download from the given workspace. */
async function canAccessWorkspaceObject(
  memberId: number,
  workspace: string,
): Promise<boolean> {
  const requiredPerms = WORKSPACE_PERMISSION_GATE[workspace];
  if (!requiredPerms) return false; // unknown workspace → deny
  const ctx = await resolveRbacContext(memberId);
  return requiredPerms.some((slug) => hasPermissionGroup(ctx, slug));
}

/** Returns true if the member may upload to the given workspace. */
async function canUploadToWorkspace(
  memberId: number,
  workspace: string,
): Promise<boolean> {
  const requiredPerms = WORKSPACE_UPLOAD_PERMISSION_GATE[workspace];
  if (!requiredPerms) return false;
  const ctx = await resolveRbacContext(memberId);
  return requiredPerms.some((slug) => hasPermissionGroup(ctx, slug));
}

const RequestUploadUrlBody = z.object({
  name: z.string().min(1).max(300),
  size: z.number().int().positive(),
  contentType: z.string().min(1).max(200),
  /** Which officer workspace owns this file (e.g. "governance", "conduct"). */
  workspace: z.enum([
    'governance',
    'secretary',
    'finances',
    'historian',
    'conduct',
    'procedure',
  ]),
});

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned PUT URL for direct GCS upload.
 *
 * The caller must:
 *   1. Be authenticated.
 *   2. Hold at least one permission from WORKSPACE_PERMISSION_GATE[workspace].
 *
 * The workspace name is embedded in the resulting storage path so that every
 * future download can enforce the same permission check without a metadata lookup.
 */
router.post(
  '/storage/uploads/request-url',
  requireAuth(async (req: any, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields (name, size, contentType, workspace)' });
      return;
    }

    const { name, size, contentType, workspace } = parsed.data;

    if (!(await canUploadToWorkspace(req.member.id, workspace))) {
      res.status(403).json({ error: `Insufficient permissions for workspace: ${workspace}` });
      return;
    }

    // Enforce server-side size and MIME-type policy before issuing a URL.
    const policy = WORKSPACE_UPLOAD_POLICY[workspace];
    if (policy) {
      if (size > policy.maxBytes) {
        const limitMB = (policy.maxBytes / 1024 / 1024).toFixed(0);
        res.status(413).json({ error: `File too large. Maximum size for this workspace is ${limitMB} MB.` });
        return;
      }
      if (policy.allowedTypes && !policy.allowedTypes.includes(contentType)) {
        res.status(415).json({
          error: `File type not allowed for this workspace. Accepted types: ${policy.allowedTypes.join(', ')}`,
        });
        return;
      }
    }

    try {
      const uploadUrl = await objectStorageService.getObjectEntityUploadURL(workspace);
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
      const expiresAt = new Date(Date.now() + UPLOAD_TTL_SEC * 1000).toISOString();

      res.json({ uploadUrl, objectPath, expiresAt, metadata: { name, size, contentType } });
    } catch (error) {
      (req as any).log?.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }),
);

/**
 * GET /storage/public-objects/*
 * Serve public assets unconditionally from PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get('/storage/public-objects/*filePath', async (req: any, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join('/') : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value: string, key: string) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    (req as any).log?.error({ err: error }, 'Error serving public object');
    res.status(500).json({ error: 'Failed to serve public object' });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities from PRIVATE_OBJECT_DIR.
 *
 * Authorization: path-based workspace scoping.
 *   - Object paths are `/objects/{workspace}/{uuid}`.
 *   - The workspace extracted from the path is looked up in WORKSPACE_PERMISSION_GATE.
 *   - The caller must hold at least one of the listed permissions for that workspace.
 *   - Unknown workspace → 403 (safe default).
 *
 * This prevents cross-workspace file access: a Treasurer holding only
 * `manage_finances` cannot read a file stored under `/objects/conduct/…`.
 */
router.get(
  '/storage/objects/*path',
  requireAuth(async (req: any, res: Response) => {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;

    // Enforce per-workspace authorization before any I/O.
    const workspace = extractWorkspace(objectPath);
    if (!workspace) {
      res.status(403).json({ error: 'Object path does not specify a workspace' });
      return;
    }
    if (!(await canAccessWorkspaceObject(req.member.id, workspace))) {
      res.status(403).json({ error: `Insufficient permissions for workspace: ${workspace}` });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

      const response = await objectStorageService.downloadObject(objectFile);
      res.status(response.status);
      response.headers.forEach((value: string, key: string) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: 'Object not found' });
        return;
      }
      (req as any).log?.error({ err: error }, 'Error serving object');
      res.status(500).json({ error: 'Failed to serve object' });
    }
  }),
);

export default router;
