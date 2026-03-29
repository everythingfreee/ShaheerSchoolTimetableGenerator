import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { 
  Plus, 
  Trash2, 
  Save, 
  Calendar, 
  Users, 
  BookOpen, 
  GraduationCap, 
  ChevronRight, 
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Download,
  Settings,
  FileDown,
  History,
  Clock,
  Eye,
  X
} from 'lucide-react';
import { Subject, Grade, Teacher, AppData, Timetable, Day, HistoryEntry } from './types';
import { DAYS, DEFAULT_GRADES, DEFAULT_PERIODS_PER_DAY } from './constants';
import { generateTimetable } from './utils';

const STORAGE_KEY = 'afghan_school_timetable_data';

export default function App() {
  const [activeTab, setActiveTab] = useState<'subjects' | 'grades' | 'teachers' | 'generate' | 'settings' | 'history'>('subjects');
  const [data, setData] = useState<AppData>({
    subjects: [],
    grades: DEFAULT_GRADES,
    teachers: [],
    periodsPerDay: DEFAULT_PERIODS_PER_DAY,
    settings: {
      allowSameSubjectConcurrent: true,
    },
    history: []
  });
  const [generatedTimetable, setGeneratedTimetable] = useState<Timetable | null>(null);
  const [selectedGradesForGen, setSelectedGradesForGen] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrate old data to ensure all required fields exist
        if (parsed.teachers) {
          parsed.teachers = parsed.teachers.map((t: any) => {
            if (t.assignments) return t;
            
            // Convert old subjectIds and gradeIds to assignments
            const assignments: any[] = [];
            if (t.subjectIds && t.gradeIds) {
              t.subjectIds.forEach((sid: string) => {
                t.gradeIds.forEach((gid: string) => {
                  assignments.push({ subjectId: sid, gradeId: gid });
                });
              });
            }
            
            return {
              id: t.id,
              name: t.name,
              assignments: assignments
            };
          });
        }
        if (!parsed.settings) {
          parsed.settings = { allowSameSubjectConcurrent: true };
        }
        setData(parsed);
      } catch (e) {
        console.error('Failed to parse saved data', e);
      }
    }
  }, []);

  // Save data
  const saveData = (newData: AppData) => {
    setData(newData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    setSuccess('Data saved successfully!');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Subject Handlers
  const addSubject = (name: string) => {
    if (!name.trim()) return;
    const newSubject: Subject = { id: crypto.randomUUID(), name };
    saveData({ ...data, subjects: [...data.subjects, newSubject] });
  };

  const deleteSubject = (id: string) => {
    const newSubjects = data.subjects.filter(s => s.id !== id);
    // Also remove from grades and teachers
    const newGrades = data.grades.map(g => ({
      ...g,
      subjects: g.subjects.filter(gs => gs.subjectId !== id)
    }));
    const newTeachers = data.teachers.map(t => ({
      ...t,
      assignments: (t.assignments || []).filter(a => a.subjectId !== id)
    }));
    saveData({ ...data, subjects: newSubjects, grades: newGrades, teachers: newTeachers });
  };

  // Grade Handlers
  const updateGradeSubjects = (gradeId: string, subjectId: string, periods: number) => {
    const newGrades = data.grades.map(g => {
      if (g.id !== gradeId) return g;
      const existing = g.subjects.find(gs => gs.subjectId === subjectId);
      let newSubjects;
      if (periods <= 0) {
        newSubjects = g.subjects.filter(gs => gs.subjectId !== subjectId);
      } else if (existing) {
        newSubjects = g.subjects.map(gs => gs.subjectId === subjectId ? { ...gs, periodsPerWeek: periods } : gs);
      } else {
        newSubjects = [...g.subjects, { subjectId, periodsPerWeek: periods }];
      }
      return { ...g, subjects: newSubjects };
    });
    saveData({ ...data, grades: newGrades });
  };

  // Teacher Handlers
  const addTeacher = (name: string) => {
    if (!name.trim()) return;
    const newTeacher: Teacher = { id: crypto.randomUUID(), name, assignments: [] };
    saveData({ ...data, teachers: [...data.teachers, newTeacher] });
  };

  const toggleTeacherAssignment = (teacherId: string, subjectId: string, gradeId: string) => {
    const newTeachers = data.teachers.map(t => {
      if (t.id !== teacherId) return t;
      const assignments = t.assignments || [];
      const exists = assignments.some(a => a.subjectId === subjectId && a.gradeId === gradeId);
      
      return {
        ...t,
        assignments: exists 
          ? assignments.filter(a => !(a.subjectId === subjectId && a.gradeId === gradeId))
          : [...assignments, { subjectId, gradeId }]
      };
    });
    saveData({ ...data, teachers: newTeachers });
  };

  const deleteTeacher = (id: string) => {
    saveData({ ...data, teachers: data.teachers.filter(t => t.id !== id) });
  };

  const handleGenerate = () => {
    setError(null);
    if (selectedGradesForGen.length === 0) {
      setError('Please select at least one grade.');
      return;
    }

    // Validate subject frequency vs days
    for (const gradeId of selectedGradesForGen) {
      const grade = data.grades.find(g => g.id === gradeId);
      if (grade) {
        const totalGradePeriods = grade.subjects.reduce((acc, s) => acc + s.periodsPerWeek, 0);
        const totalSlots = data.periodsPerDay * DAYS.length;
        if (totalGradePeriods > totalSlots) {
          setError(`Grade "${grade.name}" has ${totalGradePeriods} total periods per week, but only ${totalSlots} slots are available (${data.periodsPerDay} periods/day * ${DAYS.length} days).`);
          return;
        }

        for (const gs of grade.subjects) {
          if (gs.periodsPerWeek > DAYS.length) {
            const subject = data.subjects.find(s => s.id === gs.subjectId);
            setError(`Grade "${grade.name}" has "${subject?.name}" assigned ${gs.periodsPerWeek} times a week, but there are only ${DAYS.length} school days. With the "no duplicate subject per day" rule, this is impossible.`);
            return;
          }

          // Check for missing teacher assignments
          const hasTeacher = data.teachers.some(t => 
            (t.assignments || []).some(a => a.subjectId === gs.subjectId && a.gradeId === gradeId)
          );
          if (!hasTeacher) {
            const subject = data.subjects.find(s => s.id === gs.subjectId);
            setError(`No teacher assigned to "${subject?.name}" for ${grade.name}. Please go to the Teachers tab and assign a teacher.`);
            return;
          }
        }
      }
    }

    // Check total teacher capacity
    const totalRequiredPeriods = selectedGradesForGen.reduce((acc, gid) => {
      const g = data.grades.find(grade => grade.id === gid);
      return acc + (g?.subjects.reduce((sum, s) => sum + s.periodsPerWeek, 0) || 0);
    }, 0);
    const totalSlotsInWeek = data.periodsPerDay * DAYS.length;
    const totalTeacherCapacity = data.teachers.length * totalSlotsInWeek;
    
    if (totalRequiredPeriods > totalTeacherCapacity) {
      setError(`Insufficient teacher capacity. Total required periods: ${totalRequiredPeriods}. Total teacher capacity: ${totalTeacherCapacity} (${data.teachers.length} teachers * ${data.periodsPerDay} periods * ${DAYS.length} days).`);
      return;
    }

    // Check for subject overload if concurrent subjects are not allowed
    if (!data.settings?.allowSameSubjectConcurrent) {
      for (const subject of data.subjects) {
        const totalSubjectPeriods = selectedGradesForGen.reduce((acc, gid) => {
          const g = data.grades.find(grade => grade.id === gid);
          const gs = g?.subjects.find(s => s.subjectId === subject.id);
          return acc + (gs?.periodsPerWeek || 0);
        }, 0);

        if (totalSubjectPeriods > totalSlotsInWeek) {
          setError(`Subject "${subject.name}" is scheduled for ${totalSubjectPeriods} periods across all grades, but there are only ${totalSlotsInWeek} slots in a week. Since "Allow Same Subject Concurrently" is disabled, this is impossible. Please enable that setting or reduce subject frequency.`);
          return;
        }
      }
    }

    // Check for mandatory teacher overload
    // (If a teacher is the ONLY one assigned to a subject/grade pair)
    const teacherMandatoryLoad: Record<string, number> = {};
    data.teachers.forEach(t => teacherMandatoryLoad[t.id] = 0);

    for (const gradeId of selectedGradesForGen) {
      const grade = data.grades.find(g => g.id === gradeId);
      if (!grade) continue;

      for (const gs of grade.subjects) {
        const assignedTeachers = data.teachers.filter(t => 
          (t.assignments || []).some(a => a.subjectId === gs.subjectId && a.gradeId === gradeId)
        );

        if (assignedTeachers.length === 1) {
          teacherMandatoryLoad[assignedTeachers[0].id] += gs.periodsPerWeek;
        }
      }
    }

    for (const teacherId in teacherMandatoryLoad) {
      if (teacherMandatoryLoad[teacherId] > totalSlotsInWeek) {
        const teacher = data.teachers.find(t => t.id === teacherId);
        setError(`Teacher "${teacher?.name}" is the only one assigned to too many periods (${teacherMandatoryLoad[teacherId]} periods/week, but only ${totalSlotsInWeek} slots available). Please assign more teachers to their subjects.`);
        return;
      }
    }
    
    setIsGenerating(true);

    // Use setTimeout to allow UI to update before heavy calculation
    setTimeout(() => {
      const result = generateTimetable(data, selectedGradesForGen);
      setIsGenerating(false);
      if (result) {
        setGeneratedTimetable(result);
        setSuccess('Timetable generated successfully!');
        
        // Save to history
        const newHistoryEntry: HistoryEntry = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          timetable: result,
          selectedGrades: [...selectedGradesForGen],
          periodsPerDay: data.periodsPerDay
        };
        
        saveData({
          ...data,
          history: [newHistoryEntry, ...(data.history || [])].slice(0, 20) // Keep last 20
        });
      } else {
        setError('Could not generate a conflict-free timetable. This often happens if many grades have the same subjects at the same time. Try adding more teachers or reducing subject frequency.');
      }
    }, 100);
  };

  const downloadGradePDF = async (gradeId: string) => {
    if (!generatedTimetable) return;
    const grade = data.grades.find(g => g.id === gradeId);
    const schedule = generatedTimetable[gradeId];
    if (!grade || !schedule) return;

    const element = document.getElementById(`timetable-${gradeId}`);
    if (!element) return;

    try {
      // Temporarily set overflow to visible to capture the full width
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(`timetable-${gradeId}`);
          if (clonedElement) {
            clonedElement.style.overflow = 'visible';
            clonedElement.style.width = 'fit-content';
            clonedElement.style.maxWidth = 'none';
            // Hide the download button in the PDF
            const downloadBtn = clonedElement.querySelector('button');
            if (downloadBtn) downloadBtn.style.display = 'none';
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const maxImgWidth = pageWidth - (margin * 2);
      const maxImgHeight = pageHeight - 40; // Leave space for header

      let imgWidth = maxImgWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      // If height is too much, scale down based on height
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = (canvas.width * imgHeight) / canvas.height;
      }
      
      doc.setFontSize(18);
      doc.text(`${grade.name} Timetable`, margin, 15);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, 22);
      
      doc.addImage(imgData, 'PNG', margin, 30, imgWidth, imgHeight);
      doc.save(`${grade.name.replace(/\s+/g, '_')}_Timetable.pdf`);
    } catch (error) {
      console.error('PDF generation failed', error);
      setError('Failed to generate PDF. Please try again.');
    }
  };

  const downloadAllPDF = async () => {
    if (!generatedTimetable) return;
    
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const maxImgWidth = pageWidth - (margin * 2);
    const maxImgHeight = pageHeight - 40;

    for (let i = 0; i < selectedGradesForGen.length; i++) {
      const gradeId = selectedGradesForGen[i];
      const grade = data.grades.find(g => g.id === gradeId);
      const schedule = generatedTimetable[gradeId];
      if (!grade || !schedule) continue;

      const element = document.getElementById(`timetable-${gradeId}`);
      if (!element) continue;

      if (i > 0) doc.addPage();

      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const clonedElement = clonedDoc.getElementById(`timetable-${gradeId}`);
            if (clonedElement) {
              clonedElement.style.overflow = 'visible';
              clonedElement.style.width = 'fit-content';
              clonedElement.style.maxWidth = 'none';
              const downloadBtn = clonedElement.querySelector('button');
              if (downloadBtn) downloadBtn.style.display = 'none';
            }
          }
        });
        
        const imgData = canvas.toDataURL('image/png');
        let imgWidth = maxImgWidth;
        let imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight > maxImgHeight) {
          imgHeight = maxImgHeight;
          imgWidth = (canvas.width * imgHeight) / canvas.height;
        }

        doc.setFontSize(18);
        doc.text(`${grade.name} Timetable`, margin, 15);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, 22);
        
        doc.addImage(imgData, 'PNG', margin, 30, imgWidth, imgHeight);
      } catch (error) {
        console.error('PDF generation failed for grade', grade.name, error);
      }
    }

    doc.save('Full_School_Timetable.pdf');
  };

  const deleteHistoryEntry = (id: string) => {
    saveData({
      ...data,
      history: (data.history || []).filter(h => h.id !== id)
    });
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setGeneratedTimetable(entry.timetable);
    setSelectedGradesForGen(entry.selectedGrades);
    setActiveTab('generate');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#212529] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#DEE2E6] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#007BFF] p-2 rounded-lg text-white">
              <Calendar size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#343A40]">Afghan School Timetable</h1>
          </div>
          <div className="flex items-center gap-4">
            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-green-600 text-sm font-medium"
              >
                <CheckCircle2 size={16} /> {success}
              </motion.div>
            )}
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-red-600 text-sm font-medium"
              >
                <AlertCircle size={16} /> {error}
              </motion.div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 bg-white p-1.5 rounded-xl border border-[#DEE2E6] shadow-sm w-fit">
          <TabButton 
            active={activeTab === 'subjects'} 
            onClick={() => setActiveTab('subjects')}
            icon={<BookOpen size={18} />}
            label="Subjects"
          />
          <TabButton 
            active={activeTab === 'grades'} 
            onClick={() => setActiveTab('grades')}
            icon={<GraduationCap size={18} />}
            label="Grades"
          />
          <TabButton 
            active={activeTab === 'teachers'} 
            onClick={() => setActiveTab('teachers')}
            icon={<Users size={18} />}
            label="Teachers"
          />
          <TabButton 
            active={activeTab === 'generate'} 
            onClick={() => setActiveTab('generate')}
            icon={<Calendar size={18} />}
            label="Generate"
          />
          <TabButton 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')}
            icon={<History size={18} />}
            label="History"
          />
          <TabButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')}
            icon={<Settings size={18} />}
            label="Settings"
          />
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl border border-[#DEE2E6] shadow-sm p-6 sm:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'subjects' && (
              <motion.div
                key="subjects"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <SectionHeader title="Manage Subjects" description="Add all the subjects taught in your school." />
                <div className="mt-6">
                  <div className="flex gap-2 max-w-md">
                    <input 
                      type="text" 
                      placeholder="Enter subject name (e.g. Math)"
                      className="flex-1 px-4 py-2 rounded-lg border border-[#CED4DA] focus:ring-2 focus:ring-[#007BFF] focus:border-transparent outline-none transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addSubject(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addSubject(input.value);
                        input.value = '';
                      }}
                      className="bg-[#007BFF] text-white px-4 py-2 rounded-lg hover:bg-[#0056B3] transition-colors flex items-center gap-2 font-medium"
                    >
                      <Plus size={18} /> Add
                    </button>
                  </div>

                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.subjects.map((subject) => (
                      <div key={subject.id} className="flex justify-between items-center p-4 bg-[#F8F9FA] rounded-xl border border-[#E9ECEF] group hover:border-[#007BFF] transition-all">
                        <span className="font-medium text-[#495057]">{subject.name}</span>
                        <button 
                          onClick={() => deleteSubject(subject.id)}
                          className="text-[#ADB5BD] hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                    {data.subjects.length === 0 && (
                      <div className="col-span-full py-12 text-center text-[#6C757D]">
                        No subjects added yet. Start by adding one above.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'grades' && (
              <motion.div
                key="grades"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <SectionHeader title="Grade-Subject Mapping" description="Assign subjects and weekly frequency for each grade." />
                <div className="mt-8 space-y-6">
                  {data.grades.map((grade) => (
                    <GradeAccordion 
                      key={grade.id} 
                      grade={grade} 
                      allSubjects={data.subjects}
                      onUpdate={(sid, p) => updateGradeSubjects(grade.id, sid, p)}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'teachers' && (
              <motion.div
                key="teachers"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <SectionHeader title="Manage Teachers" description="Add teachers and select the subjects they are qualified to teach." />
                <div className="mt-6">
                  <div className="flex gap-2 max-w-md">
                    <input 
                      type="text" 
                      placeholder="Enter teacher name"
                      className="flex-1 px-4 py-2 rounded-lg border border-[#CED4DA] focus:ring-2 focus:ring-[#007BFF] focus:border-transparent outline-none transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addTeacher(e.currentTarget.value);
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        addTeacher(input.value);
                        input.value = '';
                      }}
                      className="bg-[#007BFF] text-white px-4 py-2 rounded-lg hover:bg-[#0056B3] transition-colors flex items-center gap-2 font-medium"
                    >
                      <Plus size={18} /> Add
                    </button>
                  </div>

                  <div className="mt-8 space-y-4">
                    {data.teachers.map((teacher) => (
                      <div key={teacher.id} className="p-6 bg-[#F8F9FA] rounded-2xl border border-[#E9ECEF]">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex flex-col">
                            <h3 className="text-lg font-bold text-[#343A40]">{teacher.name}</h3>
                            {(() => {
                              const totalPeriods = selectedGradesForGen.reduce((acc, gid) => {
                                const g = data.grades.find(grade => grade.id === gid);
                                if (!g) return acc;
                                return acc + g.subjects.reduce((sum, s) => {
                                  const isAssigned = (teacher.assignments || []).some(a => a.subjectId === s.subjectId && a.gradeId === gid);
                                  return sum + (isAssigned ? s.periodsPerWeek : 0);
                                }, 0);
                              }, 0);
                              const maxSlots = data.periodsPerDay * DAYS.length;
                              const percentage = Math.min(100, (totalPeriods / maxSlots) * 100);
                              
                              return (
                                <div className="mt-1 flex items-center gap-3">
                                  <div className="w-24 h-1.5 bg-[#E9ECEF] rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${totalPeriods > maxSlots ? 'bg-red-500' : 'bg-[#007BFF]'}`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                  <span className={`text-[10px] font-bold ${totalPeriods > maxSlots ? 'text-red-500' : 'text-[#6C757D]'}`}>
                                    {totalPeriods}/{maxSlots} periods
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                          <button 
                            onClick={() => deleteTeacher(teacher.id)}
                            className="text-[#ADB5BD] hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                        <div className="space-y-4">
                          <label className="block text-xs font-bold text-[#6C757D] uppercase tracking-wider mb-2">Subject Assignments by Grade</label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {data.subjects.map(subject => (
                              <div key={subject.id} className="bg-white p-3 rounded-xl border border-[#E9ECEF] shadow-sm">
                                <div className="text-xs font-bold text-[#495057] mb-2 pb-1 border-bottom border-[#F1F3F5]">{subject.name}</div>
                                <div className="flex flex-wrap gap-1.5">
                                  {data.grades.map(grade => {
                                    const isAssigned = (teacher.assignments || []).some(a => a.subjectId === subject.id && a.gradeId === grade.id);
                                    // Only show grades that actually have this subject assigned to them in the Grades tab
                                    const isTaughtInGrade = grade.subjects.some(gs => gs.subjectId === subject.id);
                                    
                                    if (!isTaughtInGrade) return null;

                                    return (
                                      <button
                                        key={grade.id}
                                        onClick={() => toggleTeacherAssignment(teacher.id, subject.id, grade.id)}
                                        title={`${teacher.name} teaches ${subject.name} in ${grade.name}`}
                                        className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all border ${
                                          isAssigned
                                            ? 'bg-[#007BFF] text-white border-[#007BFF]'
                                            : 'bg-[#F8F9FA] text-[#ADB5BD] border-[#DEE2E6] hover:border-[#007BFF] hover:text-[#007BFF]'
                                        }`}
                                      >
                                        {grade.name}
                                      </button>
                                    );
                                  })}
                                  {data.grades.every(grade => !grade.subjects.some(gs => gs.subjectId === subject.id)) && (
                                    <span className="text-[9px] text-[#CED4DA] italic">Not taught in any grade</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    {data.teachers.length === 0 && (
                      <div className="py-12 text-center text-[#6C757D]">
                        No teachers added yet.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'generate' && (
              <motion.div
                key="generate"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <SectionHeader title="Generate Timetable" description="Select grades and generate a conflict-free schedule." />
                
                {!generatedTimetable ? (
                  <div className="mt-8">
                    <div className="mb-8 p-6 bg-[#F8F9FA] rounded-2xl border border-[#E9ECEF] max-w-md">
                      <label className="block text-sm font-bold text-[#495057] mb-2">Periods per Day</label>
                      <div className="flex items-center gap-4">
                        <input 
                          type="range" 
                          min="1" 
                          max="12" 
                          value={data.periodsPerDay} 
                          onChange={(e) => saveData({ ...data, periodsPerDay: parseInt(e.target.value) })}
                          className="flex-1 h-2 bg-[#DEE2E6] rounded-lg appearance-none cursor-pointer accent-[#007BFF]"
                        />
                        <span className="w-10 text-center font-bold text-[#007BFF] text-lg">{data.periodsPerDay}</span>
                      </div>
                      <p className="text-[10px] text-[#6C757D] mt-2">Select how many subjects/periods are taught in a single school day.</p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {data.grades.map(grade => (
                        <button
                          key={grade.id}
                          onClick={() => {
                            setSelectedGradesForGen(prev => 
                              prev.includes(grade.id) 
                                ? prev.filter(id => id !== grade.id)
                                : [...prev, grade.id]
                            );
                          }}
                          className={`p-4 rounded-xl border text-center transition-all ${
                            selectedGradesForGen.includes(grade.id)
                              ? 'bg-[#007BFF] text-white border-[#007BFF] shadow-md'
                              : 'bg-white text-[#495057] border-[#DEE2E6] hover:border-[#007BFF]'
                          }`}
                        >
                          <div className="text-sm font-bold">{grade.name}</div>
                          <div className={`text-[10px] mt-1 ${selectedGradesForGen.includes(grade.id) ? 'text-blue-100' : 'text-[#6C757D]'}`}>
                            {grade.subjects.reduce((acc, s) => acc + s.periodsPerWeek, 0)} periods/week
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="mt-10 flex flex-col items-center gap-4">
                      <button 
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`bg-[#007BFF] text-white px-8 py-4 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center gap-3 font-bold text-lg ${
                          isGenerating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-[#0056B3]'
                        }`}
                      >
                        {isGenerating ? (
                          <>
                            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Calendar size={24} /> Generate Timetable
                          </>
                        )}
                      </button>
                      {isGenerating && (
                        <p className="text-sm text-[#6C757D] animate-pulse">This may take a few seconds for complex schedules...</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 space-y-12">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-[#343A40]">Generated Schedule</h3>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setGeneratedTimetable(null)}
                          className="px-4 py-2 text-[#6C757D] hover:text-[#343A40] font-medium"
                        >
                          Back to Selection
                        </button>
                        <button 
                          onClick={downloadAllPDF}
                          className="bg-[#343A40] text-white px-4 py-2 rounded-lg hover:bg-black transition-colors flex items-center gap-2 font-medium"
                        >
                          <Download size={18} /> Download All PDF
                        </button>
                      </div>
                    </div>

                    {selectedGradesForGen.map(gradeId => {
                      const grade = data.grades.find(g => g.id === gradeId);
                      const schedule = generatedTimetable[gradeId];
                      if (!grade || !schedule) return null;

                      return (
                        <div key={gradeId} id={`timetable-${gradeId}`} className="overflow-x-auto print:overflow-visible bg-white p-6 rounded-2xl border border-[#E9ECEF] shadow-sm">
                          <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-bold text-[#007BFF] border-l-4 border-[#007BFF] pl-3">{grade.name}</h4>
                            <button 
                              onClick={() => downloadGradePDF(gradeId)}
                              className="text-[#007BFF] hover:text-[#0056B3] flex items-center gap-2 text-sm font-bold"
                            >
                              <FileDown size={16} /> Download {grade.name} PDF
                            </button>
                          </div>
                          <table className="w-full border-collapse border border-[#DEE2E6] text-sm">
                            <thead>
                              <tr className="bg-[#F8F9FA]">
                                <th className="border border-[#DEE2E6] p-3 text-left font-bold text-[#495057] w-32">Day</th>
                                {Array.from({ length: data.periodsPerDay }).map((_, pIndex) => (
                                  <th key={pIndex} className="border border-[#DEE2E6] p-3 text-center font-bold text-[#495057]">Period {pIndex + 1}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {DAYS.map(day => (
                                <tr key={day}>
                                  <td className="border border-[#DEE2E6] p-3 bg-[#F8F9FA] font-bold text-[#495057]">
                                    {day}
                                  </td>
                                  {Array.from({ length: data.periodsPerDay }).map((_, pIndex) => {
                                    const entry = schedule[day][pIndex];
                                    const subject = entry ? data.subjects.find(s => s.id === entry.subjectId) : null;
                                    const teacher = entry ? data.teachers.find(t => t.id === entry.teacherId) : null;
                                    
                                    return (
                                      <td key={pIndex} className="border border-[#DEE2E6] p-3 text-center min-w-[120px] h-20">
                                        {entry ? (
                                          <div className="flex flex-col gap-1">
                                            <div className="font-bold text-[#212529]">{subject?.name}</div>
                                            <div className="text-[10px] text-[#6C757D] font-semibold">{teacher?.name}</div>
                                          </div>
                                        ) : (
                                          <div className="text-[#DEE2E6] italic">Free</div>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <SectionHeader title="Generation History" description="View and reload previously generated timetables." />
                <div className="mt-8 space-y-4">
                  {(!data.history || data.history.length === 0) ? (
                    <div className="text-center py-12 bg-[#F8F9FA] rounded-2xl border border-dashed border-[#DEE2E6]">
                      <Clock className="mx-auto text-[#ADB5BD] mb-4" size={48} />
                      <p className="text-[#6C757D]">No generation history yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {data.history.map((entry) => (
                        <div key={entry.id} className="bg-white p-6 rounded-2xl border border-[#E9ECEF] shadow-sm hover:border-[#007BFF] transition-all group">
                          <div className="flex justify-between items-center">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Clock size={16} className="text-[#6C757D]" />
                                <span className="font-bold text-[#343A40]">
                                  {new Date(entry.timestamp).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-[#6C757D]">
                                Grades: {entry.selectedGrades.map(gid => data.grades.find(g => g.id === gid)?.name).join(', ')}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => loadFromHistory(entry)}
                                className="p-2 text-[#007BFF] hover:bg-[#E7F1FF] rounded-lg transition-colors flex items-center gap-2 font-bold text-sm"
                              >
                                <Eye size={18} /> View
                              </button>
                              <button 
                                onClick={() => deleteHistoryEntry(entry.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <SectionHeader title="App Settings" description="Configure how the timetable generator works." />
                <div className="mt-8 max-w-2xl space-y-8">
                  <div className="flex items-center justify-between p-6 bg-[#F8F9FA] rounded-2xl border border-[#E9ECEF]">
                    <div className="space-y-1">
                      <h4 className="font-bold text-[#343A40]">Allow Same Subject Concurrently</h4>
                      <p className="text-sm text-[#6C757D]">If enabled, two different classes can have the same subject (e.g. Math) at the same time if they have different teachers.</p>
                    </div>
                    <button 
                      onClick={() => saveData({
                        ...data,
                        settings: {
                          ...data.settings!,
                          allowSameSubjectConcurrent: !data.settings?.allowSameSubjectConcurrent
                        }
                      })}
                      className={`w-14 h-8 rounded-full transition-all relative flex items-center ${
                        data.settings?.allowSameSubjectConcurrent ? 'bg-[#007BFF]' : 'bg-[#DEE2E6]'
                      }`}
                    >
                      <div className={`absolute w-6 h-6 bg-white rounded-full transition-all shadow-sm ${
                        data.settings?.allowSameSubjectConcurrent ? 'right-1' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  <div className="pt-8 border-t border-[#F1F3F5]">
                    <h4 className="font-bold text-red-600 mb-2">Danger Zone</h4>
                    <p className="text-sm text-[#6C757D] mb-4">Clearing all data will remove all subjects, grades, and teachers. This action cannot be undone.</p>
                    <button 
                      onClick={() => {
                        if (window.confirm('Are you sure you want to clear all data? This will reset the app.')) {
                          const resetData: AppData = {
                            subjects: [],
                            grades: DEFAULT_GRADES,
                            teachers: [],
                            periodsPerDay: DEFAULT_PERIODS_PER_DAY,
                            settings: { allowSameSubjectConcurrent: true }
                          };
                          saveData(resetData);
                          localStorage.removeItem(STORAGE_KEY);
                          window.location.reload();
                        }
                      }}
                      className="px-6 py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={18} /> Clear All Data
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center text-[#6C757D] text-sm">
        <p>&copy; 2026 Afghan School Timetable System. All data saved locally.</p>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold transition-all ${
        active 
          ? 'bg-[#007BFF] text-white shadow-sm' 
          : 'text-[#6C757D] hover:bg-[#F8F9FA] hover:text-[#343A40]'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-[#F1F3F5] pb-6">
      <h2 className="text-2xl font-bold text-[#343A40]">{title}</h2>
      <p className="text-[#6C757D] mt-1">{description}</p>
    </div>
  );
}

interface GradeAccordionProps {
  key?: string | number;
  grade: Grade;
  allSubjects: Subject[];
  onUpdate: (sid: string, p: number) => void;
}

function GradeAccordion({ grade, allSubjects, onUpdate }: GradeAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const totalPeriods = grade.subjects.reduce((acc, s) => acc + s.periodsPerWeek, 0);

  return (
    <div className="border border-[#E9ECEF] rounded-2xl overflow-hidden bg-white hover:border-[#007BFF] transition-colors">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left bg-[#F8F9FA]"
      >
        <div className="flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg border border-[#DEE2E6] text-[#007BFF]">
            <GraduationCap size={20} />
          </div>
          <div>
            <h4 className="font-bold text-[#343A40]">{grade.name}</h4>
            <p className="text-xs text-[#6C757D]">{totalPeriods} total periods per week</p>
          </div>
        </div>
        {isOpen ? <ChevronDown size={20} className="text-[#ADB5BD]" /> : <ChevronRight size={20} className="text-[#ADB5BD]" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {allSubjects.map(subject => {
                const gs = grade.subjects.find(s => s.subjectId === subject.id);
                return (
                      <div key={subject.id} className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-bold text-[#495057]">{subject.name}</label>
                          {(gs?.periodsPerWeek || 0) > DAYS.length && (
                            <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                              <AlertCircle size={10} /> Max {DAYS.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <input 
                            type="number" 
                            min="0"
                            max="36"
                            value={gs?.periodsPerWeek || 0}
                            onChange={(e) => onUpdate(subject.id, parseInt(e.target.value) || 0)}
                            className={`w-20 px-3 py-1.5 rounded-lg border text-center font-bold outline-none transition-all ${
                              (gs?.periodsPerWeek || 0) > DAYS.length 
                                ? 'border-red-500 bg-red-50 text-red-600' 
                                : 'border-[#CED4DA] focus:ring-2 focus:ring-[#007BFF]'
                            }`}
                          />
                          <span className="text-xs text-[#6C757D]">periods/week</span>
                        </div>
                      </div>
                );
              })}
              {allSubjects.length === 0 && (
                <div className="col-span-full text-center py-4 text-[#6C757D] text-sm italic">
                  No subjects available. Add subjects first.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
