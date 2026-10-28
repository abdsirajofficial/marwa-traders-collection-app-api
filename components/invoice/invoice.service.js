import { Invoice } from './invoice.model.js';
import { Customer } from '../customer/customer.model.js';
import { Payment } from '../payment/payment.model.js';
import { computeCustomerOutstanding } from '../customer/customer.service.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { ApiError } from '../../common/utils/api-error.util.js';
import { applyInvoiceStatus } from './invoice.helper.js';
import { AUDIT_ACTIONS, ROLES } from '../../common/utils/constants.js';

export const createInvoice = async (data, user, ipAddress = null) => {
  const customer = await Customer.findById(data.customerId);
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const existing = await Invoice.findOne({ invoiceNumber: data.invoiceNumber.trim() });
  if (existing) {
    throw new ApiError(400, `Invoice number "${data.invoiceNumber}" already exists`);
  }

  const invoiceAmount = Number(data.invoiceAmount);
  const initialPayment = Number(data.initialPayment || 0);

  if (initialPayment > invoiceAmount) {
    throw new ApiError(400, 'Initial payment cannot be greater than invoice amount');
  }

  const outstandingAmount = invoiceAmount - initialPayment;
  let status = 'UNPAID';
  if (outstandingAmount === 0) {
    status = 'PAID';
  } else if (initialPayment > 0) {
    status = 'PARTIALLY_PAID';
  }

  const invoice = await Invoice.create({
    invoiceNumber: data.invoiceNumber.trim(),
    customerId: customer._id,
    invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
    invoiceAmount,
    initialPayment,
    outstandingAmount,
    status,
    createdBy: user._id,
  });

  await computeCustomerOutstanding(customer._id);

  await logAuditEvent({
    userId: user._id,
    userCode: user.code,
    role: user.role,
    action: AUDIT_ACTIONS.CREATE_INVOICE,
    entity: 'INVOICE',
    entityId: invoice._id.toString(),
    description: `Created invoice #${invoice.invoiceNumber} for ${customer.shopName} - Amount: ₹${invoiceAmount}, Initial: ₹${initialPayment}`,
    ipAddress,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount,
      initialPayment,
      outstandingAmount,
      customerId: customer._id,
    },
  });

  return invoice;
};

export const updateInvoice = async (id, data, user, ipAddress = null) => {
  if (user?.role !== ROLES.OWNER) {
    throw new ApiError(403, 'Only the Owner can edit invoices');
  }

  const invoice = await Invoice.findById(id);
  if (!invoice) throw new ApiError(404, 'Invoice not found');

  const invoiceNumber = String(data.invoiceNumber || invoice.invoiceNumber).trim();
  if (!invoiceNumber) throw new ApiError(400, 'Invoice number is required');

  const duplicate = await Invoice.findOne({ invoiceNumber, _id: { $ne: invoice._id } });
  if (duplicate) {
    throw new ApiError(400, `Invoice number "${invoiceNumber}" already exists`);
  }

  const invoiceAmount = Number(data.invoiceAmount);
  const initialPayment = Number(data.initialPayment ?? invoice.initialPayment ?? 0);
  if (Number.isNaN(invoiceAmount) || invoiceAmount <= 0) {
    throw new ApiError(400, 'Invoice amount must be greater than zero');
  }
  if (Number.isNaN(initialPayment) || initialPayment < 0) {
    throw new ApiError(400, 'Initial payment cannot be negative');
  }
  if (initialPayment > invoiceAmount) {
    throw new ApiError(400, 'Initial payment cannot be greater than invoice amount');
  }

  const appliedPayments = await Payment.find({
    status: 'COMPLETED',
    'allocations.invoiceId': invoice._id,
  });
  let alreadyApplied = 0;
  for (const payment of appliedPayments) {
    for (const allocation of payment.allocations) {
      if (allocation.invoiceId.toString() === invoice._id.toString()) {
        alreadyApplied += allocation.amountAllocated;
      }
    }
  }

  const netAmount = invoiceAmount - initialPayment;
  if (netAmount < alreadyApplied) {
    throw new ApiError(
      400,
      `Invoice balance cannot be less than ₹${alreadyApplied.toLocaleString('en-IN')} already collected against this invoice`
    );
  }

  const oldValues = {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    invoiceAmount: invoice.invoiceAmount,
    initialPayment: invoice.initialPayment,
    outstandingAmount: invoice.outstandingAmount,
  };

  invoice.invoiceNumber = invoiceNumber;
  invoice.invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : invoice.invoiceDate;
  invoice.invoiceAmount = invoiceAmount;
  invoice.initialPayment = initialPayment;
  invoice.outstandingAmount = netAmount - alreadyApplied;
  applyInvoiceStatus(invoice);
  await invoice.save();

  await computeCustomerOutstanding(invoice.customerId);

  await logAuditEvent({
    userId: user._id,
    userCode: user.code,
    role: user.role,
    action: AUDIT_ACTIONS.UPDATE_INVOICE,
    entity: 'INVOICE',
    entityId: invoice._id.toString(),
    description: `Updated invoice #${invoice.invoiceNumber}. Amount: ₹${invoiceAmount}, Initial: ₹${initialPayment}`,
    ipAddress,
    metadata: { oldValues, invoiceNumber, invoiceAmount, initialPayment },
  });

  return getInvoiceById(invoice._id);
};

export const getInvoices = async ({ customerId, status, page = 1, limit = 50 }) => {
  const filter = {};
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('customerId', 'shopName ownerName customerCode')
      .populate('createdBy', 'name code')
      .sort({ invoiceDate: -1 })
      .skip(skip)
      .limit(limit),
    Invoice.countDocuments(filter),
  ]);

  return { invoices, total, page, totalPages: Math.ceil(total / limit) };
};

export const getInvoiceById = async (id) => {
  const invoice = await Invoice.findById(id)
    .populate('customerId', 'shopName ownerName mobile address customerCode')
    .populate('createdBy', 'name code');
  if (!invoice) throw new ApiError(404, 'Invoice not found');
  return invoice;
};
