/**
 * site.js — أدوات مشتركة لكل صفحات موقع بنك اختبارات كلية الطب البشري
 * مسؤول عن: المصادقة وحماية الصفحات عبر Firebase، تحميل بنية المنهج (curriculum.json)، وتتبع تقدم الطالب.
 */

// ---------------------------------------------------------------------------
// 1. إعدادات Firebase وحماية الجلسة
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCvPSN617TrSgDgAEFoj-ZcDByot_EU_h0",
  authDomain: "test-med9.firebaseapp.com",
  projectId: "test-med9",
  storageBucket: "test-med9.firebasestorage.app",
  messagingSenderId: "304730828117",
  appId: "1:304730828117:web:3bc288278a1c53ed9253dc",
  measurementId: "G-6RY4FEJQRX"
};

// تهيئة Firebase والتحقق من تسجيل الدخول
if (typeof firebase !== 'undefined') {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  // فحص حالة المستخدم في كل الصفحات باستثناء صفحة تسجيل الدخول
  const isLoginPage = window.location.pathname.endsWith('login.html');
  if (!isLoginPage) {
    firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        // إذا لم يكن مسجلاً، يتم تحويله لصفحة الدخول
        window.location.href = 'login.html';
      }
    });
  }
}

// دالة تسجيل الخروج لاستخدامها في أي زر خروج داخل الموقع
function logout() {
  if (typeof firebase !== 'undefined') {
    firebase.auth().signOut().then(() => {
      window.location.href = 'login.html';
    });
  } else {
    window.location.href = 'login.html';
  }
}

// معرفة المستخدم الحالي
function getCurrentUser() {
  return (typeof firebase !== 'undefined' && firebase.auth()) ? firebase.auth().currentUser : null;
}

// ---------------------------------------------------------------------------
// 2. تحميل بنية المنهج والبحث في المواد
// ---------------------------------------------------------------------------
const CURRICULUM_URL = 'data/curriculum.json';
let _curriculumCache = null;

async function loadCurriculum() {
  if (_curriculumCache) return _curriculumCache;
  const res = await fetch(CURRICULUM_URL);
  if (!res.ok) throw new Error('تعذر تحميل بيانات المنهج (curriculum.json)');
  _curriculumCache = await res.json();
  return _curriculumCache;
}

function findYear(curriculum, yearId) {
  return curriculum.years.find(y => y.id === Number(yearId)) || null;
}

function findSemester(year, semId) {
  return year ? year.semesters.find(s => s.id === Number(semId)) || null : null;
}

function findSubject(semester, subjectId) {
  return semester ? semester.subjects.find(s => s.id === subjectId) || null : null;
}

/** يبحث عن اختبار معيّن عبر كل السنوات والفصول والمواد، ويعيد سياقه الكامل */
function findExamGlobally(curriculum, examId) {
  for (const year of curriculum.years) {
    for (const semester of year.semesters) {
      for (const subject of semester.subjects) {
        const exam = subject.exams.find(e => e.id === examId);
        if (exam) return { exam, subject, semester, year };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. تتبع التقدم عبر التخزين المحلي (localStorage)
// ---------------------------------------------------------------------------
const SITE_PROGRESS_KEY = 'medSiteProgress_v1';

function getAllProgress() {
  try {
    return JSON.parse(localStorage.getItem(SITE_PROGRESS_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function getExamProgress(examId) {
  return getAllProgress()[examId] || null;
}

/** status: 'not-started' | 'in-progress' | 'completed' */
function setExamProgress(examId, data) {
  const all = getAllProgress();
  all[examId] = { ...(all[examId] || {}), ...data, updatedAt: Date.now() };
  try {
    localStorage.setItem(SITE_PROGRESS_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('تعذر حفظ ملخص التقدم:', e);
  }
}

function subjectStats(subject) {
  const total = subject.exams.length;
  let completed = 0, inProgress = 0;
  subject.exams.forEach(e => {
    const p = getExamProgress(e.id);
    if (p && p.status === 'completed') completed++;
    else if (p && p.status === 'in-progress') inProgress++;
  });
  return { total, completed, inProgress };
}

function semesterStats(semester) {
  let totalExams = 0, completedExams = 0, inProgressExams = 0;
  semester.subjects.forEach(subject => {
    const st = subjectStats(subject);
    totalExams += st.total;
    completedExams += st.completed;
    inProgressExams += st.inProgress;
  });
  return { totalExams, completedExams, inProgressExams, subjectCount: semester.subjects.length };
}

function yearStats(year) {
  let totalExams = 0, completedExams = 0, inProgressExams = 0;
  year.semesters.forEach(semester => {
    const st = semesterStats(semester);
    totalExams += st.totalExams;
    completedExams += st.completedExams;
    inProgressExams += st.inProgressExams;
  });
  return { totalExams, completedExams, inProgressExams };
}

/** شريط تقدم بسيط بصيغة HTML (نسبة مئوية) */
function progressBarHtml(done, total, colorClass = 'bg-sky-500') {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `
    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
      <div class="${colorClass} h-full transition-all" style="width:${pct}%"></div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.innerText = str ?? '';
  return div.innerHTML;
}
