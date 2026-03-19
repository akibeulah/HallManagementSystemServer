import mongoose from 'mongoose';

const hallSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    campus: { type: String, required: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    floors: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.model('Hall', hallSchema);
