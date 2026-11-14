import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HealthPage } from "./HealthPage";

describe("health page", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a healthy API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <HealthPage />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("API status: healthy")).toBeInTheDocument();
  });

  it("shows an error for an invalid API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ healthy: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <HealthPage />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByText("API health check failed. Make sure the backend is running."),
    ).toBeInTheDocument();
  });
});
