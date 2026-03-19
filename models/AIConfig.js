import mongoose from 'mongoose';

const aiConfigSchema = new mongoose.Schema(
  {
    provider: { type: String, default: 'anthropic' },
    apiKey: { type: String, required: true }, // AES-encrypted
    model: { type: String, default: 'claude-sonnet-4-6' },
    isActive: { type: Boolean, default: true },
    lastTestedAt: { type: Date },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('AIConfig', aiConfigSchema);
