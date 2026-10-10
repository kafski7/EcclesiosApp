import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import {
  AddMemberSchema,
  AttachPhotoSchema,
  BirthdaysQuerySchema,
  ChangeRoleSchema,
  PersonDetailsSchema,
  PhotoUploadSchema,
  RegisterQuerySchema,
  RemoveMemberSchema,
  type Principal,
} from "@ecclesios/shared";
import { toIsoDate } from "@ecclesios/shared/domain";
import type { Request } from "express";
import { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { Scope } from "../rbac/scope";
import { RequiresSubscription } from "../subscriptions/requires-subscription";
import { RegisterService } from "./register.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const ip = (req: Request) => req.ip ?? "unknown";
const me = (p: Principal | undefined) => p!.id; // the scope guard already rejected non-members

/**
 * Church register (functionality §4.2–4.3, D-037). Reading needs the church's records
 * (its staff, or the parish for an outstation); writing needs staff of this church.
 */
@Controller("cms/groups/:groupId")
export class RegisterController {
  constructor(private readonly register: RegisterService) {}

  @Get("members")
  @Scope({ need: "readRecords" })
  @RequiresSubscription()
  list(
    @Param("groupId", uuid) groupId: string,
    @Query(new ZodPipe(RegisterQuerySchema)) q: z.output<typeof RegisterQuerySchema>,
  ) {
    return this.register.list(groupId, q);
  }

  @Get("members.csv")
  @Scope({ need: "readRecords" })
  @RequiresSubscription()
  @Header("content-type", "text/csv; charset=utf-8")
  @Header("content-disposition", 'attachment; filename="members.csv"')
  csv(
    @Param("groupId", uuid) groupId: string,
    @Query(new ZodPipe(RegisterQuerySchema)) q: z.output<typeof RegisterQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.register.csv(groupId, q, me(p), ip(req));
  }

  @Post("members")
  @HttpCode(201)
  @Scope({ need: "write" })
  @RequiresSubscription()
  add(
    @Param("groupId", uuid) groupId: string,
    @Body(new ZodPipe(AddMemberSchema)) b: z.output<typeof AddMemberSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.register.add(me(p), groupId, b, ip(req));
  }

  @Get("members/:personId")
  @Scope({ need: "readRecords" })
  @RequiresSubscription()
  profile(
    @Param("groupId", uuid) groupId: string,
    @Param("personId", uuid) personId: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.register.profile(me(p), groupId, personId);
  }

  /** Home-church rule is checked in the service (D-016). */
  @Put("members/:personId")
  @Scope({ need: "readRecords" })
  @RequiresSubscription()
  update(
    @Param("groupId", uuid) groupId: string,
    @Param("personId", uuid) personId: string,
    @Body(new ZodPipe(PersonDetailsSchema)) b: z.output<typeof PersonDetailsSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.register.update(me(p), groupId, personId, b, ip(req));
  }

  @Post("members/:personId/photo-upload")
  @HttpCode(201)
  @Scope({ need: "readRecords" })
  @RequiresSubscription()
  photoUpload(
    @Param("groupId", uuid) groupId: string,
    @Param("personId", uuid) personId: string,
    @Body(new ZodPipe(PhotoUploadSchema)) b: z.output<typeof PhotoUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.register.presignPhoto(me(p), groupId, personId, b.contentType, b.bytes);
  }

  @Put("members/:personId/photo")
  @Scope({ need: "readRecords" })
  @RequiresSubscription()
  photo(
    @Param("groupId", uuid) groupId: string,
    @Param("personId", uuid) personId: string,
    @Body(new ZodPipe(AttachPhotoSchema)) b: z.output<typeof AttachPhotoSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.register.setPhoto(me(p), groupId, personId, b.key, ip(req));
  }

  @Put("members/:personId/role")
  @Scope({ need: "write" })
  @RequiresSubscription()
  role(
    @Param("groupId", uuid) groupId: string,
    @Param("personId", uuid) personId: string,
    @Body(new ZodPipe(ChangeRoleSchema)) b: z.output<typeof ChangeRoleSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.register.changeRole(me(p), groupId, personId, b.role, ip(req));
  }

  @Post("members/:personId/remove")
  @HttpCode(204)
  @Scope({ need: "write" })
  @RequiresSubscription()
  async remove(
    @Param("groupId", uuid) groupId: string,
    @Param("personId", uuid) personId: string,
    @Body(new ZodPipe(RemoveMemberSchema)) b: z.output<typeof RemoveMemberSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.register.remove(me(p), groupId, personId, b.reason, ip(req));
  }

  @Get("birthdays")
  @Scope({ need: "readRecords" })
  @RequiresSubscription()
  birthdays(
    @Param("groupId", uuid) groupId: string,
    @Query(new ZodPipe(BirthdaysQuerySchema.extend({ outstations: z.enum(["1"]).optional() })))
    q: z.output<typeof BirthdaysQuerySchema> & { outstations?: "1" },
  ) {
    return this.register.birthdays(
      groupId,
      q.days,
      q.today ?? toIsoDate(new Date()),
      q.outstations === "1",
    );
  }
}
