import { useContext, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext';
import { toast } from 'react-toastify';
import { getErrorMessage } from '../utils/getErrorMessage';
import api from '../api/client'

const Verify = () => {

    const [searchParams] = useSearchParams()

    const success = searchParams.get("success")
    const transactionId = searchParams.get("transactionId")

    const { loadCreditsData, token } = useContext(AppContext)

    const navigate = useNavigate()

    // Function to verify stripe payment
    const verifyStripe = async () => {

        try {
            const { data } = await api.post("/api/user/verify-stripe", { success, transactionId })
            toast.success(data.message)
            loadCreditsData()
        } catch (error) {
            toast.error(getErrorMessage(error))
            console.log(error)
        } finally {
            navigate("/")
        }

    }

    useEffect(() => {
        if (token) {
            verifyStripe()
        }
    }, [token])

    return (
        <div className='min-h-[60vh] flex items-center justify-center'>
            <div className="w-20 h-20 border-4 border-gray-300 border-t-4 border-t-primary rounded-full animate-spin"></div>
        </div>
    )
}

export default Verify