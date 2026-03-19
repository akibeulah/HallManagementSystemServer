import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Hall from './models/Hall.js';
import Room from './models/Room.js';
import Complaint from './models/Complaint.js';
import Item from './models/Item.js';
import ComplaintHistory from './models/ComplaintHistory.js';

const ASSETS_PER_ROOM = [
  { name: 'Bed',              type: 'furniture',  qtyPerRoom: 4, intervalDays: 365  },
  { name: 'Window',           type: 'furniture',  qtyPerRoom: 2, intervalDays: 730  },
  { name: 'Door',             type: 'furniture',  qtyPerRoom: 2, intervalDays: 730  },
  { name: 'Table',            type: 'furniture',  qtyPerRoom: 2, intervalDays: 365  },
  { name: 'Chair',            type: 'furniture',  qtyPerRoom: 2, intervalDays: 365  },
  { name: 'Socket',           type: 'equipment',  qtyPerRoom: 4, intervalDays: 180  },
  { name: 'Cupboard',         type: 'furniture',  qtyPerRoom: 4, intervalDays: 730  },
  { name: 'Shower',           type: 'equipment',  qtyPerRoom: 1, intervalDays: 180  },
  { name: 'Sink',             type: 'equipment',  qtyPerRoom: 1, intervalDays: 180  },
  { name: 'Toilet',           type: 'equipment',  qtyPerRoom: 1, intervalDays: 180  },
  { name: 'Lighting Fixture', type: 'equipment',  qtyPerRoom: 2, intervalDays: 365  },
  { name: 'Tile Set',         type: 'furniture',  qtyPerRoom: 1, intervalDays: 1825 },
];

const WINGS_PER_FLOOR      = 2;
const ROOMS_PER_WING_FLOOR = 4;
const LARGE_HALLS          = ['Sapphire', 'Topaz'];

