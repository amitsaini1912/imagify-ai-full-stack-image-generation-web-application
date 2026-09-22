import { createContext, useEffect, useState } from "react";
import { toast } from 'react-toastify'
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage } from "../utils/getErrorMessage";
import api, { SESSION_EXPIRED_EVENT } from "../api/client";

export const AppContext = createContext()

const CREDITS_QUERY_KEY = ['credits']

const fetchCredits = async () => {
    const { data } = await api.get('/api/user/credits')
    return data
}

// eslint-disable-next-line react/prop-types -- Provider passing through arbitrary children; this codebase doesn't use PropTypes elsewhere.
const AppContextProvider = ({ children }) => {

    const [showLogin, setShowLogin] = useState(false)
    const [token, setToken] = useState(localStorage.getItem('token'))

    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // Replaces the old useState(credit)/useState(user) + a manual useEffect(() =>
    // { if (token) loadCreditsData() }, [token]). The query key includes `token` so
    // logging in as a different user (or logging out) is itself a cache-identity change —
    // TanStack Query refetches automatically instead of a hand-written effect deciding
    // when to. `enabled` stops it from ever running with no token at all.
    const creditsQuery = useQuery({
        queryKey: [...CREDITS_QUERY_KEY, token],
        queryFn: fetchCredits,
        enabled: !!token,
    })

    const credit = creditsQuery.data?.credits ?? false
    const user = creditsQuery.data?.user ?? null

    // useMutation for the one write that changes server state from this file. Keeps the
    // exact same external contract (`await generateImage(prompt)` returns the image URL
    // or undefined) so Result.jsx/GenerateBtn.jsx don't need to change at all — the 402
    // "no credits left" redirect stays here because a generic toast isn't enough for it.
    const generateMutation = useMutation({
        mutationFn: (prompt) => api.post('/api/image/generate-image', { prompt }).then((res) => res.data),
    })

    const generateImage = async (prompt) => {
        try {
            const data = await generateMutation.mutateAsync(prompt)
            creditsQuery.refetch()
            return data.resultImage
        } catch (error) {
            toast.error(getErrorMessage(error))
            creditsQuery.refetch()
            // 402 = "No credit balance" from the backend
            if (error.response?.status === 402) {
                navigate('/buy')
            }
        }
    }

    const logout = () => {
        localStorage.removeItem('token')
        setToken('')
        queryClient.removeQueries({ queryKey: CREDITS_QUERY_KEY })
    }

    // The axios layer (src/api/client.js) can't call useNavigate() or touch this state
    // directly — it's a plain module, not a component. A 401 there clears the token and
    // broadcasts this event; here, where React state and the router both live, is where
    // that turns into an actual logout + a prompt to sign back in.
    useEffect(() => {
        const handleSessionExpired = () => {
            logout()
            toast.info('Session expired — please log in again')
            setShowLogin(true)
            navigate('/')
        }

        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    }, [navigate])

    const value = {
        token, setToken,
        user,
        showLogin, setShowLogin,
        credit,
        // Kept as `loadCreditsData` (not `refetch`) — BuyCredit.jsx and Verify.jsx already
        // call this by name after a payment/generation completes, and TanStack Query's
        // own `refetch` is exactly the "go get the latest credits now" operation they need.
        loadCreditsData: creditsQuery.refetch,
        generateImage,
        logout
    }

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )

}

export default AppContextProvider