/**
 * Enigoal — MongoDB Seeder
 * Run: node src/seed.js
 *
 * Seeds the database with 105 schemes + default admin and user accounts.
 * Safe to run multiple times — skips if data already exists.
 */

require('dotenv').config();
const mongoose    = require('mongoose');
const User        = require('./models/User');
const Scheme      = require('./models/Scheme');
const ActivityLog = require('./models/ActivityLog');
const bcrypt      = require('bcryptjs');
const { SCHEMES } = require('../seed-data');

async function seed() {
  console.log('\n🌱 Enigoal — MongoDB Seeder\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/enigoal');
  console.log('✅ Connected to MongoDB\n');

  // ── Users ─────────────────────────────────────────────────────
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const adminHash = await bcrypt.hash('enigoal123', 10);
    const userHash  = await bcrypt.hash('user123', 10);
    await User.create([
      { name: 'Admin', email: 'admin@enigoal.in', password: adminHash, plainPassword: 'enigoal123', role: 'admin' },
      { name: 'User',  email: 'user@enigoal.in',  password: userHash,  plainPassword: 'user123',    role: 'user'  },
    ]);
    console.log('✅ Seeded 2 users:');
    console.log('   admin@enigoal.in  /  enigoal123  (admin)');
    console.log('   user@enigoal.in   /  user123     (user)');
  } else {
    console.log(`⏭  Users already seeded (${userCount} found)`);
  }

  // ── Schemes ───────────────────────────────────────────────────
  const schemeCount = await Scheme.countDocuments();
  if (schemeCount === 0) {
    const docs = SCHEMES.map(s => ({
      legacyId:        s.id,
      name:            s.name,
      category:        s.category,
      status:          s.status          || 'Active',
      organization:    s.organization    || '',
      type:            s.type            || 'Government Scheme',
      lastDate:        s.lastDate        || 'Rolling basis',
      minCharge:       s.minCharge       || '',
      applicableFor:   s.applicableFor   || 'Pan India',
      location:        s.location        || 'Pan India',
      portalLink:      s.portalLink      || '',
      maxFunding:      s.maxFunding      || '',
      tags:            s.tags            || [],
      benefits:        s.benefits        || [],
      eligibility:     s.eligibility     || [],
      focusSectors:    s.focusSectors    || [],
      industrySectors: s.industrySectors || [],
      companyTypes:    s.companyTypes    || [],
    }));

    await Scheme.insertMany(docs);
    console.log(`✅ Seeded ${docs.length} schemes`);
  } else {
    console.log(`⏭  Schemes already seeded (${schemeCount} found)`);
  }

  // ── Activity log ──────────────────────────────────────────────
  await ActivityLog.create({
    action:      'LOGIN',
    description: 'Database seeded successfully',
    userEmail:   'system',
  });

  console.log('\n✨ Seeding complete!\n');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});