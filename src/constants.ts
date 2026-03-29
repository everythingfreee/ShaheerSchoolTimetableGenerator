import { Day } from './types';

export const DAYS: Day[] = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

export const DEFAULT_GRADES = Array.from({ length: 12 }, (_, i) => ({
  id: `grade-${i + 1}`,
  name: `Grade ${i + 1}`,
  subjects: [],
}));

export const DEFAULT_PERIODS_PER_DAY = 6;
