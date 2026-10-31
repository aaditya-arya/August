/** Bounded concurrency, with output order matching the input. */
export async function mapConcurrent<T, R>(values: readonly T[], concurrency: number, fn: (value: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer.");
  const results = new Array<R>(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index], index);
    }
  }));
  return results;
}
