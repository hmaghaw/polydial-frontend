import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useToast } from "../ui/toast";

/** Mutation that invalidates the given query keys and toasts success/failure. */
export function useAction<A, R = unknown>(fn: (a: A) => Promise<R>, opts: { invalidate?: QueryKey[]; success?: string | ((r: R) => string); silentError?: boolean } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      if (opts.success) toast(typeof opts.success === "function" ? opts.success(r) : opts.success);
    },
    onError: (e) => { if (!opts.silentError) toast(e instanceof Error ? e.message : "Something went wrong.", "err"); },
  });
}
