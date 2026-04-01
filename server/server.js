import 'dotenv/config';
import express from 'express'
import cors from 'cors'
import userRouter from './routes/userRoutes.js';
import connectDB from './configs/mongodb.js';
import imageRouter from './routes/imageRoutes.js';

// App Config
const PORT = process.env.PORT || 4000
const app = express();

try {
    await connectDB()
} catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
}

// Intialize Middlewares
app.use(express.json())
app.use(cors())

// API routes
app.use('/api/user',userRouter)
app.use('/api/image',imageRouter)

app.get('/', (req,res) => res.send("API Working"))

const server = app.listen(PORT, () => console.log('Server running on port ' + PORT));

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Set a different PORT in server/.env or stop the process using it.`);
        process.exit(1);
    }

    throw error;
})
