import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "./core/types";

/** argon2id (blueprint §6). @node-rs/argon2 defaults to argon2id. */
@Injectable()
export class ArgonHasher implements PasswordHasher {
  hash(plain: string) {
    return hash(plain);
  }
  async verify(digest: string, plain: string) {
    try {
      return await verify(digest, plain);
    } catch {
      return false; // malformed hash ⇒ no match
    }
  }
}
