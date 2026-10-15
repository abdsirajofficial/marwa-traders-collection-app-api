import { Invoice } from '../models/Invoice.js';
import { Customer } from '../models/Customer.js';
import { computeCustomerOutstanding } from './customerService.js';
import { logAuditEvent } from './auditService.js';

export async function createInvoice(data, user) {
  const customer = await Customer.findById(data.customerId);
  if (!customer) {
    throw new Error('Customer does not exist');
  }

  // Ensure unique invoiceNumber
  const existing = await Invoice.findOne({ invoiceNumber: data.invoiceNumber.trim() });
  if (existing) {
    throw new Error(`Invoice number "${data.invoiceNumber}" already exists`);
  }

  const invoiceAmount = Number(data.invoiceAmount);
  const initialPayment = Number(data.initialPayment || 0);

  if (initialPayment > invoiceAmount) {
    throw new Error('Initial payment cannot be greater than invoice amount');
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

  // Re-calculate customer current outstanding
  await computeCustomerOutstanding(customer._id);

  await logAuditEvent({
    userId: user._id,
    userCode: user.code,
    role: user.role,
    action: 'CREATE_INVOICE',
    entity: 'INVOICE',
    entityId: invoice._id.toString(),
    description: `Created invoice #${invoice.invoiceNumber} for ${customer.shopName} - Amount: ₹${invoiceAmount}, Initial: ₹${initialPayment}`,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount,
      initialPayment,
      outstandingAmount,
      customerId: customer._id,
    },
  });

  return invoice;
}

export async function getInvoices({ customerId, status, page = 1, limit = 50 }) {
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
}

export async function getInvoiceById(id) {
  const invoice = await Invoice.findById(id)
    .populate('customerId', 'shopName ownerName mobile address customerCode')
    .populate('createdBy', 'name code');
  if (!invoice) throw new Error('Invoice not found');
  return invoice;
}
