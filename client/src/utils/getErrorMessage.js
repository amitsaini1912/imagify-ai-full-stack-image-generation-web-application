import axios from 'axios'

// The backend now answers failures with an HTTP error status and a body
// like { success: false, message: "..." }. axios throws on those, so read
// the server's message off error.response; fall back to the network message.
export const getErrorMessage = (error) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.message
  }
  return error?.message || 'Something went wrong'
}
