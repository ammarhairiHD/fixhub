export interface HealthResponse {
  status: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health");

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const result: unknown = await response.json();

  if (
    typeof result !== "object" ||
    result === null ||
    !("status" in result) ||
    typeof result.status !== "string"
  ) {
    throw new Error("Health check returned an invalid response");
  }

  return { status: result.status };
}
