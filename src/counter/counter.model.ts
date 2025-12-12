import mongoose from 'mongoose';

export const CounterSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    counter: { type: Number, required: true }
});


// export interface Counter {
//     id: string;
//     counter: string;
// }