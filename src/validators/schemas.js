import { z } from 'zod';

export const loginSchema = z.object({
  code: z.string().min(1, 'Login code/PIN is required').trim(),
});

export const customerCreateSchema = z.object({
  shopName: z.string().min(2, 'Shop name must be at least 2 characters').trim(),
  ownerName: z.string().min(2, 'Owner name must be at least 2 characters').trim(),
  mobile: z.string().min(10, 'Mobile number must be at least 10 digits').regex(/^[0-9+ ]+$/, 'Invalid phone number format').trim(),
  address: z.string().min(2, 'Address is required').trim(),
  openingBalance: z.number().min(0, 'Opening balance cannot be negative').default(0),
});

export const customerUpdateSchema = z.object({
  shopName: z.string().min(2).trim().optional(),
  ownerName: z.string().min(2).trim().optional(),
  mobile: z.string().min(10).trim().optional(),
  address: z.string().min(2).trim().optional(),
  openingBalance: z.number().min(0).optional(),
});

export const invoiceCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice number is required').trim(),
  invoiceDate: z.string().datetime().optional().or(z.date().optional()),
  invoiceAmount: z.number().positive('Invoice amount must be greater than zero'),
  initialPayment: z.number().min(0, 'Initial payment cannot be negative').default(0),
});

export const paymentCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMode: z.enum(['CASH', 'GPAY']).default('CASH'),
  location: z.object({
    locationName: z.string().optional().default('Shop Counter'),
    latitude: z.number().nullable().optional().default(null),
    longitude: z.number().nullable().optional().default(null),
  }).optional().default({}),
  idempotencyKey: z.string().optional(),
});

export const correctionRequestSchema = z.object({
  requestedAmount: z.number().min(0, 'Requested amount cannot be negative'),
  reason: z.string().min(3, 'Reason for correction must be provided').trim(),
});

export const correctionReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().optional(),
});

export const settlementCreateSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  receivedAmount: z.number().min(0, 'Received amount cannot be negative'),
  notes: z.string().optional(),
});

export const validateRequest = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    const errorDetails = error.errors?.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    })) || [{ message: error.message }];
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorDetails,
    });
  }
};
