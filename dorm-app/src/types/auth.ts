export type Role = 'admin' | 'owner';

export interface User {
  username: string;
  passwordHash: string;
  role: Role;
}
