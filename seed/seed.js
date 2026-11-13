require('dotenv').config();
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const Service = require('../models/Service');
const Specialist = require('../models/Specialist');
const Admin = require('../models/Admin');

const services = [
  ['Haircut & Blowdry', 'Hair Artistry', 45, 350, 'Bespoke consultation, revitalizing shampoo, precision cut, and salon finish.'],
  ['Premium Botanical Hair Color', 'Hair Artistry', 120, 1500, 'Ammonia-free organic pigment infusion enriched with argan gloss and deep nourishing hair spa.'],
  ['Keratin Silk Smoothing Treatment', 'Hair Artistry', 180, 2200, 'Frizz control with organic botanical proteins for mirror-like, reflective shine.'],
  ['Rejuvenating Facial', 'Facial & Skin', 60, 800, 'Deep botanical pore cleansing, gentle exfoliation, rose quartz gua sha massage, and collagen sheet.'],
  ['Radiant Hydrafacial Glow', 'Facial & Skin', 75, 1200, 'Deep vortex suction pore cleansing, fruit enzyme peel, and hyaluronic moisture infusion.', true],
  ['Deluxe Manicure and Pedicure', 'Nails & Care', 75, 450, 'Foot soak, dead skin exfoliation, cuticle treatment, hand massage, and long-wear organic polish.'],
  ['Russian Gel Manicure', 'Nails & Care', 45, 650, 'Precision cuticle work with gentle electric filing and long-lasting non-toxic gel glaze.'],
  ['Swedish Full Body Massage', 'Therapeutic Massage', 60, 600, 'Gentle gliding strokes with aromatic ylang-ylang & virgin coconut oils to release muscle tension.'],
  ['Philippine Traditional Hilot', 'Therapeutic Massage', 75, 750, 'Warm banana leaves, cold-pressed virgin coconut oil, and ancestral bodywork techniques.']
].map(([name, category, durationMin, price, description, popular], i) => ({
  name, category, durationMin, price, description, popular: !!popular, sortOrder: i,
  slug: name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}));

const specialists = [
  ['Elena Roa', 'Senior Esthetician & Facial Specialist', 8, 4.98, ['Facial & Skin', 'Spa Packages']],
  ['Maria Santos', 'Master Hair Stylist & Colorist', 8, 5.0, ['Hair Artistry']],
  ['Grace Lim', 'Licensed Massage Therapist', 8, 4.97, ['Therapeutic Massage', 'Spa Packages']],
  ['Camille Javier', 'Nail Care Artisan', 6, 4.97, ['Nails & Care']]
].map(([name, role, yearsExperience, rating, serviceCategories], i) => ({
  name, role, yearsExperience, rating, serviceCategories, sortOrder: i, slug: name.toLowerCase().replace(/\s+/g, '-')
}));

(async () => {
  await connectDB();
  // $setOnInsert: create what's missing but NEVER overwrite prices/descriptions you edited in the admin
  for (const s of services) await Service.updateOne({ slug: s.slug }, { $setOnInsert: s }, { upsert: true });
  for (const s of specialists) await Specialist.updateOne({ slug: s.slug }, { $setOnInsert: s }, { upsert: true });
  // the old demo package is not part of the menu: hide it from guests
  await Service.updateMany({ slug: 'signature-true-radiance-spa-package' }, { $set: { isActive: false, popular: false } });
  if (!(await Service.exists({ isActive: true, popular: true }))) await Service.updateOne({ slug: 'radiant-hydrafacial-glow' }, { $set: { popular: true } });

  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (ADMIN_USERNAME && ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await Admin.updateOne({ username: ADMIN_USERNAME.toLowerCase() }, { $set: { passwordHash, name: ADMIN_NAME || 'Admin' } }, { upsert: true });
    console.log('Admin account ready:', ADMIN_USERNAME);
  }
  console.log(`Seeded ${services.length} services, ${specialists.length} specialists.`);
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });