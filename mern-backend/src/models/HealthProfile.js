const mongoose = require('mongoose');

const healthProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    asthmaPatient: {
      type: Boolean,
      default: false,
    },
    ageGroup: {
      type: String,
      enum: ['child', 'teen', 'adult', 'senior'],
      default: 'adult',
    },
    respiratoryConditions: [
      {
        type: String,
        enum: [
          'asthma',
          'copd',
          'bronchitis',
          'allergic_rhinitis',
          'sinusitis',
          'pneumonia',
          'other',
        ],
      },
    ],
    outdoorWorker: {
      type: Boolean,
      default: false,
    },
    preferredLocations: [
      {
        name: { type: String, trim: true },
        lat: { type: Number },
        lon: { type: Number },
      },
    ],
    sensitivityLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'very_high'],
      default: 'moderate',
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
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

healthProfileSchema.index({ userId: 1 });

module.exports = mongoose.model('HealthProfile', healthProfileSchema);
