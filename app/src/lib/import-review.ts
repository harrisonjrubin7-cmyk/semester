import type { Item } from './types';
/** Only approved, valid dates may become an active course calendar. */
export function reviewReady(items: Pick<Item, 'id' | 'title' | 'month' | 'day' | 'year'>[], dropped: Set<string>, confirmed: boolean, fallbackYear: number): boolean {
  return confirmed && items.filter(item => !dropped.has(item.id)).every(item => {
    const year = item.year ?? fallbackYear;
    const date = new Date(year, item.month, item.day);
    return !!item.title.trim() && Number.isInteger(year) && year >= 1900 && year <= 2200 && date.getFullYear() === year && date.getMonth() === item.month && date.getDate() === item.day;
  });
}