function floorLetters(count) {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

const femaleHallNames = [
  'Crystal',
  'Platinum',
  'Diamond',
  'Sapphire',
  'Nyberg',
  'Queen Esther',
  'Fad',
  'Havilah',
  'White Hall',
  'Ogden',
  'Ameyo',
];

const maleHallNames = [
  'Welch',
  'Topaz',
  'Emerald',
  'Neal Wilson',
  'Winslow',
  'Bethel',
  'Samuel Akande',
  'Nelson Mandela',
  'Gedion Troopers',
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Hall.deleteMany({}),
    Room.deleteMany({}),
    Complaint.deleteMany({}),
    Item.deleteMany({}),
    ComplaintHistory.deleteMany({}),
  ]);
  console.log('Cleared existing data (Users, Halls, Rooms, Complaints, Items, ComplaintHistory)\n');

  // ── Super Admin ─────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const admin = await User.create({
    firstname: 'Super',
    lastname: 'Admin',
    email: 'admin@babcock.edu.ng',
    passwordHash,
    gender: 'male',
    role: 'admin',
  });
  console.log(`✔ Super admin created: ${admin.email}  (password: Admin@123)\n`);

  // ── Halls & Rooms ────────────────────────────────────────────────────────────
  const allHalls = [
    ...femaleHallNames.map((name) => ({ name, gender: 'female' })),
    ...maleHallNames.map((name) => ({ name, gender: 'male' })),
  ];

  for (const { name, gender } of allHalls) {
    const hallFloors = LARGE_HALLS.includes(name) ? 9 : 4;
    const hall = await Hall.create({
      name,
      campus: 'Babcock University',
      gender,
      floors: hallFloors,
    });

    const letters = floorLetters(hall.floors);
    const roomDocs = [];

    for (const letter of letters) {
      for (let wing = 1; wing <= WINGS_PER_FLOOR; wing++) {
        for (let room = 1; room <= ROOMS_PER_WING_FLOOR; room++) {
          const roomNumber = `${letter}${wing}${String(room).padStart(2, '0')}`;
          roomDocs.push({ roomNumber, hallId: hall._id });
        }
      }
    }

    await Room.insertMany(roomDocs);

    // Seed assets for this hall (quantities scaled by room count)
    const lastMaintDate = new Date();
    lastMaintDate.setMonth(lastMaintDate.getMonth() - 3);
    const assetDocs = ASSETS_PER_ROOM.map(({ name, type, qtyPerRoom, intervalDays }) => {
      const due = new Date(lastMaintDate);
      due.setDate(due.getDate() + intervalDays);
      return {
        name, type,
        hallId: hall._id,
        quantity: qtyPerRoom * roomDocs.length,
        condition: 'good',
        maintenanceIntervalDays: intervalDays,
        lastMaintenanceDate: lastMaintDate,
        nextMaintenanceDue: due,
      };
    });
    await Item.insertMany(assetDocs);

    console.log(
      `✔ [${gender === 'female' ? 'F' : 'M'}] ${name.padEnd(18)} — ${hall.floors} floors × ${WINGS_PER_FLOOR} wings × ${ROOMS_PER_WING_FLOOR} rooms = ${roomDocs.length} rooms, ${assetDocs.length} asset types`
    );
  }

  // ── Test Maintenance Worker ──────────────────────────────────────────────────
  const workerHash = await bcrypt.hash('Worker@123', 12);
  const maintenanceWorker = await User.create({
    firstname: 'Test',
    lastname: 'Worker',
    email: 'worker@babcock.edu.ng',
    passwordHash: workerHash,
    gender: 'male',
    role: 'maintenance_officer',
    category: 'electrical',
  });
  console.log(`\n✔ Test maintenance worker created: ${maintenanceWorker.email}  (password: Worker@123)`);

  // ── Test Student ─────────────────────────────────────────────────────────────
  // Assign student to the first male hall and its first room
  const maleHall = await Hall.findOne({ gender: 'male' });
  const studentRoom = await Room.findOne({ hallId: maleHall._id });

  const studentHash = await bcrypt.hash('Student@123', 12);
  const student = await User.create({
    firstname: 'Test',
    lastname: 'Student',
    email: 'student@babcock.edu.ng',
    passwordHash: studentHash,
    gender: 'male',
    role: 'student',
    hallId: maleHall._id,
    roomId: studentRoom._id,
  });
  console.log(`✔ Test student created: ${student.email}  (password: Student@123)`);
  console.log(`  Assigned to: ${maleHall.name} — Room ${studentRoom.roomNumber}`);

  // ── Give test hall's items varied conditions for visual realism ──────────────
  const maleHallItems = await Item.find({ hallId: maleHall._id });
  const itemByName = {};
  maleHallItems.forEach((item) => { itemByName[item.name] = item; });

  const conditionOverrides = {
    'Socket':           'poor',
    'Shower':           'fair',
    'Lighting Fixture': 'condemned',
    'Door':             'fair',
    'Sink':             'poor',
  };
  for (const [name, condition] of Object.entries(conditionOverrides)) {
    if (itemByName[name]) {
      await Item.findByIdAndUpdate(itemByName[name]._id, { condition });
    }
  }
  // Reload after updates
  const updatedItems = await Item.find({ hallId: maleHall._id });
  const itemMap = {};
  updatedItems.forEach((item) => { itemMap[item.name] = item; });
  console.log('\n✔ Varied item conditions on test hall assets');

  // ── Test Complaints ──────────────────────────────────────────────────────────
  const testComplaints = [
    {
      message: 'The ceiling light in my room is completely dead and was condemned during last check.',
      category: 'electrical',
      priority: 'urgent',
      status: 'logged',
      itemIds: [itemMap['Lighting Fixture']?._id].filter(Boolean),
    },
    {
      message: 'The water tap in the bathroom is leaking continuously.',
      category: 'plumbing',
      priority: 'high',
      status: 'seen',
      itemIds: [itemMap['Sink']?._id, itemMap['Shower']?._id].filter(Boolean),
    },
    {
      message: 'The door hinge is broken and the door cannot close properly.',
      category: 'metalwork',
      priority: 'medium',
      status: 'work_in_progress',
      itemIds: [itemMap['Door']?._id].filter(Boolean),
      assignedTo: maintenanceWorker._id,
      assignedBy: admin._id,
    },
    {
      message: 'The wardrobe shelf has collapsed and needs to be replaced.',
      category: 'woodwork',
      priority: 'low',
      status: 'logged',
      itemIds: [itemMap['Cupboard']?._id].filter(Boolean),
    },
    {
      message: 'Power socket near the window is sparking and not working.',
      category: 'electrical',
      priority: 'urgent',
      status: 'seen',
      itemIds: [itemMap['Socket']?._id].filter(Boolean),
      assignedTo: maintenanceWorker._id,
      assignedBy: admin._id,
    },
  ];

  for (const data of testComplaints) {
    await Complaint.create({
      ...data,
      userId: student._id,
      roomId: studentRoom._id,
    });
  }
  console.log(`\n✔ 5 test complaints created for student ${student.email} (with item references)`);

  console.log('\nSeeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});