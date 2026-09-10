import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TRUSTED_CODE_DIR = path.resolve(__dirname, '../../../data', 'trusted_code');

export class CodeVerifier {
  static ensureDir() {
    if (!fs.existsSync(TRUSTED_CODE_DIR)) {
      fs.mkdirSync(TRUSTED_CODE_DIR, { recursive: true });
    }
  }

  static getTrustedCodePath(serverId: string): string {
    return path.join(TRUSTED_CODE_DIR, `${serverId}.txt`);
  }

  static getCodeHash(filePath: string): string {
    const code = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  static getCodeContent(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  static saveTrustedCode(serverId: string, filePath: string): void {
    this.ensureDir();
    const code = fs.readFileSync(filePath, 'utf-8');
    fs.writeFileSync(this.getTrustedCodePath(serverId), code, 'utf-8');
  }

  static getTrustedCode(serverId: string): string | null {
    const p = this.getTrustedCodePath(serverId);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
    return null;
  }
}
