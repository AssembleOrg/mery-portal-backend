import { DateTime } from 'luxon';

export class DateTimeUtil {
  private static readonly TIMEZONE = 'America/Argentina/Buenos_Aires';

  static now(): DateTime {
    return DateTime.now().setZone(this.TIMEZONE);
  }

  static toISO(date: DateTime): string {
    return date.toISO();
  }

  static fromISO(iso: string): DateTime {
    return DateTime.fromISO(iso).setZone(this.TIMEZONE);
  }

  static format(date: DateTime, format: string = 'yyyy-MM-dd HH:mm:ss'): string {
    return date.toFormat(format);
  }

  static addDays(date: DateTime, days: number): DateTime {
    return date.plus({ days });
  }

  static addHours(date: DateTime, hours: number): DateTime {
    return date.plus({ hours });
  }
}
