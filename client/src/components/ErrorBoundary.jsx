import { Component } from 'react'

// Error boundaries must be class components — as of React 18 there is no hook equivalent
// of getDerivedStateFromError/componentDidCatch. They only catch errors thrown during
// rendering (and in lifecycle methods/constructors) of the tree below them. An error
// thrown inside an event handler or inside async code (an api.* call's .catch, a
// useEffect) never reaches this — those already have their own handling (Day 22's toasts,
// this file's own componentDidCatch is just the last line of defense for everything else).
class ErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, info) {
        console.error('Uncaught render error:', error, info.componentStack)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className='min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4'>
                    <h1 className='text-2xl font-medium text-gray-800'>Something went wrong.</h1>
                    <p className='text-gray-500'>Refreshing the page usually fixes this.</p>
                    <button
                        onClick={() => window.location.reload()}
                        className='bg-zinc-900 text-white px-8 py-2.5 rounded-full'
                    >
                        Reload
                    </button>
                </div>
            )
        }

        // eslint-disable-next-line react/prop-types -- passing through arbitrary children; this codebase doesn't use PropTypes elsewhere (same call made for AppContextProvider).
        return this.props.children
    }
}

export default ErrorBoundary
