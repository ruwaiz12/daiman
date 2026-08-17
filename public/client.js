// State Management
let state = {
  currentDate: getLocalDateString(),
  activities: [],
  categories: [],
  goals: [],
  currentLog: { activeIds: [], completedIds: [], notes: '', mood: 3, finance: { income: 0, expense: 0, transactions: [] } },
  analytics: null
};

// Tomorrow's plan log cache while modal is open
let tomorrowLogCache = { activeIds: [], completedIds: [], notes: '', mood: 3 };

// Chart instances
let weeklyChartInstance = null;
let categoryChartInstance = null;

// Debounce timer for auto-saving notes
let notesSaveTimeout = null;

// Constants
const CIRCLE_CIRCUMFERENCE = 314.16; // 2 * pi * r (r=50)

// Helper: timezone-safe local YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 10);
  return localISOTime;
}

// Helper: Format "14:30" to "02:30 PM"
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
}

// -------------------------------------------------------------
// DOM Elements
// -------------------------------------------------------------
const datePicker = document.getElementById('date-picker');
const prevDayBtn = document.getElementById('prev-day-btn');
const nextDayBtn = document.getElementById('next-day-btn');
const planTomorrowBtn = document.getElementById('plan-tomorrow-shortcut-btn');
const tabButtons = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');

const checklistList = document.getElementById('checklist-list');
const checklistEmptyState = document.getElementById('checklist-empty-state');
const checklistProgressText = document.getElementById('checklist-progress-text');
const checklistTitle = document.getElementById('checklist-title');

const dailyScoreVal = document.getElementById('daily-score-val');
const performanceRating = document.getElementById('performance-rating');
const scoreProgressRing = document.getElementById('score-progress');

const currentStreakVal = document.getElementById('current-streak-val');
const maxStreakVal = document.getElementById('max-streak-val');
const totalActivitiesCount = document.getElementById('total-activities-count');
const totalActivitiesCountBadge = document.getElementById('total-activities-count-badge');

const moodSlider = document.getElementById('mood-slider');
const moodValEmoji = document.getElementById('mood-val-emoji');
const moodValText = document.getElementById('mood-val-text');

const dailyNotesTextarea = document.getElementById('daily-notes-textarea');
const notesSaveStatus = document.getElementById('notes-save-status');

const activityForm = document.getElementById('activity-form');
const activityCategorySelect = document.getElementById('activity-category');
const activitySpecificDateInput = document.getElementById('activity-specific-date');
const specificDateGroup = document.getElementById('specific-date-group');
const configuredActivitiesList = document.getElementById('configured-activities-list');
const goToManagerBtn = document.getElementById('go-to-manager-btn');

const categoryForm = document.getElementById('category-form');

// Tomorrow Planner Modal Elements
const plannerModal = document.getElementById('planner-modal');
const closePlannerModalBtn = document.getElementById('close-planner-modal');
const cancelTomorrowPlanBtn = document.getElementById('cancel-tomorrow-plan-btn');
const tomorrowDateLabel = document.getElementById('tomorrow-date-label');
const tomorrowNotesInput = document.getElementById('tomorrow-notes');
const tomorrowActiveChecklist = document.getElementById('tomorrow-active-checklist');
const tomorrowTaskTitle = document.getElementById('tomorrow-task-title');
const tomorrowTaskCategory = document.getElementById('tomorrow-task-category');
const tomorrowTaskTime = document.getElementById('tomorrow-task-time');
const tomorrowAddTaskBtn = document.getElementById('tomorrow-add-task-btn');
const saveTomorrowPlanBtn = document.getElementById('save-tomorrow-plan-btn');

// Daily Finance Elements
const financeForm = document.getElementById('finance-form');
const fTotalIncome = document.getElementById('f-total-income');
const fTotalExpenses = document.getElementById('f-total-expenses');
const fNetBalance = document.getElementById('f-net-balance');
const financeSummaryBadge = document.getElementById('finance-summary-badge');
const ledgerList = document.getElementById('ledger-list');

// Life Goals Elements
const goalForm = document.getElementById('goal-form');
const goalCategorySelect = document.getElementById('goal-category');
const goalProgressSlider = document.getElementById('goal-progress-slider');
const goalProgressPercentageLabel = document.getElementById('goal-progress-percentage-label');
const totalGoalsBadge = document.getElementById('total-goals-badge');
const goalsListGrid = document.getElementById('goals-list-grid');

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Set initial date picker value
  datePicker.value = state.currentDate;
  
  // Set default tomorrow date on one-off activity creator
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  activitySpecificDateInput.value = getLocalDateString(tomorrow);

  setupEventListeners();
  initApp();
});

async function initApp() {
  await fetchCategories();
  await fetchActivities();
  await fetchGoals();
  await loadDateData(state.currentDate);
}

