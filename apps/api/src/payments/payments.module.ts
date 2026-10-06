import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../config/env";
import { PAYMENT_GATEWAY } from "./gateway";
import { HubtelGateway } from "./hubtel.gateway";
import { TestGateway } from "./test.gateway";

/** One payment gateway for the whole API (books now; church subscriptions later — D-036). */
@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [ENV],
      useFactory: (env: Env) =>
        env.PAYMENTS_GATEWAY === "hubtel"
          ? new HubtelGateway({ clientId: env.HUBTEL_CLIENT_ID!, clientSecret: env.HUBTEL_CLIENT_SECRET!, merchantAccount: env.HUBTEL_MERCHANT_ACCOUNT! })
          : new TestGateway(env.PUBLIC_WEB_URL),
    },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
