import { Customer } from './customer.model.js';
import { Invoice } from '../invoice/invoice.model.js';
import { Payment } from '../payment/payment.model.js';
import { generateCustomerCode } from './customer.helper.js';
import { logAuditEvent } from '../audit-log/audit-log.service.js';
import { ApiError } from '../../common/utils/api-error.util.js';
import { AUDIT_ACTIONS, ROLES } from '../../common/utils/constants.js';

export const computeCustomerOutstanding = async (customerId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const invoiceAggregation = await Invoice.aggregate([
    { $match: { customerId: customer._id } },
    { $group: { _id: null, totalNetInvoice: { $sum: { $subtract: ['$invoiceAmount', '$initialPayment'] } } } },
  ]);
  const totalNetInvoice = invoiceAggregation[0]?.totalNetInvoice || 0;

  const paymentAggregation = await Payment.aggregate([
    { $match: { customerId: customer._id, status: 'COMPLETED' } },
    { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
  ]);
  const totalPaid = paymentAggregation[0]?.totalPaid || 0;

  const currentOutstanding = Math.max(0, (customer.openingBalance || 0) + totalNetInvoice - totalPaid);

  customer.currentOutstanding = currentOutstanding;
  await customer.save();

  return currentOutstanding;
};

export const createCustomer = async (data, user, ipAddress = null) => {
  const customerCode = await generateCustomerCode();
  const openingBalance = Number(data.openingBalance || 0);

  const customer = await Customer.create({
    customerCode,
    shopName: data.shopName,
    ownerName: data.ownerName,
    mobile: data.mobile,
    address: data.address,
    openingBalance,
    currentOutstanding: openingBalance,
  });

  await logAuditEvent({
    userId: user?._id,
    userCode: user?.code,
    role: user?.role || ROLES.ADMIN,
    action: AUDIT_ACTIONS.CREATE_CUSTOMER,
    entity: 'CUSTOMER',
    entityId: customer._id.toString(),
    description: `Created customer ${customer.shopName} (${customer.customerCode}) with opening balance ₹${openingBalance}`,
    ipAddress,
    metadata: { customerCode, openingBalance },
  });

  return customer;
};

export const updateCustomer = async (id, data, user, ipAddress = null) => {
  if (user?.role !== ROLES.OWNER) {
    throw new ApiError(403, 'Only the Owner can edit customers');
  }

  const customer = await Customer.findById(id);
  if (!customer) throw new ApiError(404, 'Customer not found');

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

  if (data.openingBalance !== undefined && Number(data.openingBalance) !== customer.openingBalance) {
    const openingBalance = Number(data.openingBalance);
    if (Number.isNaN(openingBalance) || openingBalance < 0) {
      throw new ApiError(400, 'Opening balance must be a non-negative number');
    }
    customer.openingBalance = openingBalance;
  }

  await customer.save();
  await computeCustomerOutstanding(customer._id);

  await logAuditEvent({
    userId: user?._id,
    userCode: user?.code,
    role: user?.role,
    action: AUDIT_ACTIONS.UPDATE_CUSTOMER,
    entity: 'CUSTOMER',
    entityId: customer._id.toString(),
    description: `Updated customer details for ${customer.shopName}`,
    ipAddress,
    metadata: { oldValues, updatedFields: data },
  });

  return customer;
};

export const searchCustomers = async (query = '', page = 1, limit = 50) => {
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
};

export const getCustomerById = async (id) => {
  const customer = await Customer.findById(id);
  if (!customer) throw new ApiError(404, 'Customer not found');

  const [invoices, payments] = await Promise.all([
    Invoice.find({ customerId: customer._id }).sort({ invoiceDate: -1 }),
    Payment.find({ customerId: customer._id }).populate('collectedBy', 'name code').sort({ createdAt: -1 }),
  ]);

  return { customer, invoices, payments };
};