// -------------------------------------------------------------
// Event Listeners Setup
// -------------------------------------------------------------
function setupEventListeners() {
  // Date changes
  datePicker.addEventListener('change', (e) => {
    state.currentDate = e.target.value;
    loadDateData(state.currentDate);
  });
  
  prevDayBtn.addEventListener('click', () => {
    changeDate(-1);
  });
  
  nextDayBtn.addEventListener('click', () => {
    changeDate(1);
  });

  // Toggle date input visibility in activity form based on frequency choice
  document.querySelectorAll('input[name="activity-frequency"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'oneoff') {
        specificDateGroup.classList.remove('hidden');
      } else {
        specificDateGroup.classList.add('hidden');
      }
    });
  });

  // Tab switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      document.getElementById(tabId).classList.add('active');

      if (btn.dataset.tab === 'dashboard') {
        setTimeout(renderAnalyticsCharts, 100);
      }
    });
  });

  // Empty state button redirect to activities tab
  goToManagerBtn.addEventListener('click', () => {
    const actTab = Array.from(tabButtons).find(b => b.dataset.tab === 'activities');
    if (actTab) actTab.click();
  });

  // Mood Slider change
  moodSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    updateMoodUI(val);
  });
  
  moodSlider.addEventListener('change', () => {
    saveDailyLog();
  });

  // Notes area save
  dailyNotesTextarea.addEventListener('input', () => {
    setNotesStatus('Saving...', 'saving');
    
    // Auto-save debounced
    clearTimeout(notesSaveTimeout);
    notesSaveTimeout = setTimeout(() => {
      state.currentLog.notes = dailyNotesTextarea.value;
      saveDailyLog(true); // silent update
    }, 1000);
  });

  // Create Activity form
  activityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('activity-title').value.trim();
    const category = activityCategorySelect.value;
    const weight = document.querySelector('input[name="activity-weight"]:checked').value;
    const frequency = document.querySelector('input[name="activity-frequency"]:checked').value;
    const timeVal = document.getElementById('activity-time').value || null;
    
    const dateVal = frequency === 'oneoff' ? activitySpecificDateInput.value : null;

    if (title && category && weight) {
      await createActivity({ title, category, weight, date: dateVal, time: timeVal });
      activityForm.reset();
      specificDateGroup.classList.add('hidden');
      
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      activitySpecificDateInput.value = getLocalDateString(tomorrow);

      // Switch to dashboard
      const dashTab = Array.from(tabButtons).find(b => b.dataset.tab === 'dashboard');
      if (dashTab) dashTab.click();
    }
  });

  // Create Custom Category form
  categoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('category-name').value.trim();
    const icon = document.getElementById('category-icon').value.trim();

    if (name && icon) {
      await createCategory({ name, icon });
      categoryForm.reset();
    }
  });

  // Tomorrow Planner Trigger
  planTomorrowBtn.addEventListener('click', () => {
    openTomorrowPlanner();
  });

  // Closing / Cancel dialog actions
  closePlannerModalBtn.addEventListener('click', () => {
    plannerModal.classList.add('hidden');
  });

  cancelTomorrowPlanBtn.addEventListener('click', () => {
    plannerModal.classList.add('hidden');
  });

  // Quick Add task inside Tomorrow Planner Modal
  tomorrowAddTaskBtn.addEventListener('click', async () => {
    const title = tomorrowTaskTitle.value.trim();
    const category = tomorrowTaskCategory.value;
    const time = tomorrowTaskTime.value || null;
    const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));

    if (!title || !category) {
      alert('Please enter a task title and select a category.');
      return;
    }

    await createActivitySilent({
      title,
      category,
      weight: 'medium',
      date: tomorrowStr,
      time
    });

    tomorrowTaskTitle.value = '';
    tomorrowTaskTime.value = '';

    await fetchActivities();
    await reloadTomorrowLogCache(tomorrowStr);
  });

  // Save Tomorrow's schedule plan
  saveTomorrowPlanBtn.addEventListener('click', async () => {
    const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));
    
    // Collect checked switch values
    const checkedCheckboxes = tomorrowActiveChecklist.querySelectorAll('input[type="checkbox"]:checked');
    const selectedActiveIds = Array.from(checkedCheckboxes).map(cb => cb.dataset.id);
    const focusNotes = tomorrowNotesInput.value.trim();

    try {
      const res = await fetch(`/api/logs/${tomorrowStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeIds: selectedActiveIds,
          completedIds: tomorrowLogCache.completedIds,
          notes: focusNotes,
          mood: tomorrowLogCache.mood,
          finance: tomorrowLogCache.finance || { income: 0, expense: 0, transactions: [] }
        })
      });

      if (res.ok) {
        plannerModal.classList.add('hidden');
        
        state.currentDate = tomorrowStr;
        datePicker.value = state.currentDate;
        await loadDateData(state.currentDate);
      } else {
        alert('Failed to save tomorrow\'s schedule plan.');
      }
    } catch (err) {
      console.error('Error saving tomorrow plan:', err);
    }
  });

  // Finance form submit
  financeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const desc = document.getElementById('f-desc').value.trim();
    const amount = parseFloat(document.getElementById('f-amount').value);
    const type = document.getElementById('f-type').value;

    if (desc && !isNaN(amount)) {
      addFinanceTransaction({ desc, amount, type });
      financeForm.reset();
    }
  });

  // Life Goals form progress slider label
  goalProgressSlider.addEventListener('input', (e) => {
    goalProgressPercentageLabel.textContent = `${e.target.value}%`;
  });

  // Goal Form submit
  goalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('goal-title').value.trim();
    const category = goalCategorySelect.value;
    const targetDate = document.getElementById('goal-target-date').value;
    const progress = parseInt(goalProgressSlider.value);

    if (title && category && targetDate) {
      await createGoal({ title, category, targetDate, progress });
      goalForm.reset();
      goalProgressPercentageLabel.textContent = '0%';
    }
  });
}

// Change date offset
function changeDate(daysOffset) {
  const d = new Date(state.currentDate + 'T12:00:00'); // set mid-day to prevent daylight saving issues
  d.setDate(d.getDate() + daysOffset);
  state.currentDate = getLocalDateString(d);
  datePicker.value = state.currentDate;
  loadDateData(state.currentDate);
}

// -------------------------------------------------------------
// API Calls & State Sync
// -------------------------------------------------------------

// Fetch Categories
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    state.categories = await res.json();
    renderCategoriesDropdown();
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

// Create custom category
async function createCategory(catData) {
  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(catData)
    });
    
    if (!res.ok) {
      const errData = await res.json();
      alert(errData.error || 'Failed to create category.');
      return;
    }

    state.categories = await res.json();
    renderCategoriesDropdown();
    renderConfiguredActivitiesList();
    renderTodayChecklist();
  } catch (err) {
    console.error('Error creating category:', err);
  }
}

// Fetch activities
async function fetchActivities() {
  try {
    const res = await fetch('/api/activities');
    state.activities = await res.json();
    updateActivitiesCountUI();
    renderConfiguredActivitiesList();
  } catch (err) {
    console.error('Error fetching activities:', err);
  }
}

// Load daily log
async function loadDateData(dateStr) {
  try {
    const res = await fetch(`/api/logs/${dateStr}`);
    state.currentLog = await res.json();
    
    // Update local UI states
    dailyNotesTextarea.value = state.currentLog.notes || '';
    setNotesStatus('Saved', 'saved');
    
    moodSlider.value = state.currentLog.mood || 3;
    updateMoodUI(state.currentLog.mood || 3);
    
    const todayStr = getLocalDateString();
    const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));
    
    if (dateStr === todayStr) {
      checklistTitle.textContent = "Today's Checklist";
    } else if (dateStr === tomorrowStr) {
      checklistTitle.textContent = "Tomorrow's Checklist (Planning)";
    } else {
      checklistTitle.textContent = `Checklist for ${dateStr}`;
    }

    // Render Checklist & Finance Ledger
    renderTodayChecklist();
    renderFinanceLedger();
    
    // Load and render analytics charts
    await syncAnalytics();
  } catch (err) {
    console.error('Error loading log data:', err);
  }
}

// Save log to backend
async function saveDailyLog(silent = false) {
  try {
    if (!silent) setNotesStatus('Saving...', 'saving');
    
    const res = await fetch(`/api/logs/${state.currentDate}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activeIds: state.currentLog.activeIds,
        completedIds: state.currentLog.completedIds,
        notes: state.currentLog.notes,
        mood: parseInt(moodSlider.value),
        finance: state.currentLog.finance
      })
    });
    
    const data = await res.json();
    if (data.success) {
      if (!silent) setNotesStatus('Saved', 'saved');
      else setNotesStatus('Auto-saved', 'saved');
      
      // Update analytics stats (streaks & charts)
      await syncAnalytics();
    }
  } catch (err) {
    console.error('Error saving daily log:', err);
    setNotesStatus('Failed to save', 'error');
  }
}

