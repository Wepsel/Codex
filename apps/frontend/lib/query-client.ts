import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        staleTime: 20_000
      }
    }
  });
}
