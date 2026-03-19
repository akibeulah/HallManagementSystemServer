import mongoose from 'mongoose';

const complaintHistorySchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
    },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['status_change', 'comment'], default: 'status_change' },
    oldStatus: { type: String },
    newStatus: { type: String },
    notes: { type: String },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('ComplaintHistory', complaintHistorySchema);
