import crypto from 'crypto';
import { AuditLogEntry, AuditStatus } from '@don/shared';
import { db } from '../db/index.js';

export interface AuditRecordInput extends Omit<AuditLogEntry, 'id' | 'createdAt' | 'deviceType'> {
  deviceType?: string;
}

export class AuditService {
  record(entry: AuditRecordInput): AuditLogEntry {
    const log: AuditLogEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      deviceType: entry.deviceType || 'WEB',
      ...entry,
    };
    db.auditLogs.unshift(log); // Prepend to show most recent first
    return log;
  }

  getLogs(userId: string, limit = 50): AuditLogEntry[] {
    return db.auditLogs.filter((l) => l.userId === userId).slice(0, limit);
  }
}

export const auditService = new AuditService();
