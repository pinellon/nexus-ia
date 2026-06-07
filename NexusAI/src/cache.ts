import * as fs from 'fs';
import * as path from 'path';

interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
}

export class FileCache {
  private maxSize: number;
  private cacheDir: string;
  private indexPath: string;
  private index: Record<string, CacheEntry> = {};

  constructor(options: { cacheDir: string; maxSize?: number }) {
    this.cacheDir = options.cacheDir;
    this.maxSize = options.maxSize ?? 1000; // max entries
    this.indexPath = path.join(this.cacheDir, 'index.json');
    this.ensureCacheDir();
    this.loadIndex();
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private loadIndex() {
    if (fs.existsSync(this.indexPath)) {
      try {
        const raw = fs.readFileSync(this.indexPath, 'utf-8');
        this.index = JSON.parse(raw);
      } catch (e) {
        // Corrupted index – start fresh
        this.index = {};
      }
    }
  }

  private saveIndex() {
    fs.writeFileSync(this.indexPath, JSON.stringify(this.index, null, 2), 'utf-8');
  }

  private pruneIfNeeded() {
    const keys = Object.keys(this.index);
    if (keys.length <= this.maxSize) return;
    // Sort by oldest timestamp
    const sorted = keys.sort((a, b) => this.index[a].timestamp - this.index[b].timestamp);
    const excess = sorted.length - this.maxSize;
    for (let i = 0; i < excess; i++) {
      const oldKey = sorted[i];
      const filePath = path.join(this.cacheDir, `${oldKey}.json`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      delete this.index[oldKey];
    }
    this.saveIndex();
  }

  public get(key: string): any | undefined {
    const entry = this.index[key];
    if (!entry) return undefined;
    // Refresh timestamp
    entry.timestamp = Date.now();
    this.saveIndex();
    const filePath = path.join(this.cacheDir, `${key}.json`);
    if (!fs.existsSync(filePath)) return undefined;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  }

  public set(key: string, value: any): void {
    const filePath = path.join(this.cacheDir, `${key}.json`);
    fs.writeFileSync(filePath, JSON.stringify(value), 'utf-8');
    this.index[key] = { key, value: null, timestamp: Date.now() };
    this.pruneIfNeeded();
    this.saveIndex();
  }
}
