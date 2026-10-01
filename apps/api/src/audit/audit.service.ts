import { Inject, Injectable, Logger } from "@nestjs/common";
import { auditLogs } from "@ecclesios/db";
import type { AuditEntry, AuditSink } from "../auth/core/types";
import { DB, type Database } from "../db/db.module";

/** Append-only audit trail (functionality §6). Never breaks the request it records. */
@Injectable()
export class AuditService implements AuditSink {
  private readonly logger = new Logger(AuditService.name);
  constructor(@Inject(DB) private readonly db: Database) {}

  async write(e: AuditEntry): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        actorType: e.actorType,
        actorId: e.actorId ?? null,
        groupId: e.groupId ?? null,
        action: e.action,
        entityType: e.entityType ?? null,
        entityId: e.entityId ?? null,
        metadata: e.metadata ?? {},
        ip: e.ip ?? null,
      });
    } catch (err) {
      this.logger.error({ err, action: e.action }, "audit write failed");
    }
  }
}
