const bcrypt = require('bcryptjs');
const fs = require('fs');

async function patchOwnerPassword() {
  const hash = await bcrypt.hash('admin123', 10);
  const path = 'e:/Project/DormAdmin/dorm-app/data/mock_db.json';
  const db = JSON.parse(fs.readFileSync(path, 'utf8'));
  
  // Find owner user and update hash
  for (let row of db.Users) {
    if (row[0] === 'owner') {
      row[1] = hash;
    }
  }
  
  fs.writeFileSync(path, JSON.stringify(db, null, 2));
  console.log('Patched mock_db.json owner password to admin123');
}

patchOwnerPassword();
