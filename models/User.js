import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    role: {
      type: String,
      enum: ['student', 'maintenance_officer', 'admin'],
      default: 'student',
    },
    category: {
      type: String,
      enum: ['woodwork', 'metalwork', 'electrical', 'plumbing'],
    },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    hallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hall' },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
