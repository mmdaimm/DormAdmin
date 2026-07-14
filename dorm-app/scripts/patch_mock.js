const fs = require('fs');

const path = 'e:/Project/DormAdmin/dorm-app/data/mock_db.json';
const db = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. Update Rooms
const rooms = db.Rooms;
rooms[0].push('primary_tenant_id'); // Header

for (let i = 1; i < rooms.length; i++) {
  // If it's room 101 (roomId is at index 0)
  if (rooms[i][0] === '101') {
    rooms[i].push('T-101-CO1');
  } else {
    rooms[i].push('');
  }
}

// 2. Add Co-tenant to Tenants
const newTenant = [
  "T-101-CO1",
  "ผู้เช่าร่วม101",
  "ใจดี",
  "0820000101",
  "101",
  "2024-06-01",
  "ACTIVE",
  "@cotenant101"
];

db.Tenants.push(newTenant);

fs.writeFileSync(path, JSON.stringify(db, null, 2), 'utf8');
console.log('Mock DB updated successfully');
