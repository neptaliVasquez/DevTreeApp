import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import router from './router'; 
import { connectDB } from './config/db';    
import { corsConfig } from './config/cors';

connectDB();

const app = express();

//Cors setup
app.use(cors(corsConfig))

// Middleware to parse JSON bodies
app.use(express.json());

app.use('/api', router);

export default app;