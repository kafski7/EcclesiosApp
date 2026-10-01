import { Controller, Get, Param, Req } from "@nestjs/common";
import type { GroupAccessResponse } from "@ecclesios/shared";
import { canApprove, canReadAggregates, canReadRecords, canReadSummaries, canWrite, type Access } from "@ecclesios/shared/domain";
import type { Request } from "express";
import { Scope } from "./scope";

/**
 * GET /api/groups/:groupId/access — what the caller may do in a group.
 * Used by the CMS context switcher (functionality §4.13) and as the reference @Scope route.
 */
@Controller("groups")
export class GroupsController {
  @Get(":groupId/access")
  @Scope({ need: "readAggregates" })
  access(@Param("groupId") groupId: string, @Req() req: Request & { access?: Access }): GroupAccessResponse {
    const a = req.access ?? "NONE";
    return {
      groupId,
      access: a,
      can: {
        write: canWrite(a),
        approve: canApprove(a),
        readRecords: canReadRecords(a),
        readSummaries: canReadSummaries(a),
        readAggregates: canReadAggregates(a),
      },
    };
  }
}
