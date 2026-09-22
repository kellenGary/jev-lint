import { TypeSafeClient } from "@typesafe-ai/sdk";
import "dotenv/config";

let clientInstance: TypeSafeClient | null = null;

/**
 * Returns a configured TypeSafeClient singleton.
 */
export function getTypeSafeClient(apiKeyOverride?: string): TypeSafeClient {
  const apiKey = apiKeyOverride || process.env.TYPESAFE_API_KEY;

  if (!clientInstance || apiKeyOverride) {
    clientInstance = new TypeSafeClient({
      apiKey,
    });
  }

  return clientInstance;
}
