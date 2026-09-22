import { createContext, useEffect, useState } from "react";
import { toast } from 'react-toastify'
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "../utils/getErrorMessage";
import api, { SESSION_EXPIRED_EVENT } from "../api/client";

export const AppContext = createContext()

// eslint-disable-next-line react/prop-types -- Provider passing through arbitrary children; this codebase doesn't use PropTypes elsewhere.
const AppContextProvider = ({ children }) => {

    const [showLogin, setShowLogin] = useState(false)
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [user, setUser] = useState(null)

    const [credit, setCredit] = useState(false)

    const navigate = useNavigate()

    const loadCreditsData = async () => {
        try {
            const { data } = await api.get('/api/user/credits')
            setCredit(data.credits)
            setUser(data.user)
        } catch (error) {
            console.log(error)
            toast.error(getErrorMessage(error))
        }
    }

    const generateImage = async (prompt) => {
        try {
            const { data } = await api.post('/api/image/generate-image', { prompt })
            loadCreditsData()
            return data.resultImage
        } catch (error) {
            toast.error(getErrorMessage(error))
            loadCreditsData()
            // 402 = "No credit balance" from the backend
            if (error.response?.status === 402) {
                navigate('/buy')
            }
        }
    }

    const logout = () => {
        localStorage.removeItem('token')
        setToken('')
        setUser(null)
    }

    useEffect(()=>{
        if (token) {
            loadCreditsData()
        }
    },[token])

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
        user, setUser,
        showLogin, setShowLogin,
        credit, setCredit,
        loadCreditsData,
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