// Create new activity
async function createActivity(activityData) {
  try {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityData)
    });
    
    state.activities = await res.json();
    updateActivitiesCountUI();
    renderConfiguredActivitiesList();
    
    // Reload date data to re-calculate scores
    await loadDateData(state.currentDate);
  } catch (err) {
    console.error('Error creating activity:', err);
  }
}

// Create new activity silently without full dashboard loading (for Tomorrow Planner modal adds)
async function createActivitySilent(activityData) {
  try {
    const res = await fetch('/api/activities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityData)
    });
    
    const acts = await res.json();
    return acts;
  } catch (err) {
    console.error('Error adding silent activity:', err);
  }
}

// Delete activity
async function deleteActivity(id) {
  if (!confirm('Are you sure you want to delete this activity? It will not affect past logged entries but will be removed from your daily checklist.')) {
    return;
  }
  
  try {
    const res = await fetch(`/api/activities/${id}`, {
      method: 'DELETE'
    });
    
    state.activities = await res.json();
    updateActivitiesCountUI();
    renderConfiguredActivitiesList();
    
    // Reload date data to re-calculate scores
    await loadDateData(state.currentDate);
  } catch (err) {
    console.error('Error deleting activity:', err);
  }
}

// Fetch Goals
async function fetchGoals() {
  try {
    const res = await fetch('/api/goals');
    state.goals = await res.json();
    renderGoalsList();
  } catch (err) {
    console.error('Error fetching goals:', err);
  }
}

