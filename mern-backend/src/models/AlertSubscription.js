const mongoose = require('mongoose');

const alertSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    condition: {
      type: String,
      required: [true, 'Alert condition is required'],
      enum: [
        'AQI>100',
        'AQI>150',
        'AQI>200',
        'AQI>300',
        'PM25>35',
        'PM25>55',
        'PM25>150',
        'PM10>150',
        'O3>0.07',
        'NO2>0.05',
        'SO2>0.075',
        'CO>9',
      ],
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    lat: {
      type: Number,
    },
    lon: {
      type: Number,
    },
    frequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily'],
      default: 'hourly',
    },
    channel: {
      type: String,
      enum: ['email', 'push', 'sms'],
      default: 'email',
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastTriggered: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

alertSubscriptionSchema.index({ userId: 1, active: 1 });
alertSubscriptionSchema.index({ location: 1, condition: 1 });

module.exports = mongoose.model('AlertSubscription', alertSubscriptionSchema);
