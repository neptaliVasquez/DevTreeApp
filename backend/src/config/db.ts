import mongoose from 'mongoose';
import colors from 'colors';

export const connectDB = async () => {
    try{
        const url = process.env.MONGO_URI;
        const {connection} = await mongoose.connect(url);
        console.log(colors.cyan.bold(`MongoDB Connected: ${connection.host}: ${connection.port}`));
    }catch(err){
        console.error(colors.red('Database connection error:'), err.errmsg);
        process.exit(1);
    }
}