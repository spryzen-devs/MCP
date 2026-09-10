import { createHash } from 'node:crypto';
import type { ToolManifest } from './types.js';

/**
 * Recursively orders keys of an object to ensure deterministic JSON serialization.
 * Equivalent manifests with different key orderings, whitespace, or formatting
 * will always produce the same canonical representation.
 */
export function canonicalize(obj: unknown): unknown {
  if (typeof obj === 'undefined') {
    throw new TypeError('Unsupported value: undefined');
  }
  if (typeof obj === 'function') {
    throw new TypeError('Unsupported value: function');
  }
  if (typeof obj === 'symbol') {
    throw new TypeError('Unsupported value: symbol');
  }
  if (typeof obj === 'bigint') {
    throw new TypeError('Unsupported value: bigint');
  }

  if (typeof obj === 'number') {
    if (Number.isNaN(obj) || !Number.isFinite(obj)) {
      throw new TypeError('Unsupported value: NaN or Infinity');
    }
    return obj;
  }

  if (obj === null || typeof obj === 'string' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }

  if (typeof obj === 'object') {
    const toString = Object.prototype.toString.call(obj);
    if (toString !== '[object Object]') {
      throw new TypeError(`Unsupported object type: ${toString}`);
    }

    const sortedKeys = Object.keys(obj).sort();
    const result: Record<string, unknown> = {};

    for (const key of sortedKeys) {
      const val = (obj as Record<string, unknown>)[key];
      result[key] = canonicalize(val);
    }

    return result;
  }

  throw new TypeError(`Unsupported value type: ${typeof obj}`);
}

/**
 * Returns a SHA-256 fingerprint for the deterministically serialized tool manifest.
 * The same logical manifest will always produce the same hash regardless of
 * JSON key ordering or formatting differences.
 */
export function hashManifest(manifest: ToolManifest): string {
  const canonicalString = JSON.stringify(canonicalize(manifest));
  return createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Returns a SHA-256 fingerprint for the entire server manifest (all tools combined).
 */
export function hashServerManifests(manifests: ToolManifest[]): string {
  // Sort tools by name to ensure deterministic order regardless of how the server lists them
  const sortedManifests = [...manifests].sort((a, b) => a.tool.localeCompare(b.tool));
  const canonicalString = JSON.stringify(canonicalize(sortedManifests));
  return createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Converts a raw MCP tool object into a strictly typed ToolManifest.
 */
export function toToolManifest(serverName: string, tool: { name: string; description?: string; inputSchema?: unknown }): ToolManifest {
  return {
    server: serverName,
    tool: tool.name,
    name: tool.name,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema ? structuredClone(tool.inputSchema) : {}
  };
}
