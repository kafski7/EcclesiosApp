import { Body, Controller, Get, HttpCode, Post, Query, Req } from "@nestjs/common";
import {
  ChurchSearchQuerySchema,
  RegisterRequestSchema,
  type ChurchSearchResponse,
  type RegisterResponse,
} from "@ecclesios/shared";
import type { Request } from "express";
import type { z } from "zod";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { RegistrationService } from "./registration.service";

/** Public sign-up endpoints (functionality §2.4). */
@Public()
@Controller()
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  /** GET /api/public/churches?q=the — parish/outstation picker on the sign-up and join screens. */
  @Get("public/churches")
  async churches(
    @Query(new ZodPipe(ChurchSearchQuerySchema)) query: z.output<typeof ChurchSearchQuerySchema>,
  ): Promise<ChurchSearchResponse> {
    return { items: await this.registration.searchChurches(query.q) };
  }

  /** POST /api/auth/register — creates the person + a PENDING home membership request. */
  @Post("auth/register")
  @HttpCode(201)
  register(
    @Body(new ZodPipe(RegisterRequestSchema)) body: z.output<typeof RegisterRequestSchema>,
    @Req() req: Request,
  ): Promise<RegisterResponse> {
    return this.registration.register(body, req.ip ?? req.socket.remoteAddress ?? "unknown");
  }
}
