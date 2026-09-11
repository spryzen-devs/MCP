import { UntrustedMCPResult, ExtractedText } from './types.js';

export class TextExtractor {
  
  /**
   * Extracts all textual content from an UntrustedMCPResult, preserving provenance.
   * Does not modify or sanitize the original content.
   */
  public static extract(untrusted: UntrustedMCPResult): ExtractedText[] {
    const results: ExtractedText[] = [];
    const content = untrusted.originalContent;

    if (content === null || content === undefined) {
      return results;
    }

    if (typeof content === 'string') {
      if (content.trim() !== '') {
        results.push(this.createExtraction(untrusted, content, 'root'));
      }
      return results;
    }

    // Typical MCP SDK Result Shape: { content: [...] }
    if (typeof content === 'object' && Array.isArray(content.content)) {
      content.content.forEach((block: any, index: number) => {
        if (block === null || block === undefined) return;
        
        if (block.type === 'text' && typeof block.text === 'string') {
          results.push(this.createExtraction(untrusted, block.text, `content[${index}].text`, index));
        } else if (block.type === 'object' || typeof block === 'object') {
          // Recursively extract strings from structured data block
          this.extractRecursive(block, `content[${index}]`, untrusted, results, index);
        }
      });
      return results;
    }

    // Any other object shape
    if (typeof content === 'object') {
      this.extractRecursive(content, 'root', untrusted, results);
    }

    return results;
  }

  private static extractRecursive(
    obj: any,
    currentPath: string,
    untrusted: UntrustedMCPResult,
    results: ExtractedText[],
    blockIndex?: number
  ) {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'string') {
      results.push(this.createExtraction(untrusted, obj, currentPath, blockIndex));
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.extractRecursive(item, `${currentPath}[${index}]`, untrusted, results, blockIndex);
      });
      return;
    }

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        this.extractRecursive(value, `${currentPath}.${key}`, untrusted, results, blockIndex);
      }
    }
  }

  private static createExtraction(
    untrusted: UntrustedMCPResult,
    text: string,
    path: string,
    blockIndex?: number
  ): ExtractedText {
    return {
      text,
      serverId: untrusted.serverId,
      toolName: untrusted.toolName,
      source: untrusted.source,
      path,
      blockIndex
    };
  }
}
