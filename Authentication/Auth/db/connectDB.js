import mongoose from "mongoose"
import { DBNAME } from "../../constant.js";


 export const connectDB = async () =>{
    try {
        console.log(`MongoDB URI: ${process.env.MONGO_URI}/${DBNAME}`);
        const connection = await mongoose.connect(`${process.env.MONGO_URI}/${DBNAME}`,{
            dbName: 'authDB'
        } );
        console.log(`MongoDB is connected ${connection.connection.host}`);
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);//1 is for failure and 0 is for sucess
    }
}

export default connectDB;