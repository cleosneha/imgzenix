# MCP Implementation Guide - Condensed

Integrates Model Context Protocol into Express backend. MCP is part of backend (not standalone). Tools wrap services. User-scoped via API key. In-memory sessions.

---

## Directory Structure

```
backend/src/mcp/hosted/
├── types.ts              # SessionEntry type
├── auth.ts              # API key auth
├── sessions.ts          # Session Map
├── tool-helpers.ts      # Error handling
├── routes.ts            # MCP HTTP endpoints
└── tools/
    ├── index.ts         # Server builder
    ├── helpers.ts       # Resolver utilities
    ├── folder.ts        # Folder tools
    └── image.ts         # Image tools
```

---

## File 1: Types (`types.ts`)

```typescript
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  userId: string;
};
```

---

## File 2: Auth (`auth.ts`)

Extracts and validates API keys.

```typescript
import type { Request } from "express";
import { extractApiKeyFromRequest } from "../../utils/api-key.js";
import { resolveUserByApiKeyService } from "../../services/api-key.service.js";

export const getUserFromApiKey = async (req: Request) => {
  const rawApiKey = extractApiKeyFromRequest(req);
  if (!rawApiKey) throw new Error("Unauthorized: API key is required");

  const { user } = await resolveUserByApiKeyService({ rawApiKey });
  return { user, rawApiKey };
};
```

---

## File 3: Sessions (`sessions.ts`)

In-memory session storage.

```typescript
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SessionEntry } from "./types.js";

const sessions = new Map<string, SessionEntry>();

export const getSessionCount = () => sessions.size;
export const getSessionById = (sessionId: string) => sessions.get(sessionId);

export const createSessionTransport = ({
  userId,
  server,
}: {
  userId: string;
  server: McpServer;
}) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (generatedSessionId) => {
      sessions.set(generatedSessionId, { transport, server, userId });
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
    void server.close();
  };

  return transport;
};
```

---

## File 4: Tool Helpers (`tool-helpers.ts`)

Error handling and response formatting.

```typescript
import type { Response } from "express";

export const toToolSuccess = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

export const toToolError = (error: unknown) => ({
  isError: true,
  content: [{
    type: "text" as const,
    text: `Tool failed: ${error instanceof Error ? error.message : "Unexpected error"}`,
  }],
});

export const handleTool = async <T>(run: () => Promise<T>) => {
  try {
    return toToolSuccess(await run());
  } catch (error) {
    return toToolError(error);
  }
};

export const writeJsonRpcError = (
  res: Response,
  statusCode: number,
  message: string,
) => {
  res.status(statusCode).json({
    jsonrpc: "2.0",
    error: { code: -32000, message },
    id: null,
  });
};
```

---

## File 5: Tool Helpers (`tools/helpers.ts`)

Resolve folder IDs from names.

```typescript
import { resolveFolderByNameService } from "../../../services/folder.service.js";

export const resolveFolderIdForUser = async ({
  userId,
  folderId,
  folderName,
  parentId,
}: {
  userId: string;
  folderId?: string;
  folderName?: string;
  parentId?: string;
}): Promise<string> => {
  if (folderId?.trim()) return folderId;

  const folder = await resolveFolderByNameService({
    userId,
    name: folderName ?? "",
    parentId,
  });

  if (!folder?._id) throw new Error("Failed to resolve folder by name");
  return String(folder._id);
};
```

---

## File 6: Folder Tools (`tools/folder.ts`)

Register folder operations as tools.

```typescript
import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createFolderService,
  deleteFolderByNameService,
  deleteFolderService,
  getFolderContentService,
  getFoldersService,
} from "../../../services/folder.service.js";
import { handleTool } from "../tool-helpers.js";
import { resolveFolderIdForUser } from "./helpers.js";

export const registerFolderTools = (server: McpServer, userId: string) => {
  server.registerTool(
    "createFolder",
    {
      description: "Create a folder",
      inputSchema: {
        name: z.string().min(1).max(120),
        parentId: z.string().optional(),
      },
    },
    ({ name, parentId }) =>
      handleTool(() => createFolderService({ userId, name, parentId })),
  );

  server.registerTool(
    "getFolderContent",
    {
      description: "Get folders and images in a folder",
      inputSchema: {
        folderId: z.string().optional(),
        folderName: z.string().optional(),
        parentId: z.string().optional(),
      },
    },
    async ({ folderId, folderName, parentId }) =>
      handleTool(async () => {
        const resolvedId = await resolveFolderIdForUser({
          userId,
          folderId,
          folderName,
          parentId,
        });
        return getFolderContentService({ userId, folderId: resolvedId });
      }),
  );

  server.registerTool(
    "listFolders",
    {
      description: "List folders",
      inputSchema: {
        parentId: z.string().optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    ({ parentId, page, limit }) =>
      handleTool(() => getFoldersService({ userId, parentId, page, limit })),
  );

  server.registerTool(
    "deleteFolder",
    {
      description: "Delete folder by id or name",
      inputSchema: {
        folderId: z.string().optional(),
        folderName: z.string().optional(),
        parentId: z.string().optional(),
      },
    },
    async ({ folderId, folderName, parentId }) =>
      handleTool(async () => {
        return folderId?.trim()
          ? await deleteFolderService({ userId, folderId })
          : await deleteFolderByNameService({
              userId,
              name: folderName ?? "",
              parentId,
            });
      }),
  );
};
```

