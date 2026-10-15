import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/marwa_traders';

async function resetDatabasePreserveUsers() {
  try {
    console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('\n--- Current Collections Before Reset ---');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(` - ${col.name}: ${count} documents`);
    }

    console.log('\nClearing all collections except "users"...');

    for (const col of collections) {
      if (col.name !== 'users') {
        const deleted = await db.collection(col.name).deleteMany({});
        console.log(` ✓ Cleared "${col.name}": removed ${deleted.deletedCount} documents`);
      }
    }

    // Insert a single clean baseline audit event
    const ownerUser = await db.collection('users').findOne({ role: 'OWNER' });
    if (ownerUser) {
      await db.collection('auditlogs').insertOne({
        userId: ownerUser._id,
        userCode: ownerUser.code,
        role: ownerUser.role,
        action: 'SYSTEM_RESET',
        entity: 'DATABASE',
        description: 'Database cleared by user request: All transaction, invoice, payment, and customer data removed. Users preserved.',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(' ✓ Logged clean baseline audit entry.');
    }

    console.log('\n--- Collections Status After Reset ---');
    const updatedCollections = await db.listCollections().toArray();
    for (const col of updatedCollections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(` - ${col.name}: ${count} documents`);
    }

    console.log('\n✓ Database reset complete! Only users (and baseline audit record) preserved.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error resetting database:', err);
    process.exit(1);
  }
}

resetDatabasePreserveUsers();
