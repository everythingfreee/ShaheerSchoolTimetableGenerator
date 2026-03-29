export type Day = 'Saturday' | 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday';

export interface Subject {
  id: string;
  name: string;
}

export interface GradeSubject {
  subjectId: string;
  periodsPerWeek: number;
}

export interface Grade {
  id: string;
  name: string;
  subjects: GradeSubject[];
}

export interface TeacherAssignment {
  subjectId: string;
  gradeId: string;
}

export interface Teacher {
  id: string;
  name: string;
  assignments: TeacherAssignment[];
}

export interface TimetableEntry {
  subjectId: string;
  teacherId: string;
}

export type Timetable = Record<string, Record<Day, (TimetableEntry | null)[]>>;

export interface AppSettings {
  allowSameSubjectConcurrent: boolean;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  timetable: Timetable;
  selectedGrades: string[];
  periodsPerDay: number;
}

export interface AppData {
  subjects: Subject[];
  grades: Grade[];
  teachers: Teacher[];
  periodsPerDay: number;
  settings?: AppSettings;
  history?: HistoryEntry[];
}
