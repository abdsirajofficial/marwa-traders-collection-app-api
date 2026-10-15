import { Customer } from '../models/Customer.js';
import { Invoice } from '../models/Invoice.js';
import { Payment } from '../models/Payment.js';
import { generateCustomerCode } from '../utils/receiptGenerator.js';
import { logAuditEvent } from './auditService.js';

/**
 * Re-computes customer's actual current outstanding formula:
 * Current Outstanding = Opening Balance + Invoice Amounts - Confirmed Payments
 */
export async function computeCustomerOutstanding(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new Error('Customer not found');

  // Sum of all invoices (invoiceAmount - initialPayment)
  const invoiceAggregation = await Invoice.aggregate([
    { $match: { customerId: customer._id } },
    { $group: { _id: null, totalNetInvoice: { $sum: { $subtract: ['$invoiceAmount', '$initialPayment'] } } } },
  ]);
  const totalNetInvoice = invoiceAggregation[0]?.totalNetInvoice || 0;

  // Sum of all completed payments
  const paymentAggregation = await Payment.aggregate([
    { $match: { customerId: customer._id, status: 'COMPLETED' } },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);
  const totalPaid = paymentAggregation[0]?.totalPaid || 0;

  const currentOutstanding = Math.max(0, (customer.openingBalance || 0) + totalNetInvoice - totalPaid);

  customer.currentOutstanding = currentOutstanding;
  await customer.save();

  return currentOutstanding;
}

export async function createCustomer(data, user) {
  const customerCode = await generateCustomerCode();

  const openingBalance = Number(data.openingBalance || 0);
  const currentOutstanding = openingBalance;

  const customer = await Customer.create({
    customerCode,
    shopName: data.shopName,
    ownerName: data.ownerName,
    mobile: data.mobile,
    address: data.address,
    openingBalance,
    currentOutstanding,
  });

  await logAuditEvent({
    userId: user?._id,
    userCode: user?.code,
    role: user?.role || 'ADMIN',
    action: 'CREATE_CUSTOMER',
    entity: 'CUSTOMER',
    entityId: customer._id.toString(),
    description: `Created customer ${customer.shopName} (${customer.customerCode}) with opening balance ₹${openingBalance}`,
    metadata: { customerCode, openingBalance },
  });

  return customer;
}

export async function updateCustomer(id, data, user) {
  const customer = await Customer.findById(id);
  if (!customer) throw new Error('Customer not found');

  const oldValues = {
    shopName: customer.shopName,
    ownerName: customer.ownerName,
    mobile: customer.mobile,
    address: customer.address,
    openingBalance: customer.openingBalance,
  };

  if (data.shopName) customer.shopName = data.shopName;
  if (data.ownerName) customer.ownerName = data.ownerName;
  if (data.mobile) customer.mobile = data.mobile;
  if (data.address) customer.address = data.address;

  // Opening balance modification requires Owner/Admin authorization and audit
  if (data.openingBalance !== undefined && data.openingBalance !== customer.openingBalance) {
    if (!['OWNER', 'ADMIN'].includes(user.role)) {
      throw new Error('Only Owner or Admin can modify customer opening balance');
    }
    customer.openingBalance = Number(data.openingBalance);
  }

  await customer.save();
  await computeCustomerOutstanding(customer._id);

  await logAuditEvent({
    userId: user?._id,
    userCode: user?.code,
    role: user?.role,
    action: 'UPDATE_CUSTOMER',
    entity: 'CUSTOMER',
    entityId: customer._id.toString(),
    description: `Updated customer details for ${customer.shopName}`,
    metadata: { oldValues, updatedFields: data },
  });

  return customer;
}

export async function searchCustomers(query = '', page = 1, limit = 50) {
  const filter = {};
  if (query && query.trim()) {
    const regex = new RegExp(query.trim(), 'i');
    filter.$or = [
      { shopName: regex },
      { ownerName: regex },
      { mobile: regex },
      { customerCode: regex },
    ];
  }

  const skip = (page - 1) * limit;
  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ shopName: 1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ]);

  return { customers, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getCustomerById(id) {
  const customer = await Customer.findById(id);
  if (!customer) throw new Error('Customer not found');

  const [invoices, payments] = await Promise.all([
    Invoice.find({ customerId: customer._id }).sort({ invoiceDate: -1 }),
    Payment.find({ customerId: customer._id }).populate('collectedBy', 'name code').sort({ createdAt: -1 }),
  ]);

  return { customer, invoices, payments };
}
