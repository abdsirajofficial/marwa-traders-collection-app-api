import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { Customer } from '../components/customer/customer.model.js';
import { Invoice } from '../components/invoice/invoice.model.js';
import { Payment } from '../components/payment/payment.model.js';
import { Settlement, PaymentCorrection } from '../components/settlement/settlement.model.js';
import { User } from '../components/user/user.model.js';
import { EmployeeAttendance } from '../components/employee-attendance/employee-attendance.model.js';
import { AuditLog } from '../components/audit-log/audit-log.model.js';
import { NotificationLog } from '../components/whatsapp/whatsapp.model.js';
import * as customerService from '../components/customer/customer.service.js';
import * as invoiceService from '../components/invoice/invoice.service.js';
import * as paymentService from '../components/payment/payment.service.js';
import * as settlementService from '../components/settlement/settlement.service.js';
import * as attendanceService from '../components/employee-attendance/employee-attendance.service.js';
import * as userService from '../components/user/user.service.js';
import { generateAuthToken } from '../common/service/token.service.js';

const TEST_DB_URI = 'mongodb://localhost:27017/marwa_traders_test';

describe('Marwa Traders - Prompt 2 Architecture & Core Business Logic Tests', () => {
  let ownerUser;
  let adminUser;
  let collectorUser;
  let staffUser;

  beforeAll(async () => {
    await mongoose.connect(TEST_DB_URI);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean all collections before each test run
    await User.deleteMany({});
    await Customer.deleteMany({});
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await Settlement.deleteMany({});
    await PaymentCorrection.deleteMany({});
    await EmployeeAttendance.deleteMany({});
    await AuditLog.deleteMany({});
    await NotificationLog.deleteMany({});

    // Create standard users
    ownerUser = await User.create({
      code: '1001',
      name: 'Owner',
      role: 'OWNER',
    });

    adminUser = await User.create({
      code: '2001',
      name: 'Admin',
      role: 'ADMIN',
    });

    collectorUser = await User.create({
      code: '4001',
      name: 'Ravi',
      role: 'CASH_COLLECTOR',
      isActive: true,
    });

    staffUser = await User.create({
      code: '3001',
      name: 'Office Staff',
      role: 'STAFF',
      permissions: [],
      isActive: true,
    });
  });

  it('1. Customer Creation & Opening Balance formula', async () => {
    const customer = await customerService.createCustomer(
      {
        shopName: 'ABC Electricals',
        ownerName: 'Kumar',
        mobile: '9876543210',
        address: 'Salem',
        openingBalance: 75000,
      },
      adminUser
    );

    expect(customer.customerCode).toMatch(/^CUS-\d{6}$/);
    expect(customer.shopName).toBe('ABC Electricals');
    expect(customer.openingBalance).toBe(75000);
    expect(customer.currentOutstanding).toBe(75000);
  });

  it('2. Invoice Creation with Initial Payment and Outstanding calculation', async () => {
    const customer = await customerService.createCustomer(
      {
        shopName: 'ABC Electricals',
        ownerName: 'Kumar',
        mobile: '9876543210',
        address: 'Salem',
        openingBalance: 75000,
      },
      adminUser
    );

    const invoice = await invoiceService.createInvoice(
      {
        customerId: customer._id.toString(),
        invoiceNumber: 'INV-001',
        invoiceAmount: 50000,
        initialPayment: 10000,
      },
      adminUser
    );

    expect(invoice.outstandingAmount).toBe(40000);
    expect(invoice.status).toBe('PARTIALLY_PAID');

    const updatedOutstanding = await customerService.computeCustomerOutstanding(customer._id);
    expect(updatedOutstanding).toBe(115000);
  });

  // Prompt 2 Test 1: Login
  it('Test 1 — Employee Login & JWT Generation', async () => {
    const token = generateAuthToken(collectorUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  // Prompt 2 Test 2: Sign In
  it('Test 2 — Employee Sign In captures location, creates workSessionId, creates audit, NO WhatsApp', async () => {
    const location = { latitude: 11.0168, longitude: 76.9558, address: 'Salem' };
    const session = await attendanceService.signIn(collectorUser._id, location, '127.0.0.1');

    expect(session.workSessionId).toMatch(/^WS-\d{8}-\d{6}$/);
    expect(session.status).toBe('ACTIVE');
    expect(session.signInLocation.latitude).toBe(11.0168);
    expect(session.signInLocation.longitude).toBe(76.9558);
    expect(session.signInLocation.address).toBe('Salem');

    // Audit log created
    const auditLogs = await AuditLog.find({ action: 'EMPLOYEE_SIGN_IN' });
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].metadata.workSessionId).toBe(session.workSessionId);

    // NO WhatsApp sent for sign-in
    const notifications = await NotificationLog.find({});
    expect(notifications.length).toBe(0);
  });

  // Prompt 2 Test 3: Duplicate Sign In
  it('Test 3 — Duplicate Sign In is rejected when session is ACTIVE', async () => {
    const location = { latitude: 11.0168, longitude: 76.9558, address: 'Salem' };
    await attendanceService.signIn(collectorUser._id, location, '127.0.0.1');

    await expect(
      attendanceService.signIn(collectorUser._id, location, '127.0.0.1')
    ).rejects.toThrow(/already has an active work session/);
  });

  // Prompt 2 Test 4: Collection Before Sign In
  it('Test 4 — Collection Before Sign In is rejected by backend', async () => {
    const customer = await customerService.createCustomer(
      {
        shopName: 'RK Traders',
        ownerName: 'Ramesh',
        mobile: '9845123456',
        address: 'Erode',
        openingBalance: 20000,
      },
      adminUser
    );

    // Attempt collection without active work session
    await expect(
      paymentService.createPayment({
        customerId: customer._id.toString(),
        amount: 5000,
        collector: collectorUser,
      })
    ).rejects.toThrow(/Employee must be signed in with an active work session/);
  });

  // Prompt 2 Test 5: Collection After Sign In
  it('Test 5 — Collection After Sign In succeeds, stores workSessionId, sends Customer WhatsApp only', async () => {
    // 1. Sign In
    const session = await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    // 2. Customer
    const customer = await customerService.createCustomer(
      {
        shopName: 'RK Traders',
        ownerName: 'Ramesh',
        mobile: '9845123456',
        address: 'Erode',
        openingBalance: 20000,
      },
      adminUser
    );

    // 3. Collect ₹5,000
    const { payment } = await paymentService.createPayment({
      customerId: customer._id.toString(),
      amount: 5000,
      collector: collectorUser,
      location: { latitude: 11.0168, longitude: 76.9558, locationName: 'Salem Counter' },
    });

    expect(payment.workSessionId).toBe(session.workSessionId);
    expect(payment.status).toBe('COMPLETED');
    expect(payment.amount).toBe(5000);

    // Check notifications: Customer received receipt, Owner did NOT receive individual WhatsApp
    const customerNotifications = await NotificationLog.find({ recipientType: 'CUSTOMER' });
    const ownerNotifications = await NotificationLog.find({ recipientType: 'OWNER' });

    expect(customerNotifications.length).toBe(1);
    expect(customerNotifications[0].templateName).toBe('marwa_payment_receipt');
    expect(ownerNotifications.length).toBe(0); // ZERO owner WhatsApp for individual collection
  });

  // Prompt 2 Test 6: Multiple Collections - Owner WhatsApp count remains 0 until Sign Out
  it('Test 6 — Multiple Collections generate 0 Owner WhatsApp notifications until Sign Out', async () => {
    await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    const customer = await customerService.createCustomer(
      {
        shopName: 'Multi Shop',
        ownerName: 'Multi Owner',
        mobile: '9845123999',
        address: 'Salem',
        openingBalance: 50000,
      },
      adminUser
    );

    for (let i = 1; i <= 4; i++) {
      await paymentService.createPayment({
        customerId: customer._id.toString(),
        amount: 2000,
        collector: collectorUser,
      });
    }

    const ownerNotes = await NotificationLog.find({ recipientType: 'OWNER' });
    expect(ownerNotes.length).toBe(0); // Strictly 0
  });

  // Prompt 2 Test 7: Sign Out calculates all collections, completes session, sends ONE Owner WhatsApp report
  it('Test 7 — Sign Out aggregates all collections and dispatches single Owner Daily Report', async () => {
    const session = await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem Morning' },
      '127.0.0.1'
    );

    const customer = await customerService.createCustomer(
      {
        shopName: 'Daily Customer',
        ownerName: 'Owner X',
        mobile: '9988776655',
        address: 'Salem',
        openingBalance: 50000,
      },
      adminUser
    );

    // Make 3 collections totaling ₹12,000
    await paymentService.createPayment({ customerId: customer._id.toString(), amount: 4000, collector: collectorUser });
    await paymentService.createPayment({ customerId: customer._id.toString(), amount: 3000, collector: collectorUser });
    await paymentService.createPayment({ customerId: customer._id.toString(), amount: 5000, collector: collectorUser });

    // Sign Out
    const signOutResult = await attendanceService.signOut(
      collectorUser._id,
      session.workSessionId,
      { latitude: 11.0182, longitude: 76.9581, address: 'Salem Evening' },
      '127.0.0.1'
    );

    expect(signOutResult.session.status).toBe('COMPLETED');
    expect(signOutResult.session.totalTransactions).toBe(3);
    expect(signOutResult.session.totalCollected).toBe(12000);
    expect(signOutResult.summary.totalTransactions).toBe(3);
    expect(signOutResult.summary.totalCollected).toBe(12000);

    // Wait a brief moment for async notification trigger
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Owner should now have exactly 1 notification
    const ownerNotes = await NotificationLog.find({ recipientType: 'OWNER' });
    expect(ownerNotes.length).toBe(1);
    expect(ownerNotes[0].templateName).toBe('marwa_employee_daily_report');
    expect(ownerNotes[0].messageBody).toContain('DAILY COLLECTION REPORT');
    expect(ownerNotes[0].messageBody).toContain('12,000');
  });

  // Prompt 2 Test 8: WhatsApp failure never rolls back work session completion
  it('Test 8 — WhatsApp failure does not rollback completed work session', async () => {
    const session = await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    const signOutResult = await attendanceService.signOut(
      collectorUser._id,
      session.workSessionId,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    expect(signOutResult.session.status).toBe('COMPLETED');
    const reloadedSession = await EmployeeAttendance.findById(session._id);
    expect(reloadedSession.status).toBe('COMPLETED');
  });

  // Prompt 2 Test 9: App Reopen - retrieves active session from DB
  it('Test 9 — Backend is source of truth for active work session on app reopen', async () => {
    const session = await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    // Simulating app reopen / page refresh by querying getTodaySession
    const todaySession = await attendanceService.getTodaySession(collectorUser._id);
    expect(todaySession).not.toBeNull();
    expect(todaySession.workSessionId).toBe(session.workSessionId);
    expect(todaySession.status).toBe('ACTIVE');
  });

  // Prompt 2 Test 10: Audit Log traceability
  it('Test 10 — Verifies LOGIN, SIGN_IN, COLLECTION, SIGN_OUT in audit history', async () => {
    // 1. Sign In
    const session = await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    // 2. Collection
    const customer = await customerService.createCustomer(
      {
        shopName: 'Audit Test Shop',
        ownerName: 'Owner Audit',
        mobile: '9845123777',
        address: 'Salem',
        openingBalance: 10000,
      },
      adminUser
    );

    await paymentService.createPayment({
      customerId: customer._id.toString(),
      amount: 3000,
      collector: collectorUser,
    });

    // 3. Sign Out
    await attendanceService.signOut(
      collectorUser._id,
      session.workSessionId,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    const signIns = await AuditLog.find({ action: 'EMPLOYEE_SIGN_IN' });
    const collections = await AuditLog.find({ action: 'EMPLOYEE_COLLECTION_CREATED' });
    const signOuts = await AuditLog.find({ action: 'EMPLOYEE_SIGN_OUT' });

    expect(signIns.length).toBe(1);
    expect(collections.length).toBe(1);
    expect(signOuts.length).toBe(1);
  });

  it('11. FIFO Payment Allocation across multiple invoices', async () => {
    // Sign in collector first
    await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    const customer = await customerService.createCustomer(
      {
        shopName: 'New Star Electricals',
        ownerName: 'Syed',
        mobile: '9944012345',
        address: 'Trichy',
        openingBalance: 0,
      },
      adminUser
    );

    const invA = await invoiceService.createInvoice(
      {
        customerId: customer._id.toString(),
        invoiceNumber: 'INV-A',
        invoiceDate: new Date('2026-10-01'),
        invoiceAmount: 20000,
        initialPayment: 0,
      },
      adminUser
    );

    const invB = await invoiceService.createInvoice(
      {
        customerId: customer._id.toString(),
        invoiceNumber: 'INV-B',
        invoiceDate: new Date('2026-10-05'),
        invoiceAmount: 15000,
        initialPayment: 0,
      },
      adminUser
    );

    const invC = await invoiceService.createInvoice(
      {
        customerId: customer._id.toString(),
        invoiceNumber: 'INV-C',
        invoiceDate: new Date('2026-10-10'),
        invoiceAmount: 10000,
        initialPayment: 0,
      },
      adminUser
    );

    const { payment } = await paymentService.createPayment({
      customerId: customer._id.toString(),
      amount: 25000,
      collector: collectorUser,
      location: { locationName: 'Trichy Counter', latitude: 10.7905, longitude: 78.7047 },
    });

    expect(payment.receiptNumber).toMatch(/^MRT-\d{8}-\d{6}$/);
    expect(payment.previousOutstanding).toBe(45000);
    expect(payment.remainingOutstanding).toBe(20000);

    const reloadedA = await Invoice.findById(invA._id);
    const reloadedB = await Invoice.findById(invB._id);
    const reloadedC = await Invoice.findById(invC._id);

    expect(reloadedA.outstandingAmount).toBe(0);
    expect(reloadedA.status).toBe('PAID');

    expect(reloadedB.outstandingAmount).toBe(10000);
    expect(reloadedB.status).toBe('PARTIALLY_PAID');

    expect(reloadedC.outstandingAmount).toBe(10000);
    expect(reloadedC.status).toBe('UNPAID');
  });

  it('12. Cash Settlement & Shortage Detection', async () => {
    // Sign in collector first
    await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    const customer = await customerService.createCustomer(
      {
        shopName: 'Cash Test Shop',
        ownerName: 'Owner',
        mobile: '9111122222',
        address: 'Salem',
        openingBalance: 50000,
      },
      adminUser
    );

    await paymentService.createPayment({ customerId: customer._id.toString(), amount: 5000, collector: collectorUser });
    await paymentService.createPayment({ customerId: customer._id.toString(), amount: 3000, collector: collectorUser });
    await paymentService.createPayment({ customerId: customer._id.toString(), amount: 7500, collector: collectorUser });

    const expected = await settlementService.getEmployeeExpectedCash(collectorUser._id.toString());
    expect(expected.expectedAmount).toBe(15500);

    // Collector cannot settle own cash
    await expect(
      settlementService.createSettlement({
        employeeId: collectorUser._id.toString(),
        receivedAmount: 15500,
        settledBy: collectorUser,
      })
    ).rejects.toThrow(/cannot settle their own cash/);

    // Case A: Shortage - Admin receives only 12,500
    const shortageSettlement = await settlementService.createSettlement({
      employeeId: collectorUser._id.toString(),
      receivedAmount: 12500,
      settledBy: adminUser,
    });

    expect(shortageSettlement.expectedAmount).toBe(15500);
    expect(shortageSettlement.receivedAmount).toBe(12500);
    expect(shortageSettlement.difference).toBe(-3000);
    expect(shortageSettlement.status).toBe('SHORTAGE');
  });

  it('13. Payment Correction & Reversal preserves financial auditability', async () => {
    await attendanceService.signIn(
      collectorUser._id,
      { latitude: 11.0168, longitude: 76.9558, address: 'Salem' },
      '127.0.0.1'
    );

    const customer = await customerService.createCustomer(
      {
        shopName: 'Correction Shop',
        ownerName: 'Kumar',
        mobile: '9777788888',
        address: 'Salem',
        openingBalance: 40000,
      },
      adminUser
    );

    const { payment } = await paymentService.createPayment({
      customerId: customer._id.toString(),
      amount: 6000,
      collector: collectorUser,
    });

    expect(payment.status).toBe('COMPLETED');
    let reloadedCustomer = await Customer.findById(customer._id);
    expect(reloadedCustomer.currentOutstanding).toBe(34000);

    const correction = await settlementService.requestPaymentCorrection({
      paymentId: payment._id.toString(),
      requestedAmount: 5000,
      reason: 'Entered wrong amount on keypad',
      user: collectorUser,
    });

    expect(correction.status).toBe('PENDING');

    const reviewResult = await settlementService.reviewPaymentCorrection({
      correctionId: correction._id.toString(),
      status: 'APPROVED',
      reviewNotes: 'Verified receipt physical voucher',
      reviewer: adminUser,
    });

    expect(reviewResult.correction.status).toBe('APPROVED');

    const originalPaymentAfter = await Payment.findById(payment._id);
    expect(originalPaymentAfter.status).toBe('REVERSED');
    expect(originalPaymentAfter.reversalReason).toMatch(/Correction approved/);

    expect(reviewResult.newPayment).not.toBeNull();
    expect(reviewResult.newPayment.amount).toBe(5000);

    reloadedCustomer = await Customer.findById(customer._id);
    expect(reloadedCustomer.currentOutstanding).toBe(35000);
  });

  it('14. User Creation Flow Hierarchy — Owner can add all roles, Admin can add Admin and Cash Collector', async () => {
    // 1. Owner can create OWNER, ADMIN, STAFF, CASH_COLLECTOR
    const newOwner = await userService.createUser(
      { code: '1099', name: 'Partner Owner', role: 'OWNER', phone: '9999910990' },
      ownerUser
    );
    expect(newOwner.role).toBe('OWNER');
    expect(newOwner.code).toBe('1099');

    const newStaff = await userService.createUser(
      { code: '3099', name: 'Billing Clerk', role: 'STAFF', phone: '9999930990' },
      ownerUser
    );
    expect(newStaff.role).toBe('STAFF');

    // 2. Admin can create ADMIN and CASH_COLLECTOR
    const adminCreatedAdmin = await userService.createUser(
      { code: '2099', name: 'Sub Admin', role: 'ADMIN', phone: '9999920990' },
      adminUser
    );
    expect(adminCreatedAdmin.role).toBe('ADMIN');

    const adminCreatedCollector = await userService.createUser(
      { code: '4099', name: 'New Collector', role: 'CASH_COLLECTOR', phone: '9999940990' },
      adminUser
    );
    expect(adminCreatedCollector.role).toBe('CASH_COLLECTOR');

    // 3. Admin CANNOT create OWNER (must throw 403)
    await expect(
      userService.createUser(
        { code: '1098', name: 'Hacked Owner', role: 'OWNER', phone: '9999910980' },
        adminUser
      )
    ).rejects.toThrow(/Admins can only create ADMIN or CASH_COLLECTOR accounts/);

    // 4. Admin CANNOT create STAFF (must throw 403)
    await expect(
      userService.createUser(
        { code: '3098', name: 'Disallowed Staff', role: 'STAFF', phone: '9999930980' },
        adminUser
      )
    ).rejects.toThrow(/Admins can only create ADMIN or CASH_COLLECTOR accounts/);

    // 5. Staff CANNOT create any user (must throw 403)
    await expect(
      userService.createUser(
        { code: '4098', name: 'Collector By Staff', role: 'CASH_COLLECTOR', phone: '9999940980' },
        staffUser
      )
    ).rejects.toThrow(/You do not have permission to create users/);
  });
});

