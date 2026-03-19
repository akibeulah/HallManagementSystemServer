import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['furniture', 'equipment'], required: true },
    hallId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hall', required: true },
    quantity: { type: Number, default: 1 },
    condition: {
      type: String,
      enum: ['good', 'fair', 'poor', 'condemned'],
      default: 'good',
    },
    dateAdded: { type: Date, default: Date.now },
    maintenanceIntervalDays: { type: Number, required: true },
    lastMaintenanceDate: { type: Date, required: true },
    nextMaintenanceDue: { type: Date },
  },
  { timestamps: true }
);

// Auto-compute nextMaintenanceDue before save
itemSchema.pre('save', function (next) {
  if (this.lastMaintenanceDate && this.maintenanceIntervalDays) {
    const due = new Date(this.lastMaintenanceDate);
    due.setDate(due.getDate() + this.maintenanceIntervalDays);
    this.nextMaintenanceDue = due;
  }
  next();
});

export default mongoose.model('Item', itemSchema);