---

## File 7: Image Tools (`tools/image.ts`)

Register image operations as tools.

```typescript
import * as z from "zod/v4";
import { basename } from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  deleteImageByNameService,
  deleteImageService,
  getImagesByFolderService,
  resolveImageByNameService,
  uploadImageBufferService,
  uploadImageFromUrlService,
} from "../../../services/image.service.js";
import { handleTool } from "../tool-helpers.js";
import { resolveFolderIdForUser } from "./helpers.js";

const maxBytes = Number(process.env.MCP_IMAGE_MAX_BYTES) || 10 * 1024 * 1024;

const normalizePath = (input: string): string => {
  let path = input.trim();
  if ((path.startsWith('"') && path.endsWith('"')) ||
      (path.startsWith("'") && path.endsWith("'"))) {
    path = path.slice(1, -1).trim();
  }
  if (path.toLowerCase().startsWith("file://")) {
    try { path = fileURLToPath(path); } catch {}
  }
  return path;
};

export const registerImageTools = (server: McpServer, userId: string) => {
  server.registerTool(
    "listImages",
    {
      description: "List images in folder",
      inputSchema: {
        folderId: z.string().optional(),
        folderName: z.string().optional(),
        parentId: z.string().optional(),
      },
    },
    async ({ folderId, folderName, parentId }) =>
      handleTool(async () => {
        const resolvedId = await resolveFolderIdForUser({
          userId,
          folderId,
          folderName,
          parentId,
        });
        return getImagesByFolderService({ userId, folderId: resolvedId });
      }),
  );

  const uploadFromPath = async ({
    filePath,
    imageName,
    folderId,
    folderName,
    parentId,
  }: {
    filePath: string;
    imageName?: string;
    folderId?: string;
    folderName?: string;
    parentId?: string;
  }) =>
    handleTool(async () => {
      const path = normalizePath(filePath);
      const stats = await stat(path);

      if (!stats.isFile() || stats.size <= 0 || stats.size > maxBytes) {
        throw new Error("Invalid file");
      }

      const buffer = await readFile(path);
      const resolvedId = await resolveFolderIdForUser({
        userId,
        folderId,
        folderName,
        parentId,
      });

      return uploadImageBufferService({
        userId,
        folderId: resolvedId,
        fileBuffer: buffer,
        originalName: basename(path),
        imageName,
      });
    });

  server.registerTool("uploadImage", {
    description: "Upload image from file path",
    inputSchema: {
      filePath: z.string().min(1),
      imageName: z.string().optional(),
      folderId: z.string().optional(),
      folderName: z.string().optional(),
      parentId: z.string().optional(),
    },
  }, uploadFromPath);

  server.registerTool("uploadImageFromPath", {
    description: "Upload image from file path",
    inputSchema: {
      filePath: z.string().min(1),
      imageName: z.string().optional(),
      folderId: z.string().optional(),
      folderName: z.string().optional(),
      parentId: z.string().optional(),
    },
  }, uploadFromPath);

  server.registerTool(
    "uploadImageFromUrl",
    {
      description: "Upload image from URL",
      inputSchema: {
        imageUrl: z.string().url(),
        imageName: z.string().optional(),
        folderId: z.string().optional(),
        folderName: z.string().optional(),
        parentId: z.string().optional(),
      },
    },
    async ({ imageUrl, imageName, folderId, folderName, parentId }) =>
      handleTool(async () => {
        const resolvedId = await resolveFolderIdForUser({
          userId,
          folderId,
          folderName,
          parentId,
        });
        return uploadImageFromUrlService({
          userId,
          folderId: resolvedId,
          imageUrl,
          imageName,
        });
      }),
  );

  server.registerTool(
    "deleteImage",
    {
      description: "Delete image by id or name",
      inputSchema: {
        imageId: z.string().optional(),
        imageName: z.string().optional(),
        folderId: z.string().optional(),
        folderName: z.string().optional(),
        parentId: z.string().optional(),
      },
    },
    async ({ imageId, imageName, folderId, folderName, parentId }) =>
      handleTool(async () => {
        if (imageId?.trim()) {
          return await deleteImageService({ userId, imageId });
        }
        let scopedId = folderId;
        if (!scopedId && folderName?.trim()) {
          scopedId = await resolveFolderIdForUser({
            userId,
            folderName,
            parentId,
          });
        }
        return await deleteImageByNameService({
          userId,
          imageName: imageName ?? "",
          folderId: scopedId,
        });
      }),
  );

  server.registerTool(
    "resolveImageByName",
    {
      description: "Resolve image by name",
      inputSchema: {
        imageName: z.string().min(1),
        folderId: z.string().optional(),
        folderName: z.string().optional(),
        parentId: z.string().optional(),
      },
    },
    async ({ imageName, folderId, folderName, parentId }) =>
      handleTool(async () => {
        let scopedId = folderId;
        if (!scopedId && folderName?.trim()) {
          scopedId = await resolveFolderIdForUser({
            userId,
            folderName,
            parentId,
          });
        }
        return resolveImageByNameService({
          userId,
          imageName,
          folderId: scopedId,
        });
      }),
  );
};
```

