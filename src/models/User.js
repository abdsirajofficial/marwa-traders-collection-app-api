import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['OWNER', 'ADMIN', 'STAFF', 'CASH_COLLECTOR'],
      required: true,
      index: true,
    },
    pinHash: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isRemoved: {
      type: Boolean,
      default: false,
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.comparePin = async function (pin) {
  if (!this.pinHash) {
    // If no explicit separate PIN hash is set, the login code itself acts as the PIN
    return this.code === pin;
  }
  return bcrypt.compare(pin, this.pinHash);
};

export const User = mongoose.model('User', userSchema);
