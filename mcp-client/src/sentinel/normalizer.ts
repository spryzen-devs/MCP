import { ExtractedText, NormalizedText } from './types.js';

export class TextNormalizer {
  
  /**
   * Normalizes extracted text for security analysis (e.g. anti-evasion matching).
   * Generates a separate NormalizedText object, ensuring the original text is preserved byte-for-byte.
   */
  public static normalize(extracted: ExtractedText): NormalizedText {
    let norm = extracted.text;

    // 1. Unicode Normalization (composed forms, etc.)
    norm = norm.normalize('NFKC');

    // 2. Case Normalization
    norm = norm.toLowerCase();

    // 3. Basic HTML Wrapper Stripping
    // Replaces simple HTML tags with a space to prevent false word concatenation
    norm = norm.replace(/<\/?(?:p|strong|div|b|i|em|h[1-6]|span|a|ul|ol|li|code|pre)[^>]*>/g, ' ');

    // 4. Basic Markdown Wrapper Stripping
    // Bold/Italic
    norm = norm.replace(/\*{1,2}|_{1,2}/g, ' ');
    // Headers (start of line)
    norm = norm.replace(/^#+\s/gm, ' ');
    // Quotes (start of line)
    norm = norm.replace(/^>\s/gm, ' ');
    // Inline code
    norm = norm.replace(/`/g, ' ');

    // 5. Punctuation Normalization
    // Replace multiple dots (e.g., "Ignore... all") with a space
    norm = norm.replace(/\.{2,}/g, ' ');
    // Replace other common punctuation with a space, but preserve single dots, slashes, colons for URLs
    norm = norm.replace(/[!?;"'()\[\]{}]+/g, ' ');

    // 6. Whitespace Normalization
    // Replace any sequence of whitespace (spaces, tabs, newlines, unicode spaces) with a single space
    norm = norm.replace(/\s+/g, ' ').trim();

    return {
      originalText: extracted.text,
      normalizedText: norm,
      serverId: extracted.serverId,
      toolName: extracted.toolName,
      source: extracted.source,
      path: extracted.path,
      blockIndex: extracted.blockIndex
    };
  }

  /**
   * Normalizes an array of ExtractedText items.
   */
  public static normalizeAll(extractedItems: ExtractedText[]): NormalizedText[] {
    return extractedItems.map(item => this.normalize(item));
  }
}