// Create a goal
async function createGoal(goalData) {
  try {
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(goalData)
    });
    state.goals = await res.json();
    renderGoalsList();
  } catch (err) {
    console.error('Error creating goal:', err);
  }
}

// Update goal progress slider
async function updateGoalProgress(id, progressVal) {
  try {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: progressVal })
    });
    state.goals = await res.json();
    renderGoalsList();
  } catch (err) {
    console.error('Error updating goal progress:', err);
  }
}

// Delete goal
async function deleteGoal(id) {
  if (!confirm('Are you sure you want to delete this life goal?')) return;
  try {
    const res = await fetch(`/api/goals/${id}`, {
      method: 'DELETE'
    });
    state.goals = await res.json();
    renderGoalsList();
  } catch (err) {
    console.error('Error deleting goal:', err);
  }
}

// Fetch global stats and charts
async function syncAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    state.analytics = await res.json();
    
    updateAnalyticsSummaryUI();
    renderAnalyticsCharts();
  } catch (err) {
    console.error('Error syncing analytics:', err);
  }
}

// -------------------------------------------------------------
// UI Rendering Logic
// -------------------------------------------------------------

// Populate Category Dropdown Selectors
function renderCategoriesDropdown() {
  // Dropdown 1: Main Create Activity select
  activityCategorySelect.innerHTML = '<option value="" disabled selected>Select category...</option>';
  
  // Dropdown 2: Tomorrow Modal select
  tomorrowTaskCategory.innerHTML = '<option value="" disabled selected>Category...</option>';

  // Dropdown 3: Life Goals select
  goalCategorySelect.innerHTML = '<option value="" disabled selected>Select category...</option>';

  state.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = `${cat.icon} ${cat.name}`;
    activityCategorySelect.appendChild(opt);

    const optModal = document.createElement('option');
    optModal.value = cat.id;
    optModal.textContent = `${cat.icon} ${cat.name}`;
    tomorrowTaskCategory.appendChild(optModal);

    const optGoal = document.createElement('option');
    optGoal.value = cat.id;
    optGoal.textContent = `${cat.icon} ${cat.name}`;
    goalCategorySelect.appendChild(optGoal);
  });
}

// Today's Checklist View (Timeline sorted)
function renderTodayChecklist() {
  checklistList.innerHTML = '';
  
  // Filter activities that are active for the current date (included in currentLog.activeIds)
  const activeActivities = state.activities.filter(act => {
    return state.currentLog.activeIds.includes(act.id);
  });

  if (activeActivities.length === 0) {
    checklistEmptyState.classList.remove('hidden');
    checklistList.classList.add('hidden');
    updatePerformanceScoreUI(0);
    checklistProgressText.textContent = '0 / 0 Completed';
    return;
  }
  
  checklistEmptyState.classList.add('hidden');
  checklistList.classList.remove('hidden');
  
  let completedCount = 0;
  
  // Sort activities chronologically by time slot
  const sortedActivities = [...activeActivities].sort((a, b) => {
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    return 0;
  });
  
  sortedActivities.forEach(act => {
    const isCompleted = state.currentLog.completedIds.includes(act.id);
    if (isCompleted) completedCount++;
    
    const li = document.createElement('li');
    li.className = `checklist-item ${isCompleted ? 'checked' : ''}`;
    
    const catIcon = getCategoryEmoji(act.category);
    const dateLabelBadge = act.date ? `<span class="weight-badge" style="background: rgba(236, 72, 153, 0.12); color:#f472b6; border: 1px solid rgba(236,72,153,0.2);"><i class="fa-solid fa-calendar-day"></i> One-off</span>` : '';
    const timeLabelBadge = act.time ? `<span class="time-badge"><i class="fa-regular fa-clock"></i> ${formatTime12h(act.time)}</span>` : '';

    li.innerHTML = `
      <div class="checklist-item-left">
        <div class="checkbox-custom-wrapper">
          <input type="checkbox" data-id="${act.id}" ${isCompleted ? 'checked' : ''}>
          <span class="checkbox-custom-mark"></span>
        </div>
        <div class="checklist-item-text-wrapper">
          <span class="checklist-item-text">${act.title}</span>
          ${timeLabelBadge}
        </div>
      </div>
      <div class="meta-badges">
        ${dateLabelBadge}
        <span class="pill pill-dynamic">${catIcon} ${getCategoryName(act.category)}</span>
        <span class="weight-badge weight-${act.weight}">${act.weight}</span>
      </div>
    `;
    
    const clickArea = li.querySelector('.checklist-item-left');
    const checkbox = li.querySelector('input[type="checkbox"]');
    
    clickArea.addEventListener('click', (e) => {
      if (e.target !== checkbox && !e.target.closest('.checkbox-custom-wrapper')) {
        checkbox.checked = !checkbox.checked;
        handleCheckboxToggle(checkbox.dataset.id, checkbox.checked, li);
      }
    });
    
    checkbox.addEventListener('change', (e) => {
      handleCheckboxToggle(e.target.dataset.id, e.target.checked, li);
    });
    
    checklistList.appendChild(li);
  });
  
  checklistProgressText.textContent = `${completedCount} / ${activeActivities.length} Completed`;
  
  const score = calculateScore(state.currentLog.completedIds, activeActivities);
  updatePerformanceScoreUI(score);
}

