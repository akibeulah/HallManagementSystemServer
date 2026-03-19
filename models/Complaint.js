import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      enum: ['woodwork', 'metalwork', 'electrical', 'plumbing'],
      required: true,
    },
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    itemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
    otherItem: { type: String },
    status: {
      type: String,
      enum: ['logged', 'seen', 'work_in_progress', 'blocked', 'needs_review', 'done'],
      default: 'logged',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    aiSuggestion: { type: String },
    aiGeneratedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Complaint', complaintSchema);
