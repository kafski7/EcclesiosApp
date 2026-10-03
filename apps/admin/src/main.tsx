import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { restoreSession } from "@/lib/auth";
import { queryClient } from "@/lib/query";
import { router } from "@/router";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing from index.html");

void restoreSession();

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
