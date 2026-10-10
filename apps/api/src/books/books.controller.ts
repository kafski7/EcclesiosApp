import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import {
  AdminRefundSchema,
  AttachBookFileSchema,
  BookDecisionSchema,
  BookPriceSchema,
  BookQuerySchema,
  BookSettingsSchema,
  BookSlugSchema,
  BookStatusSchema,
  BookUploadSchema,
  ProgressSchema,
  RecordPayoutSchema,
  RefundDecisionSchema,
  RefundRequestSchema,
  SellerTermsSchema,
  UpsertBookSchema,
  type BookDecision,
  type Principal,
} from "@ecclesios/shared";
import type { Request } from "express";
import { z } from "zod";
import { DomainError } from "../auth/core/errors";
import { CurrentPrincipal } from "../common/principal.decorator";
import { Public } from "../common/public.decorator";
import { ZodPipe } from "../common/zod.pipe";
import { PlatformRole } from "../platform/platform-role";
import { BooksService } from "./books.service";
import { BookStudioService } from "./studio.service";

const uuid = new ParseUUIDPipe({
  exceptionFactory: () => new DomainError(400, "VALIDATION_FAILED", "Invalid id."),
});
const slugPipe = new ZodPipe(BookSlugSchema);
const ip = (req: Request) => req.ip ?? "unknown";
const member = (p: Principal | undefined) => {
  if (p?.kind !== "member")
    throw new DomainError(
      403,
      "NOT_ALLOWED",
      "Sign in with your Ecclesios account to buy and read books.",
    );
  return p.id;
};

/** Catalogue (public; a token personalises "owned"). */
@Public()
@Controller("public/books")
export class BooksPublicController {
  constructor(private readonly books: BooksService) {}

  @Get()
  list(
    @Query(new ZodPipe(BookQuerySchema)) q: z.output<typeof BookQuerySchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.books.list(q, p);
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.books.detail(slug, p);
  }

  @Get(":slug/preview")
  preview(@Param("slug", slugPipe) slug: string) {
    return this.books.preview(slug);
  }
}

/**
 * Payment callbacks. Hubtel POSTs here after a payment; we only read the client reference
 * and then ask Hubtel ourselves (D-036). Always answers 200 so Hubtel doesn't retry forever.
 */
@Public()
@Controller("public/payments")
export class PaymentsCallbackController {
  constructor(private readonly books: BooksService) {}

  @Post("hubtel/callback")
  @HttpCode(200)
  async hubtel(@Body() body: unknown) {
    const b = body as {
      Data?: { ClientReference?: string };
      data?: { clientReference?: string };
      ClientReference?: string;
    } | null;
    const ref = b?.Data?.ClientReference ?? b?.data?.clientReference ?? b?.ClientReference;
    await this.books.callback(typeof ref === "string" ? ref.slice(0, 40) : undefined);
    return { ok: true };
  }

  /** Development checkout page (TestGateway only; 404 otherwise). */
  @Get("test/:ref")
  testOrder(@Param("ref") ref: string) {
    return this.books.testCheckout(ref.slice(0, 40));
  }

  @Post("test/:ref")
  @HttpCode(200)
  testPay(
    @Param("ref") ref: string,
    @Body(new ZodPipe(z.object({ outcome: z.enum(["paid", "failed"]) })))
    b: { outcome: "paid" | "failed" },
  ) {
    return this.books.testSettle(ref.slice(0, 40), b.outcome === "failed");
  }
}

/** Members: library, reading, checkout, refunds. */
@Controller("books")
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get("library")
  library(@CurrentPrincipal() p: Principal | undefined) {
    return this.books.library(member(p));
  }

  @Get("orders")
  orders(@CurrentPrincipal() p: Principal | undefined) {
    return this.books.myOrders(member(p));
  }

  @Get("orders/:id")
  order(@Param("id", uuid) id: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.books.order(member(p), id);
  }

  @Post("orders/:id/refund")
  @HttpCode(204)
  async refund(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(RefundRequestSchema)) b: z.output<typeof RefundRequestSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.books.requestRefund(member(p), id, b.reason, ip(req));
  }

  @Put(":slug/library")
  @HttpCode(204)
  async add(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined) {
    await this.books.addFree(member(p), slug);
  }

  @Delete(":slug/library")
  @HttpCode(204)
  async removeFromLibrary(
    @Param("slug", slugPipe) slug: string,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    await this.books.removeFree(member(p), slug);
  }

  @Get(":slug/read")
  read(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.books.read(member(p), slug);
  }

  @Put(":slug/progress")
  @HttpCode(204)
  async progress(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(ProgressSchema)) b: z.output<typeof ProgressSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    await this.books.saveProgress(member(p), slug, b.locator, b.percent);
  }

  @Post(":slug/checkout")
  @HttpCode(201)
  checkout(
    @Param("slug", slugPipe) slug: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.books.checkout(member(p), slug, ip(req));
  }
}

