import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Build the three `useMutation` lifecycle callbacks that implement the
 * snapshot → optimistic update → rollback-on-error → invalidate pattern.
 *
 * Spread the return value into a mutation config:
 *
 * ```ts
 * api.svc.updateUser.useMutation({
 *   ...optimistic(qc, hooks.svc.getUser.queryKey({ params: { id: 1 } }),
 *                 (prev, patch) => prev ? { ...prev, ...patch } : prev),
 * });
 * ```
 *
 * The helper is deliberately narrow: it covers the 80% case where you write
 * to one query key. Multi-key invalidation or transactional rollbacks should
 * compose this primitive rather than extend its signature.
 */
export function optimistic<TData, TInput>(
	qc: QueryClient,
	queryKey: QueryKey,
	updater: (prev: TData | undefined, input: TInput) => TData | undefined,
): {
	onMutate: (input: TInput) => Promise<{ prev: TData | undefined }>;
	onError: (
		err: unknown,
		input: TInput,
		context: { prev: TData | undefined } | undefined,
	) => void;
	onSettled: () => Promise<void>;
} {
	return {
		onMutate: async (input) => {
			await qc.cancelQueries({ queryKey });
			const prev = qc.getQueryData<TData>(queryKey);
			qc.setQueryData<TData>(queryKey, (old) => updater(old, input));
			return { prev };
		},
		onError: (_err, _input, context) => {
			if (context) qc.setQueryData(queryKey, context.prev);
		},
		onSettled: async () => {
			await qc.invalidateQueries({ queryKey });
		},
	};
}
