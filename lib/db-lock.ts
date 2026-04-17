/**
 * Serializes all database writes (snapshot updates and incremental transactions)
 * so concurrent requests cannot interleave read–modify–write cycles.
 */
let writeChain: Promise<unknown> = Promise.resolve();

export async function withDbWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(() => fn());
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
