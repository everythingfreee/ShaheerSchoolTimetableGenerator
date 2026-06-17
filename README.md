# 🗓️ Afghan School Timetable Generator

An intelligent, conflict-free, and high-performance school scheduling solution designed specifically for primary and secondary schools. This generator features robust backtracking solver algorithms, real-time workload limits, robust multi-language rendering, and persistent schedule history.

---

## ✨ Features

- **🧠 Backtracking Solver Engine**: Employs an intelligent cell-by-cell backtracking algorithm with randomized subject/teacher selection and high-iteration searching (up to 500,000 passes) to construct conflict-free timetables under tight constraints.
- **🇦🇫 Optimized for Afghan Schools**: Styled explicitly to schedule from **Saturday to Thursday** with flexible custom periods parameters.
- **🎨 Modern Visual Design**: A clean, responsive, and elegant UI utilizing custom color styling, subtle negative space, card containers, and fluent transition animations.
- **👥 Multi-Language Support (Pashto, Dari, Arabic)**: Fully compatible with RTL (Right-to-Left) text scripts. Key CSS settings like letter-spacing and text-transform have been specifically omitted for teacher/subject rendering to maintain perfect orthographical ligature connections.
- **📊 Real-time Workload Tracking**: Live visual capacity trackers (progress bars) inside the Teachers selection panel alert you in **red** if a teacher is assigned more slots than mathematically available within a week.
- **⚠️ Subject Frequency Validation**: Live warnings inside the Grades configuration outline when a single subject frequency exceeds the total number of school days (preventing impossible generation constraints).
- **📝 Timetable History**: Integrates a seamless **History** tab that holds your last 20 generated schedules in `localStorage` for visual reference, deleting, or instant hot-reloading.
- **📄 Pixel-Perfect PDF Export**: Exports high-quality desktop landscape PDFs for single classes or complete school outputs using advanced canvas capturing.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Motion (Animations)
- **PDF Generation**: `jsPDF` + `html2canvas` (renders actual browser pixels to guarantee true-to-life non-Latin Arabic/Pashto text layouts)
- **State Management**: React state synced with browser client `localStorage` for instant load-persist cycles.

---

## 🚀 How to Use

### 1. Define Subjects
Navigate to the **Subjects** tab and add all the academic subjects taught in your institution (e.g., *Math, Dari, Pashto, Chemistry, Holy Quran*).

### 2. Configure Grades & Periods-Per-Week
Go to the **Grades** tab:
- Add or configure your Grades (e.g., *Grade 4, Grade 5, Grade 6*).
- Define how many times each subject should be taught per week for that grade.
- *Note: Keep subject frequency under 6 hours a week per grade, as a subject cannot be taught twice in one day for the same class.*

### 3. Setup Teachers and Assignments
Go to the **Teachers** tab:
- Insert your educators.
- Select the **Assign Subject & Class** dropdown to assign exactly which subject they teach to which specific Grade.
- Watch the **workload bar** under each teacher to ensure they are not over-scheduled (maximum 36 slots in a 6-day week with 6 periods/day).

### 4. Adjust Timetable Settings
Click on **Settings** to:
- Toggle **Allow Same Subject Concurrently**: When enabled, two different grades can have the same subject (e.g., Math) at the same time if they have different teachers. Disable this if they share resources (or space).
- Reset and purge data cleanly if you need a fresh start.

### 5. Generate & Export
Go to the **Generate** tab:
- Select the grades you wish to include.
- Click **Generate Timetable**.
- Instantly view the table formatted with **Days as vertical rows** and **Periods as horizontal columns**.
- Download individual grades as PDFs or compile them together into a multipage **Full School PDF**.

---

## 👨‍💻 Developer & Support

Created to simplify school administration and help institutions focus on education rather than complex manual scheduling algorithms.

- **Developer**: Sanaullah Shaheer
- **Contact Email**: `everythingfree36@gmail.com`
- **Application URL**: <a href="https://timetablegenerator.vercel.app" target="_blank">Afghan Timetable Generator</a>
---

Developed with ❤️ using React & TypeScript. Feel free to reach out with any issues or feature requests!