// Handle checkbox toggle
function handleCheckboxToggle(id, isChecked, listItemElement) {
  if (isChecked) {
    if (!state.currentLog.completedIds.includes(id)) {
      state.currentLog.completedIds.push(id);
    }
    listItemElement.classList.add('checked');
  } else {
    state.currentLog.completedIds = state.currentLog.completedIds.filter(cid => cid !== id);
    listItemElement.classList.remove('checked');
  }
  
  const activeActivities = state.activities.filter(act => {
    return state.currentLog.activeIds.includes(act.id);
  });

  const score = calculateScore(state.currentLog.completedIds, activeActivities);
  updatePerformanceScoreUI(score);
  
  let completedCount = state.currentLog.completedIds.filter(cid => 
    activeActivities.some(act => act.id === cid)
  ).length;
  checklistProgressText.textContent = `${completedCount} / ${activeActivities.length} Completed`;
  
  if (score === 100) {
    triggerConfettiCelebration();
  }
  
  saveDailyLog();
}

// Calculation of daily score weighted
function calculateScore(completedIds, activities) {
  if (!activities || activities.length === 0) return 0;
  
  const weightMap = { high: 3, medium: 2, low: 1 };
  let totalPossibleWeight = 0;
  let earnedWeight = 0;
  
  activities.forEach(act => {
    const w = weightMap[act.weight] || 1;
    totalPossibleWeight += w;
    if (completedIds.includes(act.id)) {
      earnedWeight += w;
    }
  });
  
  return totalPossibleWeight > 0 ? Math.round((earnedWeight / totalPossibleWeight) * 100) : 0;
}

// Update performance circular ring & text
function updatePerformanceScoreUI(score) {
  dailyScoreVal.textContent = `${score}%`;
  
  const offset = CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * score) / 100;
  scoreProgressRing.style.strokeDashoffset = offset;
  
  const activeActivities = state.activities.filter(act => {
    return state.currentLog.activeIds.includes(act.id);
  });

  if (activeActivities.length === 0) {
    performanceRating.textContent = 'No Tasks';
    performanceRating.style.color = 'var(--text-muted)';
  } else if (score === 100) {
    performanceRating.textContent = 'Perfect! ✨';
    performanceRating.style.color = '#34d399';
  } else if (score >= 80) {
    performanceRating.textContent = 'Excellent! 🌟';
    performanceRating.style.color = 'var(--color-cyan)';
  } else if (score >= 50) {
    performanceRating.textContent = 'Great Work 👍';
    performanceRating.style.color = 'var(--color-purple)';
  } else if (score > 0) {
    performanceRating.textContent = 'In Progress 🔄';
    performanceRating.style.color = 'var(--color-orange)';
  } else {
    performanceRating.textContent = 'Get Started! 😐';
    performanceRating.style.color = 'var(--text-dark)';
  }
}

