import { useContext, useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import { AppContext } from '../context/AppContext'
import { toast } from 'react-toastify'
import { motion } from 'framer-motion'
import { getErrorMessage } from '../utils/getErrorMessage'
import api from '../api/client'

const Login = () => {

    const [state, setState] = useState('Login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    const { setShowLogin, setToken } = useContext(AppContext)

    const onSubmitHandler = async (e) => {
        e.preventDefault()

        try {
            const url = state === 'Login' ? '/api/user/login' : '/api/user/register'
            const payload = state === 'Login' ? { email, password } : { name, email, password }

            const { data } = await api.post(url, payload)

            // setToken triggers AppContext's credits query (queryKey includes token,
            // enabled: !!token) — that single fetch brings back both credits and user,
            // so there's no separate setUser here anymore.
            localStorage.setItem('token', data.token)
            setToken(data.token)
            setShowLogin(false)
        } catch (error) {
            toast.error(getErrorMessage(error))
        }
    }



    useEffect(() => {
        // Disable scrolling on body when the login is open
        document.body.style.overflow = 'hidden';

        // Cleanup function to re-enable scrolling
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className=' absolute top-0 left-0 right-0 bottom-0 z-10 backdrop-blur-sm bg-black/30 flex justify-center items-center'>
            <motion.form onSubmit={onSubmitHandler} className='relative bg-white p-10 rounded-xl text-slate-500'
                initial={{ opacity: 0.2, y: 50 }}
                transition={{ duration: 0.3 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
            >

                <h1 className='text-center text-2xl text-neutral-700 font-medium'>{state}</h1>

                <p className='text-sm'>Welcome back! Please sign in to continue</p>

                {state !== 'Login' && <div className='border px-6 py-2 flex items-center gap-2 rounded-full mt-5'>
                    <img src={assets.email_icon} alt="" />
                    <input onChange={e => setName(e.target.value)} value={name} className='outline-none text-sm' type="text" placeholder='Full Name' required />
                </div>}

                <div className='border px-6 py-2 flex items-center gap-2 rounded-full mt-4'>
                    <img src={assets.email_icon} alt="" />
                    <input onChange={e => setEmail(e.target.value)} value={email} className='outline-none text-sm' type="email" placeholder='Email id' required />
                </div>

                <div className='border px-6 py-2 flex items-center gap-2 rounded-full mt-4'>
                    <img src={assets.lock_icon} alt="" />
                    <input onChange={e => setPassword(e.target.value)} value={password} className='outline-none text-sm' type="password" placeholder='Password' required minLength={state === 'Login' ? undefined : 8} />
                </div>

                <p className='text-sm text-blue-600 my-4 cursor-pointer'>Forgot password?</p>

                <button className='bg-blue-600 w-full text-white py-2 rounded-full'>{state === 'Login' ? 'login' : 'create account'}</button>

                {state === "Login"
                    ? <p className='mt-5 text-center'>Don&apos;t have an account? <span onClick={() => setState('Sign Up')} className='text-blue-600 cursor-pointer'>Sign up</span></p>
                    : <p className='mt-5 text-center'>Already have an account? <span onClick={() => setState('Login')} className='text-blue-600 cursor-pointer'>Login</span></p>
                }

                <img onClick={() => setShowLogin(false)} className=' absolute top-5 right-5 cursor-pointer' src={assets.cross_icon} alt="" />
            </motion.form>
        </div>
    )
}

export default Login