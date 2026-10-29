// Temporary: lists which request header names exist (no values except country-like ones).
Deno.serve((req) => {
  const names = [...req.headers.keys()];
  const geo: Record<string, string> = {};
  for (const n of names) if (/country|region|city|geo|cf-/i.test(n) && !/ip|connecting/i.test(n)) geo[n] = req.headers.get(n) ?? "";
  return new Response(JSON.stringify({ names, geo }), { headers: { "content-type": "application/json" } });
});
