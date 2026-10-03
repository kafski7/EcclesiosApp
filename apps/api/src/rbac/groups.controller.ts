import { Controller, Get, Param, Req } from "@nestjs/common";
import type { GroupAccessResponse } from "@ecclesios/shared";
import { CAPABILITIES, hasCapability, type Capability } from "@ecclesios/shared/domain";
import { Scope } from "./scope";
import type { ScopedRequest } from "./scope.guard";

/**
 * GET /api/groups/:groupId/access — what the caller may do in a church.
 * Used by the CMS context switcher (functionality §4.13) and as the reference @Scope route.
 * Any church-scoped access is enough to ask (staff monitoring or plain membership).
 */
@Controller("groups")
export class GroupsController {
  @Get(":groupId/access")
  @Scope({ need: "readAggregates" })
  access(@Param("groupId") groupId: string, @Req() req: ScopedRequest): GroupAccessResponse {
    return describe(groupId, req.access ?? []);
  }

  @Get(":groupId/member-access")
  @Scope({ need: "memberContent" })
  memberAccess(@Param("groupId") groupId: string, @Req() req: ScopedRequest): GroupAccessResponse {
    return describe(groupId, req.access ?? []);
  }
}

function describe(
  groupId: string,
  access: NonNullable<ScopedRequest["access"]>,
): GroupAccessResponse {
  const can = Object.fromEntries(
    (Object.keys(CAPABILITIES) as Capability[]).map((k) => [k, hasCapability(access, k)]),
  ) as GroupAccessResponse["can"];
  return { groupId, access, can };
}