/** Sellers (SELL_BOOKS) and Super-Admins' own books. */
@Controller("studio/books")
export class BookStudioController {
  constructor(private readonly studio: BookStudioService) {}

  @Get()
  list(@CurrentPrincipal() p: Principal | undefined) {
    return this.studio.mine(p!);
  }

  @Get("statement")
  statement(@CurrentPrincipal() p: Principal | undefined) {
    return this.studio.statement(p!);
  }

  @Post()
  @HttpCode(201)
  create(
    @Body(new ZodPipe(UpsertBookSchema)) b: z.output<typeof UpsertBookSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.create(p!, b, ip(req));
  }

  @Get(":slug")
  detail(@Param("slug", slugPipe) slug: string, @CurrentPrincipal() p: Principal | undefined) {
    return this.studio.detail(p!, slug);
  }

  @Put(":slug")
  update(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(UpsertBookSchema)) b: z.output<typeof UpsertBookSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.update(p!, slug, b, ip(req));
  }

  @Put(":slug/price")
  price(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(BookPriceSchema)) b: z.output<typeof BookPriceSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.setPrice(p!, slug, b.priceMinor, ip(req));
  }

  @Post(":slug/upload")
  @HttpCode(201)
  upload(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(BookUploadSchema)) b: z.output<typeof BookUploadSchema>,
    @CurrentPrincipal() p: Principal | undefined,
  ) {
    return this.studio.presign(p!, slug, b.part, b.contentType, b.bytes);
  }

  @Put(":slug/files")
  attach(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(AttachBookFileSchema)) b: z.output<typeof AttachBookFileSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.attach(p!, slug, b.part, b.key, ip(req));
  }

  @Post(":slug/submit")
  @HttpCode(200)
  submit(
    @Param("slug", slugPipe) slug: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.transition(p!, slug, "submit", ip(req));
  }

  @Post(":slug/unlist")
  @HttpCode(200)
  unlist(
    @Param("slug", slugPipe) slug: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.transition(p!, slug, "unlist", ip(req));
  }

  @Delete(":slug")
  @HttpCode(204)
  async remove(
    @Param("slug", slugPipe) slug: string,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.studio.remove(p!, slug, ip(req));
  }
}

/** Super-Admin: review, commission, sellers, payouts, refunds (D-036). */
@PlatformRole("SUPER_ADMIN")
@Controller("platform/books")
export class BooksAdminController {
  constructor(
    private readonly studio: BookStudioService,
    private readonly books: BooksService,
  ) {}

  @Get()
  list(
    @Query(new ZodPipe(z.object({ status: BookStatusSchema.optional() })))
    q: {
      status?: z.infer<typeof BookStatusSchema>;
    },
  ) {
    return this.studio.adminList(q.status);
  }

  @Post(":slug/decision")
  @HttpCode(200)
  decide(
    @Param("slug", slugPipe) slug: string,
    @Body(new ZodPipe(BookDecisionSchema)) d: BookDecision,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.decide(p!.id, slug, d, ip(req));
  }

  @Get("settings")
  settings() {
    return this.studio.settings();
  }

  @Put("settings")
  setSettings(
    @Body(new ZodPipe(BookSettingsSchema)) b: z.output<typeof BookSettingsSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.setSettings(p!.id, b.commissionBps, ip(req));
  }

  @Get("sellers")
  sellers() {
    return this.studio.sellers();
  }

  @Put("sellers/:key")
  terms(
    @Param("key") key: string,
    @Body(new ZodPipe(SellerTermsSchema)) b: z.output<typeof SellerTermsSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.setTerms(p!.id, key, b.commissionBps, b.payoutTo, ip(req));
  }

  @Get("sellers/:key/statement")
  sellerStatement(@Param("key") key: string) {
    return this.studio.statementForKey(key);
  }

  @Post("sellers/:key/payouts")
  @HttpCode(201)
  payout(
    @Param("key") key: string,
    @Body(new ZodPipe(RecordPayoutSchema)) b: z.output<typeof RecordPayoutSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    return this.studio.recordPayout(p!.id, key, b.amountMinor, b.reference, ip(req));
  }

  @Get("refunds")
  refunds() {
    return this.studio.refunds();
  }

  @Post("refunds/:id/decision")
  @HttpCode(204)
  async refundDecision(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(RefundDecisionSchema)) b: z.output<typeof RefundDecisionSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    if (b.decision === "approve") await this.books.approveRefund(p!.id, id, b.note, ip(req));
    else await this.books.declineRefund(p!.id, id, b.note, ip(req));
  }

  @Post("orders/:id/refund")
  @HttpCode(204)
  async refundOrder(
    @Param("id", uuid) id: string,
    @Body(new ZodPipe(AdminRefundSchema)) b: z.output<typeof AdminRefundSchema>,
    @CurrentPrincipal() p: Principal | undefined,
    @Req() req: Request,
  ) {
    await this.books.refundOrder(p!.id, id, b.note, ip(req));
  }
}
