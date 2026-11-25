// Only numeric elapsed durations leave the server. No identities, query text or tokens.
export function createRankedMoveTiming(clock: () => number = () => performance.now()) {
  const started = clock();
  let authStart = started;
  let authEnd: number | undefined;
  let dbStart: number | undefined;
  const duration = (start: number, end: number) => Math.max(0, Math.round(end - start));
  return {
    startAuth() {
      authStart = clock();
    },
    finishAuth() {
      authEnd = clock();
    },
    startDatabase() {
      dbStart = clock();
    },
    attach(response: Response): Response {
      const end = clock();
      const values = [`app;dur=${duration(started, end)}`];
      if (authEnd !== undefined) values.push(`auth;dur=${duration(authStart, authEnd)}`);
      if (dbStart !== undefined) values.push(`db;dur=${duration(dbStart, end)}`);
      response.headers.set("Server-Timing", values.join(", "));
      return response;
    },
  };
}
