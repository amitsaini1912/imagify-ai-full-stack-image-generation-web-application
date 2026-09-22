import axios from 'axios'

// A plain DOM event name, not a function import — this file is a module, not a React
// component, so it can never call useNavigate()/useContext() itself. Broadcasting an event
// lets AppContext (which owns token/user state and does have router access) react to a
// session expiring without the two files needing to import each other.
export const SESSION_EXPIRED_EVENT = 'imagify:session-expired'

const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_URL,
})

// Attach the bearer token to every outgoing request in one place. Reads straight from
// localStorage rather than React state — AppContext already treats localStorage as the
// source of truth for the token (it initializes state from it and writes back to it on
// every login/logout), so this stays in sync without needing to be told the token value.
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// A 401 means "this token is missing/expired/invalid" — identical handling belongs in one
// place, not repeated as an `if (error.response?.status === 401)` at every call site.
// Clears the token immediately (so the very next request doesn't retry with a token that's
// already known to be bad), then broadcasts the event for the React side to react to.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token')
            window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
        }
        return Promise.reject(error)
    }
)

export default api
