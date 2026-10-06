import { Module } from "@nestjs/common";
import { BookAccess } from "./book-access";
import { BooksAdminController, BooksController, BookStudioController, BooksPublicController, PaymentsCallbackController } from "./books.controller";
import { BooksService } from "./books.service";
import { BookStudioService } from "./studio.service";

/** Books (functionality §3.10, D-036). */
@Module({
  controllers: [BooksPublicController, PaymentsCallbackController, BooksController, BookStudioController, BooksAdminController],
  providers: [BookAccess, BooksService, BookStudioService],
})
export class BooksModule {}
