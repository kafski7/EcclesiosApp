import { Controller, Delete, Get, Param, ParseUUIDPipe, Put, Query } from "@nestjs/common";
import { EngageKindSchema, EngageQuerySchema, type Principal } from "@ecclesios/shared";
import type { EngageKind, ReactionType } from "@ecclesios/shared/domain";
import type { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { EngageService } from "./engage.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const kindPipe = new ZodPipe(EngageKindSchema);
const member = (p: Principal | undefined) => {
  if (p?.kind !== "member")
    throw new DomainError(
      403,
      "NOT_ALLOWED",
      "Sign in with your Ecclesios account to like and save.",
    );
  return p.id;
};

/** GET /api/public/engage?items=POST:<id>,… — counts for everyone; own state when signed in (D-035). */
@Public()
@Controller("public/engage")
export class EngagePublicController {
  constructor(private readonly engage: EngageService) {}

  @Get()
  async state(
    @Query(new ZodPipe(EngageQuerySchema)) q: z.output<typeof EngageQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return { items: await this.engage.state(q.items, p?.kind === "member" ? p.id : null) };
  }
}

/** Likes and saves (members, including those whose church hasn't approved them yet — D-015). */
@Controller("engage")
export class EngageController {
  constructor(private readonly engage: EngageService) {}

  @Get("saved")
  async saved(@CurrentPrincipal() p: Principal | undefined) {
    return { items: await this.engage.saved(member(p)) };
  }

  @Put(":kind/:id/like")
  like(
    @Param("kind", kindPipe) kind: EngageKind,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.set(p, kind, id, "LIKE", true);
  }

  @Delete(":kind/:id/like")
  unlike(
    @Param("kind", kindPipe) kind: EngageKind,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.set(p, kind, id, "LIKE", false);
  }

  @Put(":kind/:id/save")
  save(
    @Param("kind", kindPipe) kind: EngageKind,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.set(p, kind, id, "SAVE", true);
  }

  @Delete(":kind/:id/save")
  unsave(
    @Param("kind", kindPipe) kind: EngageKind,
    @Param("id", uuid) id: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.set(p, kind, id, "SAVE", false);
  }

  private set(
    p: Principal | undefined,
    kind: EngageKind,
    id: string,
    type: ReactionType,
    on: boolean,
  ) {
    return this.engage.set(member(p), kind, id, type, on);
  }
}
