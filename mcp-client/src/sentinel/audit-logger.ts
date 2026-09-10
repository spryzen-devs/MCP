import type { AuditLogEntry, AuditEventType } from './types.js';

/**
 * Immutable-style security audit logger.
 * 
 * Records all security-relevant events with timestamps.
 * Events are append-only — once recorded, they cannot be modified or deleted.
 */
export class AuditLogger {
  private log: AuditLogEntry[] = [];

  /**
   * Records a new audit event.
   */
  record(
    event: AuditEventType,
    server: string,
    tool?: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      event,
      server,
      tool,
      details
    };

    this.log.push(entry);
    
    // Console output for server-side observability
    const toolStr = tool ? ` / ${tool}` : '';
    console.log(`[SENTINEL AUDIT] [${this.formatTime(entry.timestamp)}] ${event} — ${server}${toolStr}`);

    return entry;
  }

  /**
   * Returns the full audit log (read-only snapshot).
   */
  getAll(): AuditLogEntry[] {
    return structuredClone(this.log);
  }

  /**
   * Returns audit entries filtered by event type.
   */
  getByEvent(event: AuditEventType): AuditLogEntry[] {
    return this.log.filter(e => e.event === event);
  }

  /**
   * Returns audit entries for a specific server.
   */
  getByServer(server: string): AuditLogEntry[] {
    return this.log.filter(e => e.server === server);
  }

  /**
   * Returns the count of all recorded events.
   */
  get count(): number {
    return this.log.length;
  }

  /**
   * Clears the audit log (for testing/simulation reset only).
   */
  clear(): void {
    this.log = [];
  }

  private formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false });
  }
}
