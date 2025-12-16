import * as bcrypt from 'bcryptjs';

export class PasswordUtil {
  private static readonly SALT_ROUNDS = 12;

  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validate(password: string): boolean {
    // At least 8 characters (after trim, no whitespace)
    const trimmedPassword = password.trim();
    return trimmedPassword.length >= 8 && !/\s/.test(trimmedPassword);
  }
}