---

## File 8: Server Builder (`tools/index.ts`)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerFolderTools } from "./folder.js";
import { registerImageTools } from "./image.js";

export const buildUserScopedMcpServer = ({
  userId,
}: {
  userId: string;
}): McpServer => {
  const server = new McpServer({
    name: "imgzenix-hosted-mcp",
    version: "1.0.0",
  });

  registerFolderTools(server, userId);
  registerImageTools(server, userId);

  return server;
};

export { registerFolderTools } from "./folder.js";
export { registerImageTools } from "./image.js";
export { resolveFolderIdForUser } from "./helpers.js";
```

---

## File 9: Routes (`routes.ts`)

Handle MCP HTTP requests.

```typescript
import type { Express } from "express";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { getUserFromApiKey } from "./auth.js";
import {
  createSessionTransport,
  getSessionById,
  getSessionCount,
} from "./sessions.js";
import { buildUserScopedMcpServer } from "./tools/index.js";
import { writeJsonRpcError } from "./tool-helpers.js";

export const registerHostedMcpRoutes = (app: Express) => {
  app.get("/mcp/health", (_req, res) => {
    res.status(200).json({ ok: true, sessions: getSessionCount() });
  });

  app.post("/mcp", async (req, res) => {
    try {
      const { user } = await getUserFromApiKey(req);
      const userId = String(user._id);

      const sessionId =
        typeof req.headers["mcp-session-id"] === "string"
          ? req.headers["mcp-session-id"]
          : undefined;

      if (sessionId) {
        const session = getSessionById(sessionId);
        if (!session || session.userId !== userId) {
          writeJsonRpcError(res, 403, "Invalid session");
          return;
        }
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!isInitializeRequest(req.body)) {
        writeJsonRpcError(res, 400, "Send initialize request first");
        return;
      }

      const server = buildUserScopedMcpServer({ userId });
      const transport = createSessionTransport({ userId, server });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Server error";
      if (!res.headersSent) {
        writeJsonRpcError(
          res,
          msg.includes("Unauthorized") ? 401 : 500,
          msg
        );
      }
    }
  });
};
```

---

## File 10: Express Integration (`src/app.ts`)

Update your existing app.ts:

```typescript
import { registerHostedMcpRoutes } from "./mcp/hosted/routes.js";

// In CORS config, add header:
allowedHeaders: [..., "MCP-Session-Id", ...],

// Add body parser for MCP:
app.use("/mcp", express.json({ limit: "15mb" }));

// After regular routes:
registerHostedMcpRoutes(app);
```

---

## Key Concepts

**Tool Registration:**
```typescript
server.registerTool(name, { description, inputSchema }, handler);
```

**Pattern:** Each tool wraps a service call + error handling via `handleTool()`.

**Session Flow:**
1. Initialize request → Create server + session
2. Subsequent requests → Route to same session via `mcp-session-id` header
3. Close → Session cleaned from memory

**User Scoping:** All tools receive `userId`, verify ownership in service layer.

---

## Testing

```bash
# Health check
curl http://localhost:5000/mcp/health

# Initialize
curl -X POST http://localhost:5000/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
```

---

## For Your Friend

1. Identify your resources (folders/images or whatever you manage)
2. List CRUD operations for each
3. Create tool registration files per resource
4. Adapt auth if your API key extraction differs
5. Follow tool registration pattern for each operation
6. Integrate routes into Express app
