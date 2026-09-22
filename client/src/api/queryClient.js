import { QueryClient, QueryCache } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getErrorMessage } from '../utils/getErrorMessage'

// One shared QueryClient for the whole app. A QueryCache-level onError means any query
// that fails (credits, history, whatever gets added later) shows a toast automatically —
// no call site needs its own try/catch just to report a fetch failure. Mutations keep
// their own local error handling (e.g. generateImage's 402-redirect logic needs more than
// a toast), so this only listens at the QueryCache, not a MutationCache.
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
        },
    },
    queryCache: new QueryCache({
        onError: (error) => toast.error(getErrorMessage(error)),
    }),
})