// List inside Activities Configurator Tab
function renderConfiguredActivitiesList() {
  configuredActivitiesList.innerHTML = '';
  
  if (state.activities.length === 0) {
    configuredActivitiesList.innerHTML = `
      <li class="empty-state">
        <i class="fa-solid fa-list-check empty-icon"></i>
        <p>No tracked activities found. Set your goals on the left!</p>
      </li>
    `;
    return;
  }
  
  state.activities.forEach(act => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    
    const catIcon = getCategoryEmoji(act.category);
    const catName = getCategoryName(act.category);
    const dateLabelBadge = act.date ? `<span class="weight-badge" style="background: rgba(236, 72, 153, 0.12); color:#f472b6;"><i class="fa-solid fa-calendar-day"></i> One-off (${act.date})</span>` : '<span class="weight-badge" style="background: rgba(168, 85, 247, 0.12); color:#c084fc;"><i class="fa-solid fa-repeat"></i> Recurring Daily</span>';
    const timeLabelBadge = act.time ? `<span class="weight-badge" style="background: rgba(6, 182, 212, 0.12); color:#22d3ee;"><i class="fa-solid fa-clock"></i> ${formatTime12h(act.time)}</span>` : '';

    li.innerHTML = `
      <div class="activity-item-details">
        <span class="activity-item-title">${act.title}</span>
        <div class="activity-item-meta">
          ${dateLabelBadge}
          ${timeLabelBadge}
          <span class="pill pill-dynamic">${catIcon} ${catName}</span>
          <span class="weight-badge weight-${act.weight}">${act.weight} weight</span>
        </div>
      </div>
      <div class="activity-actions">
        <button class="icon-btn btn-delete" data-id="${act.id}" title="Delete Activity">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    
    li.querySelector('.btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteActivity(act.id);
    });
    
    configuredActivitiesList.appendChild(li);
  });
}

// Render Daily Finance Ledger card logs
function renderFinanceLedger() {
  ledgerList.innerHTML = '';
  
  const finance = state.currentLog.finance || { income: 0, expense: 0, transactions: [] };
  const incomeVal = finance.income || 0;
  const expenseVal = finance.expense || 0;
  const netVal = incomeVal - expenseVal;

  fTotalIncome.textContent = `$${incomeVal.toFixed(2)}`;
  fTotalExpenses.textContent = `$${expenseVal.toFixed(2)}`;
  fNetBalance.textContent = `$${netVal.toFixed(2)}`;
  
  if (netVal >= 0) {
    fNetBalance.style.color = '#34d399';
    financeSummaryBadge.textContent = `Net: +$${netVal.toFixed(2)}`;
    financeSummaryBadge.style.color = '#34d399';
    financeSummaryBadge.style.background = 'rgba(16, 185, 129, 0.15)';
  } else {
    fNetBalance.style.color = '#f87171';
    financeSummaryBadge.textContent = `Net: -$${Math.abs(netVal).toFixed(2)}`;
    financeSummaryBadge.style.color = '#f87171';
    financeSummaryBadge.style.background = 'rgba(239, 68, 68, 0.15)';
  }

  if (finance.transactions.length === 0) {
    ledgerList.innerHTML = '<li class="empty-state" style="padding: 1rem;"><p class="form-help">No transactions logged for today.</p></li>';
    return;
  }

  finance.transactions.forEach(tx => {
    const li = document.createElement('li');
    li.className = 'ledger-item';

    const isInc = tx.type === 'income';
    li.innerHTML = `
      <div class="ledger-item-left">
        <span>${isInc ? '💰' : '💸'}</span>
        <span class="ledger-item-desc">${tx.desc}</span>
      </div>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="ledger-amount ${isInc ? 'income' : 'expense'}">${isInc ? '+' : '-'}$${parseFloat(tx.amount).toFixed(2)}</span>
        <button class="icon-btn btn-delete" data-id="${tx.id}" style="width:24px; height:24px; padding:0;" title="Delete Ledger Entry">
          <i class="fa-solid fa-trash" style="font-size:0.75rem;"></i>
        </button>
      </div>
    `;

    li.querySelector('.btn-delete').addEventListener('click', () => {
      deleteFinanceTransaction(tx.id);
    });

    ledgerList.appendChild(li);
  });
}

// Add financial transaction
function addFinanceTransaction({ desc, amount, type }) {
  if (!state.currentLog.finance) {
    state.currentLog.finance = { income: 0, expense: 0, transactions: [] };
  }

  const newTx = {
    id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 100),
    desc,
    amount,
    type
  };

  state.currentLog.finance.transactions.push(newTx);
  
  // Recalculate balances
  let income = 0;
  let expense = 0;
  state.currentLog.finance.transactions.forEach(tx => {
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  });

  state.currentLog.finance.income = income;
  state.currentLog.finance.expense = expense;

  renderFinanceLedger();
  saveDailyLog();
}

// Delete financial transaction
function deleteFinanceTransaction(txId) {
  if (!state.currentLog.finance || !state.currentLog.finance.transactions) return;

  state.currentLog.finance.transactions = state.currentLog.finance.transactions.filter(tx => tx.id !== txId);

  // Recalculate balances
  let income = 0;
  let expense = 0;
  state.currentLog.finance.transactions.forEach(tx => {
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  });

  state.currentLog.finance.income = income;
  state.currentLog.finance.expense = expense;

  renderFinanceLedger();
  saveDailyLog();
}

// Render Life Goals List Cards
function renderGoalsList() {
  goalsListGrid.innerHTML = '';
  totalGoalsBadge.textContent = `${state.goals.length} Goals`;

  if (state.goals.length === 0) {
    goalsListGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem;">
        <i class="fa-solid fa-bullseye empty-icon"></i>
        <p>No active goals defined. Set up some improvements on the left!</p>
      </div>
    `;
    return;
  }

  // Sort goals by deadline date chronologically
  const sortedGoals = [...state.goals].sort((a, b) => {
    return a.targetDate.localeCompare(b.targetDate);
  });

  sortedGoals.forEach(goal => {
    const card = document.createElement('div');
    const isCompleted = goal.progress === 100;
    card.className = `goal-card ${isCompleted ? 'completed' : ''}`;

    const catIcon = getCategoryEmoji(goal.category);
    const catName = getCategoryName(goal.category);
    
    // Calculate days remaining to target
    const now = new Date();
    now.setHours(0,0,0,0);
    const target = new Date(goal.targetDate + 'T00:00:00');
    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let deadlineText = '';
    if (diffDays > 1) {
      deadlineText = `${diffDays} days left`;
    } else if (diffDays === 1) {
      deadlineText = `Tomorrow deadline`;
    } else if (diffDays === 0) {
      deadlineText = `Deadline is TODAY`;
    } else {
      deadlineText = `${Math.abs(diffDays)} days overdue`;
    }

    card.innerHTML = `
      <div class="goal-card-header">
        <span class="goal-card-title">${goal.title}</span>
        <button class="icon-btn btn-delete" data-id="${goal.id}" title="Remove Goal">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.5rem;">
        <span class="pill pill-dynamic">${catIcon} ${catName}</span>
        <span class="goal-card-deadline ${diffDays < 0 ? 'text-red' : ''}">
          <i class="fa-regular fa-calendar-times"></i> ${goal.targetDate} (${deadlineText})
        </span>
      </div>

      <div class="goal-card-slider-wrapper">
        <div class="goal-card-slider-label">
          <span>Progress</span>
          <span class="progress-val-lbl text-purple">${goal.progress}%</span>
        </div>
        <div class="goal-progress-bar-bg">
          <div class="goal-progress-bar-fill" style="width: ${goal.progress}%;"></div>
        </div>
        <input type="range" min="0" max="100" value="${goal.progress}" class="mood-range-slider progress-slider" data-id="${goal.id}" style="margin-top:0.25rem;">
      </div>
    `;

    // Delete goal hook
    card.querySelector('.btn-delete').addEventListener('click', () => {
      deleteGoal(goal.id);
    });

    // Slider slide progress tracker drag hook
    const slider = card.querySelector('.progress-slider');
    const label = card.querySelector('.progress-val-lbl');
    const fill = card.querySelector('.goal-progress-bar-fill');

    slider.addEventListener('input', (e) => {
      const val = e.target.value;
      label.textContent = `${val}%`;
      fill.style.width = `${val}%`;
      if (val === '100') {
        card.classList.add('completed');
      } else {
        card.classList.remove('completed');
      }
    });

    slider.addEventListener('change', (e) => {
      const val = parseInt(e.target.value);
      updateGoalProgress(goal.id, val);
      if (val === 100) {
        triggerConfettiCelebration();
      }
    });

    goalsListGrid.appendChild(card);
  });
}

