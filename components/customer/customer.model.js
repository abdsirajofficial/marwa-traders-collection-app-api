import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    customerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    shopName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    ownerName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    openingBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currentOutstanding: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

customerSchema.index({
  shopName: 'text',
  ownerName: 'text',
  mobile: 'text',
  customerCode: 'text',
});

export const Customer = mongoose.model('Customer', customerSchema);
