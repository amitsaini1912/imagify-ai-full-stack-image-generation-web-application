import { useContext, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import api from '../api/client'
import { AppContext } from '../context/AppContext'

const PAGE_SIZE = 12

const fetchHistory = async (page) => {
    const { data } = await api.get('/api/image/history', { params: { page, limit: PAGE_SIZE } })
    return data
}

const History = () => {
    const { token } = useContext(AppContext)
    const [page, setPage] = useState(1)

    // placeholderData: keepPreviousData means clicking "Next" shows last page's grid
    // (slightly stale) while the new page loads, instead of the whole page flashing to a
    // loading state — the pagination-without-jank behavior TanStack Query gives for free.
    const { data, isLoading, isFetching, isError } = useQuery({
        queryKey: ['history', page],
        queryFn: () => fetchHistory(page),
        enabled: !!token,
        placeholderData: keepPreviousData,
    })

    if (!token) {
        return <p className='text-center py-20 text-gray-500'>Log in to see your generation history.</p>
    }

    if (isLoading) {
        return <p className='text-center py-20 text-gray-500'>Loading your generations…</p>
    }

    if (isError) {
        return <p className='text-center py-20 text-gray-500'>Couldn&apos;t load your history. Try again in a moment.</p>
    }

    const { generations, pagination } = data

    return (
        <motion.div className='min-h-[70vh] pt-10 pb-20'
            initial={{ opacity: 0.2, y: 50 }}
            transition={{ duration: 0.5 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
        >
            <h1 className='text-center text-3xl font-medium mb-8'>Your generations</h1>

            {generations.length === 0
                ? <p className='text-center text-gray-500'>No generations yet — go make something on the home page.</p>
                : <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'>
                    {generations.map((gen) => (
                        <div key={gen._id} className='flex flex-col gap-1'>
                            <img className='rounded-lg w-full aspect-square object-cover' src={gen.imageUrl} alt={gen.prompt} />
                            <p className='text-xs text-gray-500 truncate' title={gen.prompt}>{gen.prompt}</p>
                            <p className='text-[11px] text-gray-400'>{new Date(gen.createdAt).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            }

            {pagination.totalPages > 1 && (
                <div className='flex justify-center items-center gap-4 mt-8'>
                    <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className='px-5 py-2 rounded-full border border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        Previous
                    </button>
                    <p className='text-sm text-gray-500'>
                        {isFetching ? 'Loading…' : `Page ${pagination.page} of ${pagination.totalPages}`}
                    </p>
                    <button
                        disabled={page >= pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className='px-5 py-2 rounded-full border border-gray-400 disabled:opacity-40 disabled:cursor-not-allowed'
                    >
                        Next
                    </button>
                </div>
            )}
        </motion.div>
    )
}

export default History
