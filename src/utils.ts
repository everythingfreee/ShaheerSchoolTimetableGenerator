import { AppData, Grade, Subject, Teacher, Timetable, Day, TimetableEntry } from './types';
import { DAYS } from './constants';

export function generateTimetable(
  data: AppData,
  selectedGradeIds: string[]
): Timetable | null {
  const { grades, teachers, periodsPerDay } = data;
  const selectedGrades = grades.filter((g) => selectedGradeIds.includes(g.id));
  
  // Initialize empty timetable
  const timetable: Timetable = {};
  selectedGrades.forEach((g) => {
    timetable[g.id] = DAYS.reduce((acc, day) => {
      acc[day] = Array(periodsPerDay).fill(null);
      return acc;
    }, {} as Record<Day, (TimetableEntry | null)[]>);
  });

  // Track remaining periods for each (grade, subject)
  const remainingPeriods: Record<string, Record<string, number>> = {};
  selectedGrades.forEach(g => {
    remainingPeriods[g.id] = {};
    g.subjects.forEach(gs => {
      remainingPeriods[g.id][gs.subjectId] = gs.periodsPerWeek;
    });
  });

  // Helper to check if a grade already has a subject on a specific day
  const isSubjectInGradeDay = (gradeId: string, day: Day, subjectId: string) => {
    return timetable[gradeId][day].some(entry => entry?.subjectId === subjectId);
  };

  // Helper to check if subject is already being taught at a specific time
  const isSubjectBusy = (subjectId: string, day: Day, periodIndex: number) => {
    if (data.settings?.allowSameSubjectConcurrent) return false;
    
    return Object.values(timetable).some((gradeTimetable) => {
      const entry = gradeTimetable[day][periodIndex];
      return entry?.subjectId === subjectId;
    });
  };

  // Helper to check if teacher is busy at a specific time
  const isTeacherBusy = (teacherId: string, day: Day, periodIndex: number) => {
    return Object.values(timetable).some((gradeTimetable) => {
      const entry = gradeTimetable[day][periodIndex];
      return entry?.teacherId === teacherId;
    });
  };

  // List of all cells to fill
  const cells: { gradeId: string; day: Day; period: number }[] = [];
  selectedGrades.forEach(g => {
    DAYS.forEach(day => {
      for (let p = 0; p < periodsPerDay; p++) {
        cells.push({ gradeId: g.id, day, period: p });
      }
    });
  });

  // Shuffle cells slightly to avoid getting stuck in the same bad branches
  // but keep them grouped by period to handle the "isSubjectBusy" constraint better
  cells.sort((a, b) => {
    if (a.period !== b.period) return a.period - b.period;
    if (a.day !== b.day) return DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
    return 0;
  });
  
  const MAX_ITERATIONS = 500000;
  let iterations = 0;

  function solve(cellIndex: number): boolean {
    iterations++;
    if (iterations > MAX_ITERATIONS) return false;
    if (cellIndex >= cells.length) return true;

    const { gradeId, day, period } = cells[cellIndex];
    
    // Get subjects that still need periods for this grade
    // Heuristic: Try subjects with MORE remaining periods first
    const neededSubjects = Object.entries(remainingPeriods[gradeId])
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]) // Most remaining first
      .map(([id, _]) => id);

    // Add a bit of randomness to avoid getting stuck in the same branches
    if (Math.random() > 0.7) {
      for (let i = neededSubjects.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [neededSubjects[i], neededSubjects[j]] = [neededSubjects[j], neededSubjects[i]];
      }
    }

    for (const subjectId of neededSubjects) {
      // Constraint: Grade cannot have same subject twice a day
      if (isSubjectInGradeDay(gradeId, day, subjectId)) continue;
      
      // Constraint: Same subject cannot be in two classes at once (unless setting allowed)
      if (isSubjectBusy(subjectId, day, period)) continue;

      // Find teachers assigned to this subject and grade
      const availableTeachers = teachers.filter(t => 
        (t.assignments || []).some(a => a.subjectId === subjectId && a.gradeId === gradeId)
      );

      // Heuristic: Try teachers with FEWER total assignments first? 
      // Or just random to explore different branches.
      availableTeachers.sort(() => Math.random() - 0.5);

      for (const teacher of availableTeachers) {
        // Constraint: Teacher cannot be in two places at once
        if (isTeacherBusy(teacher.id, day, period)) continue;

        // Place the subject
        timetable[gradeId][day][period] = { subjectId, teacherId: teacher.id };
        remainingPeriods[gradeId][subjectId]--;

        if (solve(cellIndex + 1)) return true;

        // Backtrack
        remainingPeriods[gradeId][subjectId]++;
        timetable[gradeId][day][period] = null;
      }
    }

    // If this cell is allowed to be empty (e.g. if total periods < slots)
    // But in the user's case, it seems they want to fill it.
    // Let's check if we can skip this cell
    const totalRemaining = Object.values(remainingPeriods[gradeId]).reduce((a, b) => a + b, 0);
    const totalSlotsLeft = cells.slice(cellIndex).filter(c => c.gradeId === gradeId).length;
    
    if (totalSlotsLeft > totalRemaining) {
      if (solve(cellIndex + 1)) return true;
    }

    return false;
  }

  const success = solve(0);
  return success ? timetable : null;
}
