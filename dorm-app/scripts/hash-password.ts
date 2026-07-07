import { hash } from 'bcryptjs';

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: ts-node hash-password.ts <password>');
    process.exit(1);
  }

  const hashedPassword = await hash(password, 10);
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hashedPassword}`);
  console.log('\nCopy the hash above and paste it into the "Users" tab in Google Sheets (Column B).');
}

main();
