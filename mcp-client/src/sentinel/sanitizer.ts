import { UntrustedMCPResult, InjectionFinding, SanitizationResult, RemovedSpanAudit } from './types.js';

export class TextSanitizer {
  public static readonly REMOVED_MARKER = '[UNTRUSTED INSTRUCTION REMOVED]';

  public static sanitize(untrusted: UntrustedMCPResult, findings: InjectionFinding[]): SanitizationResult {
    const sanitizedContent = structuredClone(untrusted.originalContent);
    const removedSpans: RemovedSpanAudit[] = [];

    // Group findings by path so we can process multiple spans in the same text block
    const findingsByPath = new Map<string, InjectionFinding[]>();
    for (const finding of findings) {
      if (!findingsByPath.has(finding.path)) {
        findingsByPath.set(finding.path, []);
      }
      findingsByPath.get(finding.path)!.push(finding);
    }

    let isQuarantined = false;

    for (const [path, pathFindings] of findingsByPath.entries()) {
      try {
        const originalText = this.getValueAtPath(sanitizedContent, path);
        if (typeof originalText !== 'string') continue;

        const newText = this.sanitizeText(originalText, pathFindings, removedSpans);
        this.setValueAtPath(sanitizedContent, path, newText);

        if (pathFindings.some(f => f.severity === 'critical')) {
          isQuarantined = true;
        } else if (pathFindings.some(f => f.severity === 'high')) {
          isQuarantined = true; // Mark as quarantined, but continue sanitization (as per HIGH policy)
        }
      } catch (err) {
        // Step 21: Error / Failure-Closed Behavior
        // If sanitization fails for a high-risk result, fail closed.
        if (pathFindings.some(f => f.severity === 'high' || f.severity === 'critical')) {
          console.error(`[SENTINEL] Sanitization failed at path ${path}. Failing closed.`);
          return {
            trust: 'SANITIZED',
            source: untrusted.source,
            serverId: untrusted.serverId,
            toolName: untrusted.toolName,
            isError: true,
            originalContent: untrusted.originalContent,
            sanitizedContent: { error: 'Security Policy Blocked: Sanitization failed on malicious content.' },
            isQuarantined: true,
            removedSpans
          };
        }
      }
    }

    return {
      trust: 'SANITIZED',
      source: untrusted.source,
      serverId: untrusted.serverId,
      toolName: untrusted.toolName,
      isError: untrusted.isError,
      originalContent: untrusted.originalContent,
      sanitizedContent,
      isQuarantined,
      removedSpans
    };
  }

  private static sanitizeText(originalText: string, findings: InjectionFinding[], audit: RemovedSpanAudit[]): string {
    // We want to identify the bounds for each finding, then merge overlapping bounds, then replace them.
    const boundsToReplace: { start: number, end: number, ruleIds: string[], categories: string[] }[] = [];

    for (const finding of findings) {
      for (const indicator of finding.indicators) {
        const span = this.findOriginalSpan(originalText, indicator.matchedText);
        if (span) {
          const expanded = this.expandToBlockBoundaries(originalText, span.start, span.end);
          boundsToReplace.push({ 
            start: expanded.start, 
            end: expanded.end, 
            ruleIds: [indicator.ruleId], 
            categories: [indicator.category] 
          });
        }
      }
    }

    if (boundsToReplace.length === 0) return originalText;

    // Merge overlapping bounds
    boundsToReplace.sort((a, b) => a.start - b.start);
    const mergedBounds = [boundsToReplace[0]];
    for (let i = 1; i < boundsToReplace.length; i++) {
      const last = mergedBounds[mergedBounds.length - 1];
      const current = boundsToReplace[i];
      if (current.start <= last.end + 1) { // overlap or adjacent
        last.end = Math.max(last.end, current.end);
        current.ruleIds.forEach(r => { if (!last.ruleIds.includes(r)) last.ruleIds.push(r); });
        current.categories.forEach(c => { if (!last.categories.includes(c)) last.categories.push(c); });
      } else {
        mergedBounds.push(current);
      }
    }

    // Replace from back to front to preserve indices
    let sanitizedText = originalText;
    for (let i = mergedBounds.length - 1; i >= 0; i--) {
      const bound = mergedBounds[i];
      
      // Keep newline at the end if we expanded to it, to preserve formatting?
      // Just replacing the block with marker is sufficient
      const removedText = sanitizedText.substring(bound.start, bound.end);
      
      sanitizedText = sanitizedText.substring(0, bound.start) + this.REMOVED_MARKER + sanitizedText.substring(bound.end);

      audit.push({
        ruleId: bound.ruleIds.join(','),
        category: bound.categories.join(','),
        path: findings[0].path, // path is the same for all in this block
        blockIndex: findings[0].blockIndex,
        removedTextLength: removedText.length,
        replacementMarker: this.REMOVED_MARKER
      });
    }

    return sanitizedText;
  }

  public static findOriginalSpan(originalText: string, normalizedMatch: string): { start: number, end: number } | null {
    const words = normalizedMatch.trim().split(/\s+/).filter(w => w.length > 0).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (words.length === 0) return null;
    
    // Construct a flexible regex that allows punctuation, whitespace, newlines, Markdown, HTML between words
    // We limit the gap to 200 chars to avoid catastrophic backtracking or matching across massive unrelated spans
    const gap = '[\\s\\S]{0,200}?';
    const regexPattern = words.join(gap);
    try {
      const regex = new RegExp(regexPattern, 'i');
      const match = regex.exec(originalText);
      if (match) {
        return { start: match.index, end: match.index + match[0].length };
      }
    } catch (e) {
      // Ignore complex regex errors
    }
    return null;
  }

  private static expandToBlockBoundaries(text: string, start: number, end: number): { start: number, end: number } {
    // Step 5: Remove the COMPLETE malicious instruction span.
    // We expand the matched bounding box to encompass the entire line(s) it touches.
    // If it's a Markdown paragraph (surrounded by \n\n), expanding to lines effectively removes the block.

    let lineStart = text.lastIndexOf('\n', start);
    if (lineStart === -1) {
      lineStart = 0;
    } else {
      lineStart += 1; // Start after the newline
    }

    let lineEnd = text.indexOf('\n', end);
    if (lineEnd === -1) {
      lineEnd = text.length;
    }

    return { start: lineStart, end: lineEnd };
  }

  private static getValueAtPath(obj: any, path: string): any {
    if (!path || path === 'root') return obj;
    const parts = this.parsePath(path);
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  private static setValueAtPath(obj: any, path: string, value: any): void {
    if (!path || path === 'root') throw new Error('Cannot set root path');
    const parts = this.parsePath(path);
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
      if (current === null || current === undefined) throw new Error('Path not found');
    }
    current[parts[parts.length - 1]] = value;
  }

  private static parsePath(path: string): (string | number)[] {
    const parts: (string | number)[] = [];
    const segments = path.split('.');
    for (const segment of segments) {
      const arrayMatch = segment.match(/^([^\[]+)?(?:\[(\d+)\])?$/);
      if (arrayMatch) {
        if (arrayMatch[1]) parts.push(arrayMatch[1]);
        if (arrayMatch[2]) parts.push(parseInt(arrayMatch[2], 10));
      } else {
        parts.push(segment);
      }
    }
    return parts;
  }
}