// Mood UI synchronization
function updateMoodUI(val) {
  const emojiMap = {
    1: '😫',
    2: '🙁',
    3: '😐',
    4: '🙂',
    5: '🌟'
  };
  
  const textMap = {
    1: 'Exhausted / Awful',
    2: 'Low Focus / Meh',
    3: 'Average / Flat',
    4: 'Good / Productive',
    5: 'High Aura / Exceptional'
  };
  
  moodValEmoji.textContent = emojiMap[val] || '😐';
  moodValText.textContent = textMap[val] || 'Average';
  
  const colorMap = {
    1: 'var(--color-red)',
    2: 'var(--color-orange)',
    3: 'var(--text-muted)',
    4: 'var(--color-indigo)',
    5: 'var(--color-cyan)'
  };
  moodValText.style.color = colorMap[val];
}

// Activity Count updates
function updateActivitiesCountUI() {
  const count = state.activities.length;
  totalActivitiesCount.textContent = count;
  totalActivitiesCountBadge.textContent = `${count} Total`;
}

// Sync Summary Data (Streaks, counts)
function updateAnalyticsSummaryUI() {
  if (!state.analytics) return;
  
  currentStreakVal.textContent = state.analytics.currentStreak;
  maxStreakVal.textContent = `${state.analytics.maxStreak} days`;
}

// Notes status text helper
function setNotesStatus(text, statusClass) {
  notesSaveStatus.textContent = text;
  notesSaveStatus.className = ''; 
  if (statusClass) {
    notesSaveStatus.classList.add(statusClass);
  }
}

// Dynamic Emojis & Names from Database
function getCategoryEmoji(catId) {
  const match = state.categories.find(c => c.id === catId || c.name.toLowerCase() === catId.toLowerCase());
  return match ? match.icon : '📋';
}

function getCategoryName(catId) {
  const match = state.categories.find(c => c.id === catId || c.name.toLowerCase() === catId.toLowerCase());
  return match ? match.name : catId;
}

// -------------------------------------------------------------
// Tomorrow's Planner Modal Logic
// -------------------------------------------------------------
async function openTomorrowPlanner() {
  const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));
  tomorrowDateLabel.textContent = tomorrowStr;
  
  tomorrowActiveChecklist.innerHTML = '<p class="section-subtitle">Loading activities...</p>';
  plannerModal.classList.remove('hidden');

  await reloadTomorrowLogCache(tomorrowStr);
}

