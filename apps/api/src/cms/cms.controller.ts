import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import type { CmsContextsResponse, CmsDashboard, Principal } from "@ecclesios/shared";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Scope } from "../rbac/scope";
import { RequiresSubscription } from "../subscriptions/requires-subscription";
import { CmsService } from "./cms.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});

function personId(p: Principal | undefined) {
  if (p?.kind !== "member")
    throw new DomainError(
      403,
      "FORBIDDEN",
      "Church Management is for church accounts. Use the platform console.",
    );
  return p.id;
}

/** Church Management (CMS) endpoints — functionality §4. */
@Controller("cms")
export class CmsController {
  constructor(private readonly cms: CmsService) {}

  /** GET /api/cms/contexts — churches the caller manages, with subscription state (drives the switcher). */
  @Get("contexts")
  contexts(@CurrentPrincipal() p: Principal | undefined): Promise<CmsContextsResponse> {
    return this.cms.contexts(personId(p));
  }

  /** GET /api/cms/groups/:groupId/dashboard — reference route for scope + subscription gate. */
  @Get("groups/:groupId/dashboard")
  @Scope({ need: ["readAggregates", "memberContent"] }) // leaders get their own view (D-039)
  @RequiresSubscription()
  dashboard(
    @Param("groupId", uuid) groupId: string,
    @CurrentPrincipal() p: Principal | undefined,
  ): Promise<CmsDashboard> {
    return this.cms.dashboard(personId(p), groupId);
  }
}
