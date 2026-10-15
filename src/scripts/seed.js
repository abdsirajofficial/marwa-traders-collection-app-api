import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { User, Customer, Invoice, Payment, Settlement, AuditLog, NotificationLog, PaymentCorrection } from '../models/index.js';
import { generateReceiptNumber, generateSettlementNumber } from '../utils/receiptGenerator.js';

async function seedDatabase() {
  console.log(`[Seed] Connecting to MongoDB at ${config.mongodbUri}...`);
  await mongoose.connect(config.mongodbUri);

  console.log('[Seed] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    Customer.deleteMany({}),
    Invoice.deleteMany({}),
    Payment.deleteMany({}),
    Settlement.deleteMany({}),
    AuditLog.deleteMany({}),
    NotificationLog.deleteMany({}),
    PaymentCorrection.deleteMany({}),
  ]);

  console.log('[Seed] Seeding Users with exact code logins...');
  const users = await User.insertMany([
    {
      code: '1001',
      name: 'Marwa Owner',
      role: 'OWNER',
      phone: '9876543210',
      isActive: true,
      permissions: ['ALL'],
    },
    {
      code: '2001',
      name: 'Admin',
      role: 'ADMIN',
      phone: '9876543211',
      isActive: true,
      permissions: ['MANAGE_CUSTOMERS', 'MANAGE_INVOICES', 'MANAGE_SETTLEMENTS'],
    },
    {
      code: '3001',
      name: 'Staff',
      role: 'STAFF',
      phone: '9876543212',
      isActive: true,
      permissions: ['CREATE_INVOICE'],
    },
    {
      code: '4001',
      name: 'Ravi',
      role: 'CASH_COLLECTOR',
      phone: '9876543213',
      isActive: true,
    },
    {
      code: '4002',
      name: 'Kumar',
      role: 'CASH_COLLECTOR',
      phone: '9876543214',
      isActive: true,
    },
  ]);

  const owner = users.find((u) => u.code === '1001');
  const admin = users.find((u) => u.code === '2001');
  const ravi = users.find((u) => u.code === '4001');
  const kumar = users.find((u) => u.code === '4002');

  console.log('[Seed] Seeding Sample Customers...');
  // Customer 1: ABC Electricals (Opening Balance ₹75,000)
  const customer1 = await Customer.create({
    customerCode: 'CUS-000001',
    shopName: 'ABC Electricals',
    ownerName: 'Kumar',
    mobile: '9876543210',
    address: 'Salem Main Bazaar, Salem',
    openingBalance: 75000,
    currentOutstanding: 105000, // 75000 opening + 40000 invoice - 10000 payment = 105000
  });

  // Customer 2: RK Traders
  const customer2 = await Customer.create({
    customerCode: 'CUS-000002',
    shopName: 'RK Traders',
    ownerName: 'Ramesh',
    mobile: '9845123456',
    address: 'Opposite Clock Tower, Erode',
    openingBalance: 40000,
    currentOutstanding: 40000,
  });

  // Customer 3: New Star Electricals
  const customer3 = await Customer.create({
    customerCode: 'CUS-000003',
    shopName: 'New Star Electricals',
    ownerName: 'Syed Ibrahim',
    mobile: '9944012345',
    address: 'Gandhi Road, Trichy',
    openingBalance: 15000,
    currentOutstanding: 50000,
  });

  console.log('[Seed] Seeding Sample Invoices...');
  // Invoices for ABC Electricals
  const inv1 = await Invoice.create({
    invoiceNumber: 'INV-2026-001',
    customerId: customer1._id,
    invoiceDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    invoiceAmount: 50000,
    initialPayment: 10000,
    outstandingAmount: 30000, // 40000 - 10000 paid later = 30000
    status: 'PARTIALLY_PAID',
    createdBy: admin._id,
  });

  // Invoices for New Star Electricals
  const inv2 = await Invoice.create({
    invoiceNumber: 'INV-2026-002',
    customerId: customer3._id,
    invoiceDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    invoiceAmount: 35000,
    initialPayment: 0,
    outstandingAmount: 35000,
    status: 'UNPAID',
    createdBy: admin._id,
  });

  console.log('[Seed] Seeding Sample Payment...');
  const receiptNum = await generateReceiptNumber();
  const payment1 = await Payment.create({
    receiptNumber: receiptNum,
    customerId: customer1._id,
    amount: 10000,
    previousOutstanding: 115000,
    remainingOutstanding: 105000,
    paymentMode: 'CASH',
    collectedBy: ravi._id,
    location: {
      locationName: 'ABC Electricals, Salem',
      latitude: 11.6643,
      longitude: 78.1460,
    },
    status: 'COMPLETED',
    allocations: [
      {
        invoiceId: inv1._id,
        amountAllocated: 10000,
      },
    ],
    settled: false,
    createdAt: new Date(),
  });

  console.log('[Seed] Seeding Initial Audit Logs...');
  await AuditLog.create([
    {
      userId: owner._id,
      userCode: owner.code,
      role: 'OWNER',
      action: 'SYSTEM_INITIALIZATION',
      entity: 'SYSTEM',
      description: 'System database initialized with default roles and baseline master data',
    },
    {
      userId: admin._id,
      userCode: admin.code,
      role: 'ADMIN',
      action: 'CREATE_CUSTOMER',
      entity: 'CUSTOMER',
      entityId: customer1._id.toString(),
      description: `Created customer ${customer1.shopName} (CUS-000001) with opening balance ₹75,000`,
    },
    {
      userId: ravi._id,
      userCode: ravi.code,
      role: 'CASH_COLLECTOR',
      action: 'CREATE_PAYMENT',
      entity: 'PAYMENT',
      entityId: payment1._id.toString(),
      description: `Cash payment of ₹10,000 collected for ${customer1.shopName} by Ravi. Receipt: ${receiptNum}`,
    },
  ]);

  console.log('======================================================');
  console.log(' SEEDING COMPLETED SUCCESSFULLY!');
  console.log(' Test Login Codes:');
  console.log(' - 1001 : Marwa Owner  (Role: OWNER)');
  console.log(' - 2001 : Admin        (Role: ADMIN)');
  console.log(' - 3001 : Staff        (Role: STAFF)');
  console.log(' - 4001 : Ravi         (Role: CASH_COLLECTOR)');
  console.log(' - 4002 : Kumar        (Role: CASH_COLLECTOR)');
  console.log('======================================================');

  await mongoose.connection.close();
}

seedDatabase().catch((err) => {
  console.error('[Seed] Error seeding database:', err);
  process.exit(1);
});