// Fetch log for tomorrow to cache it
async function reloadTomorrowLogCache(tomorrowStr) {
  try {
    const res = await fetch(`/api/logs/${tomorrowStr}`);
    tomorrowLogCache = await res.json();
    
    tomorrowNotesInput.value = tomorrowLogCache.notes || '';
    renderTomorrowChecklistToggles(tomorrowStr);
  } catch (err) {
    console.error('Error fetching tomorrow cache:', err);
  }
}

// Render the list of tasks with switch toggles inside the modal
function renderTomorrowChecklistToggles(tomorrowStr) {
  tomorrowActiveChecklist.innerHTML = '';
  
  // Filter activities: recurring OR scheduled for tomorrow
  const eligibleActivities = state.activities.filter(act => {
    return !act.date || act.date === tomorrowStr;
  });

  if (eligibleActivities.length === 0) {
    tomorrowActiveChecklist.innerHTML = '<p class="section-subtitle">No activities defined yet. Create some in the Activity Manager!</p>';
    return;
  }

  eligibleActivities.sort((a, b) => {
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) {
      return a.time.localeCompare(b.time);
    }
    return 0;
  });

  eligibleActivities.forEach(act => {
    const isScheduled = tomorrowLogCache.activeIds.includes(act.id);
    
    const div = document.createElement('div');
    div.className = 'planner-toggle-item';
    
    const catIcon = getCategoryEmoji(act.category);
    const formattedTime = act.time ? ` [${formatTime12h(act.time)}]` : '';

    div.innerHTML = `
      <span class="planner-toggle-label">
        <span>${catIcon} ${act.title}${formattedTime}</span>
      </span>
      <div class="planner-toggle-meta">
        <span class="weight-badge weight-${act.weight}">${act.weight}</span>
        <label class="switch">
          <input type="checkbox" data-id="${act.id}" ${isScheduled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
    `;
    
    tomorrowActiveChecklist.appendChild(div);
  });
}

// -------------------------------------------------------------
// Chart.js Graphs Rendering
// -------------------------------------------------------------
function renderAnalyticsCharts() {
  if (!state.analytics) return;
  
  const activeTab = document.querySelector('.nav-tab.active');
  if (!activeTab || activeTab.dataset.tab !== 'dashboard') return;

  Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
  Chart.defaults.font.family = 'Inter';

  // 1. Weekly Performance Chart (Line Chart)
  const last7DaysData = state.analytics.last7Days;
  const labels = last7DaysData.map(d => d.dayName);
  const scores = last7DaysData.map(d => d.score);
  
  const ctxWeekly = document.getElementById('weekly-chart').getContext('2d');
  
  if (weeklyChartInstance) {
    weeklyChartInstance.destroy();
  }
  
  const purpleGradient = ctxWeekly.createLinearGradient(0, 0, 0, 200);
  purpleGradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
  purpleGradient.addColorStop(1, 'rgba(168, 85, 247, 0.0)');

  weeklyChartInstance = new Chart(ctxWeekly, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Daily Score (%)',
        data: scores,
        borderColor: '#a855f7',
        borderWidth: 3,
        backgroundColor: purpleGradient,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#6366f1',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });

  // 2. Category Distribution Chart (Doughnut Chart)
  const categoryCounts = state.analytics.categoryCounts;
  const catLabels = [];
  const catData = [];
  
  const colorsMap = {
    'cat-health': '#10b981',
    'cat-work': '#6366f1',
    'cat-learning': '#06b6d4',
    'cat-leisure': '#ec4899',
    'cat-routine': '#6b7280'
  };
  const backgroundColors = [];

  Object.entries(categoryCounts).forEach(([catId, val]) => {
    const emoji = getCategoryEmoji(catId);
    const name = getCategoryName(catId);
    catLabels.push(`${emoji} ${name}`);
    catData.push(val);
    backgroundColors.push(colorsMap[catId] || '#8b5cf6');
  });

  const ctxCategory = document.getElementById('category-chart').getContext('2d');
  
  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  const totalCompletions = catData.reduce((a, b) => a + b, 0);

  categoryChartInstance = new Chart(ctxCategory, {
    type: 'doughnut',
    data: {
      labels: totalCompletions > 0 ? catLabels : ['No Completions Yet'],
      datasets: [{
        data: totalCompletions > 0 ? catData : [1],
        backgroundColor: totalCompletions > 0 ? backgroundColors : ['rgba(255,255,255,0.06)'],
        borderColor: 'rgba(11, 15, 25, 0.8)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 12, padding: 15 }
        }
      },
      cutout: '70%'
    }
  });
}

// -------------------------------------------------------------
// Interactive Animations
// -------------------------------------------------------------
function triggerConfettiCelebration() {
  if (typeof confetti !== 'undefined') {
    const duration = 2.5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 25, spread: 360, ticks: 50, zIndex: 999 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 40 * (timeLeft / duration);
      
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
  }
}
