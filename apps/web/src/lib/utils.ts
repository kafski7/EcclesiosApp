import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn/ui class merger. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
