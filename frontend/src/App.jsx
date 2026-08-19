import { useState, useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'
import confetti from 'canvas-confetti'
import Swal from 'sweetalert2'

const CIRCLE_CIRCUMFERENCE = 314.16; // 2 * pi * r (r=50)

// Helper: timezone-safe local YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 10);
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

function App() {
  // App State
  const [currentDate, setCurrentDate] = useState(getLocalDateString());
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [goals, setGoals] = useState([]);
  const [currentLog, setCurrentLog] = useState({
    activeIds: [],
    completedIds: [],
    notes: '',
    mood: 3,
    finance: { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] }
  });
  const [analytics, setAnalytics] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard'); // 'dashboard', 'activities', 'goals'

  // Input States
  const [notesInput, setNotesInput] = useState('');
  const [notesStatus, setNotesStatus] = useState('Saved');
  
  // Create Activity form state
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityCategory, setNewActivityCategory] = useState('');
  const [newActivityFreq, setNewActivityFreq] = useState('recurring');
  const [newActivityDate, setNewActivityDate] = useState('');
  const [newActivityTime, setNewActivityTime] = useState('');
  const [newActivityWeight, setNewActivityWeight] = useState('low');

  // Create Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('');

  // Create Goal form state
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalCategory, setNewGoalCategory] = useState('');
  const [newGoalTargetDate, setNewGoalTargetDate] = useState('');
  const [newGoalProgress, setNewGoalProgress] = useState(0);

  // Edit Activity Modal state
  const [editingActivity, setEditingActivity] = useState(null);
  const [editActivityTitle, setEditActivityTitle] = useState('');
  const [editActivityCategory, setEditActivityCategory] = useState('');
  const [editActivityFreq, setEditActivityFreq] = useState('recurring');
  const [editActivityDate, setEditActivityDate] = useState('');
  const [editActivityTime, setEditActivityTime] = useState('');
  const [editActivityWeight, setEditActivityWeight] = useState('low');

  // Edit Goal Modal state
  const [editingGoal, setEditingGoal] = useState(null);
  const [editGoalTitle, setEditGoalTitle] = useState('');
  const [editGoalCategory, setEditGoalCategory] = useState('');
  const [editGoalTargetDate, setEditGoalTargetDate] = useState('');
  const [editGoalProgress, setEditGoalProgress] = useState(0);

  // Add Transaction form state
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxType, setNewTxType] = useState('expense');

  // Tomorrow Planner Modal state
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [tomorrowNotes, setTomorrowNotes] = useState('');
  const [tomorrowActiveIds, setTomorrowActiveIds] = useState([]);
  const [tomorrowNewTaskTitle, setTomorrowNewTaskTitle] = useState('');
  const [tomorrowNewTaskCategory, setTomorrowNewTaskCategory] = useState('');
  const [tomorrowNewTaskTime, setTomorrowNewTaskTime] = useState('');

  // Chart Refs
  const weeklyCanvasRef = useRef(null);
  const categoryCanvasRef = useRef(null);
  const weeklyChartRef = useRef(null);
  const categoryChartRef = useRef(null);

  // Notes debounce ref
  const notesSaveTimeoutRef = useRef(null);

  // Initial Load
  useEffect(() => {
    async function loadInitialData() {
      await fetchCategories();
      await fetchActivities();
      await fetchGoals();
      await loadDateData(currentDate);
    }
    loadInitialData();

    // Set default date for one-off activity to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNewActivityDate(getLocalDateString(tomorrow));
  }, []);

  // Sync date changes
  useEffect(() => {
    loadDateData(currentDate);
  }, [currentDate]);

  // Sync Notes Input to Current Log Notes
  useEffect(() => {
    if (currentLog) {
      setNotesInput(currentLog.notes || '');
    }
  }, [currentLog]);

  // Debounced notes autosaving
  const handleNotesChange = (e) => {
    const value = e.target.value;
    setNotesInput(value);
    setNotesStatus('Saving...');

    if (notesSaveTimeoutRef.current) {
      clearTimeout(notesSaveTimeoutRef.current);
    }

    notesSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const updatedLog = { ...currentLog, notes: value };
        const res = await fetch(`/api/logs/${currentDate}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            activeIds: updatedLog.activeIds,
            completedIds: updatedLog.completedIds,
            notes: value,
            mood: updatedLog.mood,
            finance: updatedLog.finance
          })
        });
        const data = await res.json();
        if (data.success) {
          setCurrentLog(data.log);
          setNotesStatus('Auto-saved');
          await syncAnalytics();
        }
      } catch (err) {
        console.error('Error saving notes:', err);
        setNotesStatus('Failed to save');
      }
    }, 1000);
  };

  // Render Chart.js on tab dashboard / analytics change
  useEffect(() => {
    if (currentTab !== 'dashboard' || !analytics) return;

    // 1. Weekly performance chart
    if (weeklyCanvasRef.current) {
      if (weeklyChartRef.current) {
        weeklyChartRef.current.destroy();
      }
      Chart.defaults.color = 'rgba(255, 255, 255, 0.5)';
      Chart.defaults.font.family = 'Inter';

      const ctx = weeklyCanvasRef.current.getContext('2d');
      const last7DaysData = analytics.last7Days || [];
      const labels = last7DaysData.map(d => d.dayName);
      const scores = last7DaysData.map(d => d.score);

      const purpleGradient = ctx.createLinearGradient(0, 0, 0, 200);
      purpleGradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
      purpleGradient.addColorStop(1, 'rgba(168, 85, 247, 0)');

      weeklyChartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
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
          plugins: { legend: { display: false } },
          scales: {
            y: { min: 0, max: 100, grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 2. Category breakup chart
    if (categoryCanvasRef.current) {
      if (categoryChartRef.current) {
        categoryChartRef.current.destroy();
      }

      const ctx = categoryCanvasRef.current.getContext('2d');
      const categoryCounts = analytics.categoryCounts || {};
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
        const catLabel = getCategoryName(catId);
        const catIcon = getCategoryEmoji(catId);
        catLabels.push(`${catIcon} ${catLabel}`);
        catData.push(val);
        backgroundColors.push(colorsMap[catId] || '#8b5cf6');
      });

      const totalCompletions = catData.reduce((a, b) => a + b, 0);

      categoryChartRef.current = new Chart(ctx, {
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

    return () => {
      if (weeklyChartRef.current) weeklyChartRef.current.destroy();
      if (categoryChartRef.current) categoryChartRef.current.destroy();
    };
  }, [currentTab, analytics, categories]);

  // -------------------------------------------------------------
  // API Core Methods
  // -------------------------------------------------------------
  async function fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
      if (data.length > 0) {
        setNewActivityCategory(data[0].id);
        setNewGoalCategory(data[0].id);
        setTomorrowNewTaskCategory(data[0].id);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }

  async function fetchActivities() {
    try {
      const res = await fetch('/api/activities');
      const data = await res.json();
      setActivities(data);
    } catch (err) {
      console.error('Error fetching activities:', err);
    }
  }

  async function fetchGoals() {
    try {
      const res = await fetch('/api/goals');
      const data = await res.json();
      setGoals(data);
    } catch (err) {
      console.error('Error fetching goals:', err);
    }
  }

  async function loadDateData(dateStr) {
    try {
      const res = await fetch(`/api/logs/${dateStr}`);
      const data = await res.json();
      setCurrentLog(data);
      setNotesStatus('Saved');
      await syncAnalytics();
    } catch (err) {
      console.error('Error loading daily log:', err);
    }
  }

  async function syncAnalytics() {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error syncing analytics:', err);
    }
  }

  // Save current log explicitly
  async function saveLog(updatedLog) {
    try {
      const res = await fetch(`/api/logs/${currentDate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedLog)
      });
      const data = await res.json();
      if (data.success) {
        setCurrentLog(data.log);
        await syncAnalytics();
      }
    } catch (err) {
      console.error('Error saving log:', err);
    }
  }

  // Confetti celebration trigger
  function triggerConfetti() {
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

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  const getCategoryEmoji = (catId) => {
    const cat = categories.find(c => c.id === catId || c.name.toLowerCase() === catId.toLowerCase());
    return cat ? cat.icon : '📋';
  };

  const getCategoryName = (catId) => {
    const cat = categories.find(c => c.id === catId || c.name.toLowerCase() === catId.toLowerCase());
    return cat ? cat.name : catId;
  };

  const activeActivities = activities.filter(act => currentLog.activeIds.includes(act.id));
  const completedCount = currentLog.completedIds.filter(id => activeActivities.some(act => act.id === id)).length;

  const currentScore = (() => {
    if (activeActivities.length === 0) return 0;
    const weightMap = { high: 3, medium: 2, low: 1 };
    let totalPossibleWeight = 0;
    let earnedWeight = 0;
    activeActivities.forEach(act => {
      const w = weightMap[act.weight] || 1;
      totalPossibleWeight += w;
      if (currentLog.completedIds.includes(act.id)) {
        earnedWeight += w;
      }
    });
    return totalPossibleWeight > 0 ? Math.round((earnedWeight / totalPossibleWeight) * 100) : 0;
  })();

  // -------------------------------------------------------------
  // User Actions
  // -------------------------------------------------------------
  const handleCheckboxToggle = async (id, isChecked) => {
    let completed = [...currentLog.completedIds];
    if (isChecked) {
      if (!completed.includes(id)) {
        completed.push(id);
      }
    } else {
      completed = completed.filter(cid => cid !== id);
    }

    const updatedLog = { ...currentLog, completedIds: completed };
    setCurrentLog(updatedLog);

    // Calculate score for celebration
    const weightMap = { high: 3, medium: 2, low: 1 };
    let totalPossibleWeight = 0;
    let earnedWeight = 0;
    activeActivities.forEach(act => {
      const w = weightMap[act.weight] || 1;
      totalPossibleWeight += w;
      if (completed.includes(act.id)) {
        earnedWeight += w;
      }
    });
    const score = totalPossibleWeight > 0 ? Math.round((earnedWeight / totalPossibleWeight) * 100) : 0;

    if (score === 100) {
      triggerConfetti();
    }

    await saveLog(updatedLog);
  };

  const changeDate = (daysOffset) => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + daysOffset);
    setCurrentDate(getLocalDateString(d));
  };

  const handleMoodChange = async (e) => {
    const moodVal = parseInt(e.target.value);
    const updatedLog = { ...currentLog, mood: moodVal };
    setCurrentLog(updatedLog);
    await saveLog(updatedLog);
  };

  // Add Custom Category submit
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatName || !newCatIcon) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName, icon: newCatIcon })
      });
      if (!res.ok) {
        const err = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: err.error || 'Failed to create category.',
          background: '#111827',
          color: '#f3f4f6'
        });
        return;
      }
      const data = await res.json();
      setCategories(data);
      setNewCatName('');
      setNewCatIcon('');
      Swal.fire({
        icon: 'success',
        title: 'Category Created!',
        text: 'Custom category has been added successfully.',
        background: '#111827',
        color: '#f3f4f6',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Add Activity submit
  const handleCreateActivity = async (e) => {
    e.preventDefault();
    if (!newActivityTitle || !newActivityCategory) return;

    const payload = {
      title: newActivityTitle,
      category: newActivityCategory,
      weight: newActivityWeight,
      date: newActivityFreq === 'oneoff' ? newActivityDate : null,
      time: newActivityTime || null
    };

    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: err.error || 'Failed to create activity.',
          background: '#111827',
          color: '#f3f4f6'
        });
        return;
      }
      const data = await res.json();
      setActivities(data);
      setNewActivityTitle('');
      setNewActivityTime('');
      await loadDateData(currentDate);
      Swal.fire({
        icon: 'success',
        title: 'Activity Created!',
        text: 'Task has been added and scheduled successfully.',
        background: '#111827',
        color: '#f3f4f6',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteActivity = async (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to delete this activity? Past logged history is retained, but it will be removed from future checklist schedules.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#a855f7',
      cancelButtonColor: '#4b5563',
      confirmButtonText: 'Yes, delete it!',
      background: '#111827',
      color: '#f3f4f6'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json();
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: err.error || 'Failed to delete activity.',
              background: '#111827',
              color: '#f3f4f6'
            });
            return;
          }
          const data = await res.json();
          setActivities(data);
          await loadDateData(currentDate);
          Swal.fire({
            icon: 'success',
            title: 'Deleted!',
            text: 'Activity has been removed.',
            background: '#111827',
            color: '#f3f4f6',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // Start edit activity
  const handleStartEditActivity = (act) => {
    setEditingActivity(act);
    setEditActivityTitle(act.title);
    setEditActivityCategory(act.category);
    setEditActivityFreq(act.date ? 'oneoff' : 'recurring');
    setEditActivityDate(act.date || getLocalDateString(new Date(Date.now() + 86400000)));
    setEditActivityTime(act.time || '');
    setEditActivityWeight(act.weight);
  };

  // Save edit activity
  const handleSaveEditActivity = async (e) => {
    e.preventDefault();
    if (!editActivityTitle || !editActivityCategory) return;

    const payload = {
      title: editActivityTitle,
      category: editActivityCategory,
      weight: editActivityWeight,
      date: editActivityFreq === 'oneoff' ? editActivityDate : null,
      time: editActivityTime || null
    };

    try {
      const res = await fetch(`/api/activities/${editingActivity.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: err.error || 'Failed to update activity.',
          background: '#111827',
          color: '#f3f4f6'
        });
        return;
      }
      const data = await res.json();
      setActivities(data);
      setEditingActivity(null);
      await loadDateData(currentDate);
      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: 'Activity updated successfully.',
        background: '#111827',
        color: '#f3f4f6',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Create life goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoalTitle || !newGoalCategory || !newGoalTargetDate) return;

    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newGoalTitle,
          category: newGoalCategory,
          targetDate: newGoalTargetDate,
          progress: newGoalProgress
        })
      });
      if (!res.ok) {
        const err = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: err.error || 'Failed to create goal.',
          background: '#111827',
          color: '#f3f4f6'
        });
        return;
      }
      const data = await res.json();
      setGoals(data);
      setNewGoalTitle('');
      setNewGoalTargetDate('');
      setNewGoalProgress(0);
      Swal.fire({
        icon: 'success',
        title: 'Goal Configured!',
        text: 'New milestone goal has been recorded.',
        background: '#111827',
        color: '#f3f4f6',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Start Edit Goal
  const handleStartEditGoal = (g) => {
    setEditingGoal(g);
    setEditGoalTitle(g.title);
    setEditGoalCategory(g.category);
    setEditGoalTargetDate(g.targetDate);
    setEditGoalProgress(g.progress);
  };

  // Save Edit Goal
  const handleSaveEditGoal = async (e) => {
    e.preventDefault();
    if (!editGoalTitle || !editGoalCategory || !editGoalTargetDate) return;

    try {
      const res = await fetch(`/api/goals/${editingGoal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editGoalTitle,
          category: editGoalCategory,
          targetDate: editGoalTargetDate,
          progress: editGoalProgress
        })
      });
      if (!res.ok) {
        const err = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: err.error || 'Failed to update goal.',
          background: '#111827',
          color: '#f3f4f6'
        });
        return;
      }
      const data = await res.json();
      setGoals(data);
      setEditingGoal(null);
      if (editGoalProgress === 100) {
        triggerConfetti();
      }
      Swal.fire({
        icon: 'success',
        title: 'Saved!',
        text: 'Life goal details saved.',
        background: '#111827',
        color: '#f3f4f6',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoalProgressChange = async (id, value) => {
    try {
      const res = await fetch(`/api/goals/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: value })
      });
      if (!res.ok) {
        const err = await res.json();
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: err.error || 'Failed to update goal progress.',
          background: '#111827',
          color: '#f3f4f6'
        });
        return;
      }
      const data = await res.json();
      setGoals(data);
      if (value === 100) {
        triggerConfetti();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGoal = async (id) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you really want to delete this life goal milestone?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#a855f7',
      cancelButtonColor: '#4b5563',
      confirmButtonText: 'Yes, delete goal!',
      background: '#111827',
      color: '#f3f4f6'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
          if (!res.ok) {
            const err = await res.json();
            Swal.fire({
              icon: 'error',
              title: 'Oops...',
              text: err.error || 'Failed to delete goal.',
              background: '#111827',
              color: '#f3f4f6'
            });
            return;
          }
          const data = await res.json();
          setGoals(data);
          Swal.fire({
            icon: 'success',
            title: 'Goal Removed!',
            text: 'Life goal deleted successfully.',
            background: '#111827',
            color: '#f3f4f6',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (err) {
          console.error(err);
        }
      }
    });
  };

  // Ledger actions
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!newTxDesc || !newTxAmount) return;

    const amountNum = parseFloat(newTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    const finance = currentLog.finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] };
    const transactions = Array.isArray(finance.transactions) ? [...finance.transactions] : [];
    
    const newTx = {
      id: 'tx-' + Date.now() + '-' + Math.floor(Math.random() * 100),
      desc: newTxDesc,
      amount: amountNum,
      type: newTxType
    };
    transactions.push(newTx);

    let income = 0, expense = 0, debt = 0, receivable = 0;
    transactions.forEach(tx => {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === 'income') income += amt;
      else if (tx.type === 'expense') expense += amt;
      else if (tx.type === 'debt') debt += amt;
      else if (tx.type === 'receivable') receivable += amt;
    });

    const updatedLog = {
      ...currentLog,
      finance: { income, expense, debt, receivable, transactions }
    };

    setCurrentLog(updatedLog);
    setNewTxDesc('');
    setNewTxAmount('');
    await saveLog(updatedLog);
  };

  const handleDeleteTransaction = async (txId) => {
    const finance = currentLog.finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] };
    const transactions = (finance.transactions || []).filter(tx => tx.id !== txId);

    let income = 0, expense = 0, debt = 0, receivable = 0;
    transactions.forEach(tx => {
      const amt = parseFloat(tx.amount) || 0;
      if (tx.type === 'income') income += amt;
      else if (tx.type === 'expense') expense += amt;
      else if (tx.type === 'debt') debt += amt;
      else if (tx.type === 'receivable') receivable += amt;
    });

    const updatedLog = {
      ...currentLog,
      finance: { income, expense, debt, receivable, transactions }
    };

    setCurrentLog(updatedLog);
    await saveLog(updatedLog);
  };

  // -------------------------------------------------------------
  // Tomorrow Planner Modal Handlers
  // -------------------------------------------------------------
  const handleOpenTomorrowPlanner = async () => {
    const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));
    try {
      const res = await fetch(`/api/logs/${tomorrowStr}`);
      const data = await res.json();
      setTomorrowNotes(data.notes || '');
      setTomorrowActiveIds(data.activeIds || []);
      setIsPlannerOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTomorrowToggleChange = (actId, checked) => {
    if (checked) {
      if (!tomorrowActiveIds.includes(actId)) {
        setTomorrowActiveIds([...tomorrowActiveIds, actId]);
      }
    } else {
      setTomorrowActiveIds(tomorrowActiveIds.filter(id => id !== actId));
    }
  };

  const handleAddTomorrowTask = async () => {
    if (!tomorrowNewTaskTitle) return;
    const payload = {
      title: tomorrowNewTaskTitle,
      category: tomorrowNewTaskCategory,
      weight: 'low', // Default weight for quick modal additions
      date: getLocalDateString(new Date(Date.now() + 86400000)), // One-off scheduled for tomorrow
      time: tomorrowNewTaskTime || null
    };

    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setActivities(data);
      
      const newAct = data[data.length - 1]; // usually the last element is the newest
      if (newAct) {
        setTomorrowActiveIds([...tomorrowActiveIds, newAct.id]);
      }
      setTomorrowNewTaskTitle('');
      setTomorrowNewTaskTime('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTomorrowPlan = async () => {
    const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));
    try {
      const checkRes = await fetch(`/api/logs/${tomorrowStr}`);
      const existing = await checkRes.json();

      const res = await fetch(`/api/logs/${tomorrowStr}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activeIds: tomorrowActiveIds,
          completedIds: existing.completedIds || [],
          notes: tomorrowNotes,
          mood: existing.mood || 3,
          finance: existing.finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] }
        })
      });

      if (res.ok) {
        setIsPlannerOpen(false);
        setCurrentDate(tomorrowStr);
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Failed to save tomorrow\'s plan schedule.',
          background: '#111827',
          color: '#f3f4f6'
        });
      }
    } catch (err) {
      console.error('Error saving tomorrow plan:', err);
    }
  };

  // Mood configuration UI mapper
  const moodEmoji = { 1: '😫', 2: '🙁', 3: '😐', 4: '🙂', 5: '🌟' }[currentLog.mood || 3] || '😐';
  const moodText = {
    1: 'Exhausted / Awful',
    2: 'Low Focus / Meh',
    3: 'Average / Flat',
    4: 'Good / Productive',
    5: 'High Aura / Exceptional'
  }[currentLog.mood || 3] || 'Average';
  const moodTextColor = {
    1: 'var(--color-red)',
    2: 'var(--color-orange)',
    3: 'var(--text-muted)',
    4: 'var(--color-indigo)',
    5: 'var(--color-cyan)'
  }[currentLog.mood || 3] || 'var(--text-muted)';

  // Sorted checklist activities
  const sortedActiveActivities = [...activeActivities].sort((a, b) => {
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  });

  const tomorrowStr = getLocalDateString(new Date(Date.now() + 86400000));
  const todayStr = getLocalDateString();

  return (
    <>
      <div className="glow-bg"></div>

      <div className="app-container">
        {/* Header Area */}
        <header className="app-header">
          <div className="brand">
            <div className="brand-logo">
              <i className="fa-solid fa-circle-nodes logo-icon"></i>
            </div>
            <div className="brand-text">
              <h1 className="arabic-title">دائماً</h1>
              <p>تعقب أدائك اليومي • Daily Tracker</p>
            </div>
          </div>

          {/* Date Navigation Controls */}
          <div className="date-navigator">
            <button className="nav-btn" onClick={() => changeDate(-1)} aria-label="Previous day">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <div className="calendar-wrapper">
              <i className="fa-regular fa-calendar-days calendar-icon"></i>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="date-input"
              />
            </div>
            <button className="nav-btn" onClick={() => changeDate(1)} aria-label="Next day">
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <button className="action-btn outline-btn short-btn" onClick={handleOpenTomorrowPlanner}>
              <i className="fa-solid fa-calendar-plus icon-purple"></i> Plan Tomorrow
            </button>
          </div>

          {/* Dashboard Navigation Tabs */}
          <nav className="app-nav">
            <button
              className={`nav-tab ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setCurrentTab('dashboard')}
            >
              <i className="fa-solid fa-chart-pie"></i> Dashboard
            </button>
            <button
              className={`nav-tab ${currentTab === 'activities' ? 'active' : ''}`}
              onClick={() => setCurrentTab('activities')}
            >
              <i className="fa-solid fa-list-check"></i> Manage Tasks
            </button>
            <button
              className={`nav-tab ${currentTab === 'goals' ? 'active' : ''}`}
              onClick={() => setCurrentTab('goals')}
            >
              <i className="fa-solid fa-bullseye"></i> Life Goals
            </button>
          </nav>
        </header>

        {/* Main Content Area */}
        <main className="main-content">
          
          {/* Tab 1: Dashboard */}
          {currentTab === 'dashboard' && (
            <section id="tab-dashboard" className="tab-pane active">
              {/* Quick Stats Cards Grid */}
              <div className="stats-grid">
                
                {/* Score Card */}
                <div className="stat-card score-card glass-panel">
                  <div className="card-header">
                    <h3>Daily Performance</h3>
                    <i className="fa-solid fa-gauge-high card-icon text-purple"></i>
                  </div>
                  <div className="score-circle-container">
                    <div className="score-circle">
                      <svg className="progress-ring" width="120" height="120">
                        <circle
                          className="progress-ring__circle-bg"
                          stroke="rgba(255,255,255,0.05)"
                          strokeWidth="8"
                          fill="transparent"
                          r="50"
                          cx="60"
                          cy="60"
                        />
                        <circle
                          className="progress-ring__circle"
                          stroke="url(#score-grad)"
                          strokeWidth="8"
                          strokeDasharray={CIRCLE_CIRCUMFERENCE}
                          strokeDashoffset={CIRCLE_CIRCUMFERENCE - (CIRCLE_CIRCUMFERENCE * currentScore) / 100}
                          fill="transparent"
                          r="50"
                          cx="60"
                          cy="60"
                        />
                        <defs>
                          <linearGradient id="score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="score-text">
                        <span>{currentScore}%</span>
                        <p style={{ color: activeActivities.length === 0 ? 'var(--text-muted)' : currentScore === 100 ? '#34d399' : currentScore >= 80 ? 'var(--color-cyan)' : currentScore >= 50 ? 'var(--color-purple)' : currentScore > 0 ? 'var(--color-orange)' : 'var(--text-dark)' }}>
                          {activeActivities.length === 0 ? 'No Tasks' : currentScore === 100 ? 'Perfect! ✨' : currentScore >= 80 ? 'Excellent! 🌟' : currentScore >= 50 ? 'Great Work 👍' : currentScore > 0 ? 'In Progress 🔄' : 'Get Started! 😐'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Streak Card */}
                <div className="stat-card glass-panel streak-card">
                  <div className="card-header">
                    <h3>Streak Tracker</h3>
                    <i className="fa-solid fa-fire card-icon text-orange"></i>
                  </div>
                  <div className="streak-body">
                    <div className="streak-number-wrapper">
                      <span>{analytics ? analytics.currentStreak : 0}</span>
                      <p>Days Streak</p>
                    </div>
                    <div className="streak-substats">
                      <div className="substat-item">
                        <span className="substat-label">Longest Streak</span>
                        <span className="substat-value">{analytics ? analytics.maxStreak : 0} days</span>
                      </div>
                      <div className="substat-item">
                        <span className="substat-label">Active Goals</span>
                        <span className="substat-value">{analytics ? analytics.totalActivities : 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mood Card */}
                <div className="stat-card glass-panel mood-card">
                  <div className="card-header">
                    <h3>Daily Focus & Mood</h3>
                    <i className="fa-regular fa-face-smile card-icon text-cyan"></i>
                  </div>
                  <div className="mood-body">
                    <div className="mood-selector-label">
                      <span>{moodEmoji}</span>
                      <span style={{ color: moodTextColor }}>{moodText}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={currentLog.mood || 3}
                      onChange={handleMoodChange}
                      className="mood-range-slider"
                    />
                    <div className="mood-ticks">
                      <span>😫</span>
                      <span>🙁</span>
                      <span>😐</span>
                      <span>🙂</span>
                      <span>🌟</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Dashboard Split Panel */}
              <div className="dashboard-split">
                
                {/* Left Side Checklist & Ledger */}
                <div className="left-dashboard-pane" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Checklist container */}
                  <div className="checklist-container glass-panel">
                    <div className="panel-header">
                      <h2>
                        {currentDate === todayStr ? "Today's Checklist" : currentDate === tomorrowStr ? "Tomorrow's Checklist (Planning)" : `Checklist for ${currentDate}`}
                      </h2>
                      <span>{completedCount} / {activeActivities.length} Completed</span>
                    </div>

                    {activeActivities.length === 0 ? (
                      <div className="empty-state">
                        <i className="fa-solid fa-circle-check empty-icon"></i>
                        <p>No activities scheduled for this date.</p>
                        <button className="action-btn outline-btn" onClick={() => setCurrentTab('activities')}>
                          Add Task / Schedule <i className="fa-solid fa-arrow-right"></i>
                        </button>
                      </div>
                    ) : (
                      <ul className="checklist-list">
                        {sortedActiveActivities.map(act => {
                          const isCompleted = currentLog.completedIds.includes(act.id);
                          return (
                            <li key={act.id} className={`checklist-item ${isCompleted ? 'checked' : ''}`}>
                              <div
                                className="checklist-item-left"
                                onClick={() => handleCheckboxToggle(act.id, !isCompleted)}
                              >
                                <div className="checkbox-custom-wrapper">
                                  <input
                                    type="checkbox"
                                    checked={isCompleted}
                                    onChange={(e) => handleCheckboxToggle(act.id, e.target.checked)}
                                  />
                                  <span className="checkbox-custom-mark"></span>
                                </div>
                                <div className="checklist-item-text-wrapper">
                                  <span className="checklist-item-text">{act.title}</span>
                                  {act.time && (
                                    <span className="time-badge">
                                      <i className="fa-regular fa-clock"></i> {formatTime12h(act.time)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="meta-badges">
                                {act.date && (
                                  <span className="weight-badge" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#f472b6', border: '1px solid rgba(236,72,153,0.2)' }}>
                                    <i className="fa-solid fa-calendar-day"></i> One-off
                                  </span>
                                )}
                                <span className="pill pill-dynamic">
                                  {getCategoryEmoji(act.category)} {getCategoryName(act.category)}
                                </span>
                                <span className={`weight-badge weight-${act.weight}`}>{act.weight}</span>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}

                    {/* Journal reflection notes */}
                    <div className="notes-wrapper">
                      <label htmlFor="daily-notes-textarea">
                        <i className="fa-solid fa-pen-nib"></i> Daily Journal & Reflection
                      </label>
                      <textarea
                        id="daily-notes-textarea"
                        value={notesInput}
                        onChange={handleNotesChange}
                        placeholder="Reflect on your day, achievements, challenges, or plans..."
                      />
                      <div className="notes-status-wrapper">
                        <span className={notesStatus === 'Saving...' ? 'saving' : notesStatus === 'Failed to save' ? 'error' : 'saved'}>
                          {notesStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Ledger ledger-container */}
                  <div className="finance-container glass-panel" style={{ padding: '1.5rem' }}>
                    <div className="panel-header">
                      <h2><i className="fa-solid fa-wallet text-cyan"></i> Daily Finance Ledger</h2>
                      {(() => {
                        const finance = currentLog.finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] };
                        const netVal = (finance.income || 0) - (finance.expense || 0);
                        const isPos = netVal >= 0;
                        return (
                          <span
                            className="badge"
                            style={{
                              color: isPos ? '#34d399' : '#f87171',
                              background: isPos ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'
                            }}
                          >
                            Net: {isPos ? `+$${netVal.toFixed(2)}` : `-$${Math.abs(netVal).toFixed(2)}`}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Ledger Info Cards */}
                    {(() => {
                      const finance = currentLog.finance || { income: 0, expense: 0, debt: 0, receivable: 0, transactions: [] };
                      return (
                        <div className="finance-badges-grid">
                          <div className="finance-badge-card bg-green">
                            <span className="f-badge-label">Income</span>
                            <span>${(finance.income || 0).toFixed(2)}</span>
                          </div>
                          <div className="finance-badge-card bg-red">
                            <span className="f-badge-label">Expenses</span>
                            <span>${(finance.expense || 0).toFixed(2)}</span>
                          </div>
                          <div className="finance-badge-card bg-orange">
                            <span className="f-badge-label">Debt (Owed)</span>
                            <span>${(finance.debt || 0).toFixed(2)}</span>
                          </div>
                          <div className="finance-badge-card bg-cyan">
                            <span className="f-badge-label">Lent (Receivable)</span>
                            <span>${(finance.receivable || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Quick Logger Form */}
                    <form className="finance-quick-form" onSubmit={handleAddTransaction}>
                      <input
                        type="text"
                        placeholder="Transaction (e.g. Freelance, Dinner, Loan)..."
                        required
                        value={newTxDesc}
                        onChange={(e) => setNewTxDesc(e.target.value)}
                        className="form-input"
                        style={{ flexGrow: 2 }}
                      />
                      <input
                        type="number"
                        placeholder="Amount ($)..."
                        min="0.01"
                        step="0.01"
                        required
                        value={newTxAmount}
                        onChange={(e) => setNewTxAmount(e.target.value)}
                        className="form-input"
                        style={{ flexGrow: 1 }}
                      />
                      <div className="select-wrapper">
                        <select value={newTxType} onChange={(e) => setNewTxType(e.target.value)} required>
                          <option value="expense">Expense 💸</option>
                          <option value="income">Income 💰</option>
                          <option value="debt">Debt (Owed) ⏳</option>
                          <option value="receivable">Receivable (Lent) 📈</option>
                        </select>
                      </div>
                      <button type="submit" className="action-btn primary-btn short-btn">Log <i className="fa-solid fa-plus"></i></button>
                    </form>

                    {/* Ledger List */}
                    <div className="ledger-wrapper">
                      <ul className="ledger-list">
                        {(!currentLog.finance || !currentLog.finance.transactions || currentLog.finance.transactions.length === 0) ? (
                          <li className="empty-state" style={{ padding: '1rem' }}>
                            <p className="form-help">No transactions logged for today.</p>
                          </li>
                        ) : (
                          currentLog.finance.transactions.map(tx => {
                            const isInc = tx.type === 'income';
                            const isDebt = tx.type === 'debt';
                            const isRec = tx.type === 'receivable';

                            const typeClass = isInc ? 'income' : isDebt ? 'debt' : isRec ? 'receivable' : 'expense';
                            const prefix = isInc ? '+' : isDebt ? '⏳' : isRec ? '📈' : '-';
                            const emoji = isInc ? '💰' : isDebt ? '⏳' : isRec ? '📈' : '💸';

                            return (
                              <li key={tx.id} className="ledger-item">
                                <div className="ledger-item-left">
                                  <span>{emoji}</span>
                                  <span className="ledger-item-desc">{tx.desc}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span className={`ledger-amount ${typeClass}`}>
                                    {prefix === '+' || prefix === '-' ? `${prefix}$${parseFloat(tx.amount).toFixed(2)}` : `${prefix} $${parseFloat(tx.amount).toFixed(2)}`}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteTransaction(tx.id)}
                                    className="icon-btn btn-delete"
                                    style={{ width: '24px', height: '24px', padding: 0 }}
                                    title="Delete Entry"
                                    type="button"
                                  >
                                    <i className="fa-solid fa-trash" style={{ fontSize: '0.75rem' }}></i>
                                  </button>
                                </div>
                              </li>
                            )
                          })
                        )}
                      </ul>
                    </div>

                  </div>

                </div>

                {/* Right side Analytics Charts */}
                <div className="analytics-container">
                  {/* Weekly Chart */}
                  <div className="chart-panel glass-panel">
                    <div className="panel-header">
                      <h2>Weekly Consistency</h2>
                    </div>
                    <div className="chart-wrapper">
                      <canvas ref={weeklyCanvasRef} id="weekly-chart"></canvas>
                    </div>
                  </div>

                  {/* Doughnut distribution chart */}
                  <div className="chart-panel glass-panel">
                    <div className="panel-header">
                      <h2>Activity Focus Breakdown</h2>
                    </div>
                    <div className="chart-wrapper">
                      <canvas ref={categoryCanvasRef} id="category-chart"></canvas>
                    </div>
                  </div>
                </div>

              </div>

            </section>
          )}

          {/* Tab 2: Activity Manager */}
          {currentTab === 'activities' && (
            <section id="tab-activities" className="tab-pane active">
              <div className="activity-manager-layout">
                
                {/* Left side Create form fields */}
                <div className="forms-column">
                  
                  {/* Create Activity Panel */}
                  <div className="glass-panel form-panel">
                    <h2>Add New Activity</h2>
                    <p className="section-subtitle">Define what you want to track or schedule.</p>

                    <form onSubmit={handleCreateActivity} className="activity-form">
                      <div className="form-group">
                        <label>Activity Title</label>
                        <input
                          type="text"
                          placeholder="e.g. Gym workout, Read Quran, Code project"
                          required
                          value={newActivityTitle}
                          onChange={(e) => setNewActivityTitle(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Category</label>
                        <div className="select-wrapper">
                          <select
                            value={newActivityCategory}
                            onChange={(e) => setNewActivityCategory(e.target.value)}
                            required
                          >
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Schedule Type</label>
                        <div className="frequency-selectors">
                          <label className="freq-btn">
                            <input
                              type="radio"
                              value="recurring"
                              checked={newActivityFreq === 'recurring'}
                              onChange={() => setNewActivityFreq('recurring')}
                            />
                            <span className="freq-label">
                              <i className="fa-solid fa-repeat"></i> Everyday Recurring
                            </span>
                          </label>
                          <label className="freq-btn">
                            <input
                              type="radio"
                              value="oneoff"
                              checked={newActivityFreq === 'oneoff'}
                              onChange={() => setNewActivityFreq('oneoff')}
                            />
                            <span className="freq-label">
                              <i className="fa-solid fa-calendar-day"></i> One-off Date
                            </span>
                          </label>
                        </div>
                      </div>

                      {newActivityFreq === 'oneoff' && (
                        <div className="form-group">
                          <label>Target Date</label>
                          <input
                            type="date"
                            className="form-input"
                            value={newActivityDate}
                            onChange={(e) => setNewActivityDate(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="form-group">
                        <label>Time Slot (Optional)</label>
                        <p className="form-help">Set a target start time for a proper daily timeline.</p>
                        <input
                          type="time"
                          className="form-input"
                          value={newActivityTime}
                          onChange={(e) => setNewActivityTime(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Importance Weight</label>
                        <p className="form-help">Higher weight tasks impact your performance score more.</p>
                        <div className="weight-selectors">
                          {['low', 'medium', 'high'].map(w => (
                            <label key={w} className="weight-btn">
                              <input
                                type="radio"
                                name="new-weight"
                                value={w}
                                checked={newActivityWeight === w}
                                onChange={() => setNewActivityWeight(w)}
                              />
                              <span className={`weight-label ${w === 'low' ? 'low-weight' : w === 'medium' ? 'med-weight' : 'high-weight'}`}>
                                <span className="weight-dot"></span> {w.charAt(0).toUpperCase() + w.slice(1)} ({w === 'low' ? '1x' : w === 'medium' ? '2x' : '3x'})
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <button type="submit" className="action-btn primary-btn">
                        Add Activity <i className="fa-solid fa-plus"></i>
                      </button>
                    </form>
                  </div>

                  {/* Create Custom Category Panel */}
                  <div className="glass-panel form-panel" style={{ marginTop: '1.5rem' }}>
                    <h2>Add Custom Category</h2>
                    <p className="section-subtitle">Create custom domains with logo icons (emojis).</p>

                    <form onSubmit={handleCreateCategory} className="activity-form">
                      <div className="form-group">
                        <label>Category Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Spiritual, Finance, Social"
                          required
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Category Icon (Emoji)</label>
                        <input
                          type="text"
                          placeholder="e.g. 🕌, 💰, 👥, 📚"
                          required
                          style={{ fontSize: '1.2rem' }}
                          value={newCatIcon}
                          onChange={(e) => setNewCatIcon(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="action-btn outline-btn">
                        Create Category <i className="fa-solid fa-tags"></i>
                      </button>
                    </form>
                  </div>

                </div>

                {/* Right side Configured activities */}
                <div className="glass-panel list-panel">
                  <div className="panel-header">
                    <h2>Your Tracked Activities</h2>
                    <span className="badge">{activities.filter(act => !act.deleted).length} Total</span>
                  </div>

                  <ul className="activities-list">
                    {activities.filter(act => !act.deleted).length === 0 ? (
                      <li className="empty-state">
                        <i className="fa-solid fa-list-check empty-icon"></i>
                        <p>No tracked activities found. Set your goals on the left!</p>
                      </li>
                    ) : (
                      activities.filter(act => !act.deleted).map(act => (
                        <li key={act.id} className="activity-item">
                          <div className="activity-item-details">
                            <span className="activity-item-title">{act.title}</span>
                            <div className="activity-item-meta">
                              {act.date ? (
                                <span className="weight-badge" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#f472b6' }}>
                                  <i className="fa-solid fa-calendar-day"></i> One-off ({act.date})
                                </span>
                              ) : (
                                <span className="weight-badge" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc' }}>
                                  <i className="fa-solid fa-repeat"></i> Recurring Daily
                                </span>
                              )}
                              {act.time && (
                                <span className="weight-badge" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#22d3ee' }}>
                                  <i className="fa-solid fa-clock"></i> {formatTime12h(act.time)}
                                </span>
                              )}
                              <span className="pill pill-dynamic">
                                {getCategoryEmoji(act.category)} {getCategoryName(act.category)}
                              </span>
                              <span className={`weight-badge weight-${act.weight}`}>{act.weight} weight</span>
                            </div>
                          </div>
                          <div className="activity-actions">
                            <button
                              onClick={() => handleStartEditActivity(act)}
                              className="icon-btn btn-edit"
                              title="Edit Activity"
                              type="button"
                              style={{ marginRight: '0.25rem' }}
                            >
                              <i className="fa-solid fa-pen"></i>
                            </button>
                            <button
                              onClick={() => handleDeleteActivity(act.id)}
                              className="icon-btn btn-delete"
                              title="Delete Activity"
                              type="button"
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>

              </div>
            </section>
          )}

          {/* Tab 3: Life Goals */}
          {currentTab === 'goals' && (
            <section id="tab-goals" className="tab-pane active">
              <div className="activity-manager-layout">
                
                {/* Left side Create goal form */}
                <div className="forms-column">
                  <div className="glass-panel form-panel">
                    <h2>Set New Life Goal</h2>
                    <p className="section-subtitle">Define target achievements and improvements in your life.</p>

                    <form onSubmit={handleCreateGoal} className="activity-form">
                      <div className="form-group">
                        <label>Goal Title / Target Achievement</label>
                        <input
                          type="text"
                          placeholder="e.g. Learn Machine Learning, Save $5000"
                          required
                          value={newGoalTitle}
                          onChange={(e) => setNewGoalTitle(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Improvement Domain</label>
                        <div className="select-wrapper">
                          <select
                            value={newGoalCategory}
                            onChange={(e) => setNewGoalCategory(e.target.value)}
                            required
                          >
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Goal Target Date (Deadline)</label>
                        <input
                          type="date"
                          required
                          value={newGoalTargetDate}
                          onChange={(e) => setNewGoalTargetDate(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label>Current Progress</label>
                        <div className="goal-slider-wrapper">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={newGoalProgress}
                            onChange={(e) => setNewGoalProgress(parseInt(e.target.value))}
                            className="mood-range-slider"
                            style={{ flexGrow: 1 }}
                          />
                          <span className="badge text-purple" style={{ minWidth: '48px', textAlign: 'center' }}>
                            {newGoalProgress}%
                          </span>
                        </div>
                      </div>

                      <button type="submit" className="action-btn primary-btn">
                        Create Goal <i className="fa-solid fa-bullseye"></i>
                      </button>
                    </form>
                  </div>
                </div>

                {/* Right side active goals grid */}
                <div className="glass-panel list-panel">
                  <div className="panel-header">
                    <h2>Active Life Improvements</h2>
                    <span className="badge">{goals.length} Goals</span>
                  </div>

                  <div className="goals-grid">
                    {goals.length === 0 ? (
                      <div className="empty-state" style={{ gridColumn: '1 / -1', padding: '3rem' }}>
                        <i className="fa-solid fa-bullseye empty-icon"></i>
                        <p>No active goals defined. Set up some improvements on the left!</p>
                      </div>
                    ) : (
                      [...goals].sort((a, b) => a.targetDate.localeCompare(b.targetDate)).map(goal => {
                        const isCompleted = goal.progress === 100;
                        
                        // Calculate days left
                        const now = new Date();
                        now.setHours(0,0,0,0);
                        const target = new Date(goal.targetDate + 'T00:00:00');
                        const diffTime = target - now;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        let deadlineText = '';
                        if (diffDays > 1) deadlineText = `${diffDays} days left`;
                        else if (diffDays === 1) deadlineText = `Tomorrow deadline`;
                        else if (diffDays === 0) deadlineText = `Deadline is TODAY`;
                        else deadlineText = `${Math.abs(diffDays)} days overdue`;

                        return (
                          <div key={goal.id} className={`goal-card ${isCompleted ? 'completed' : ''}`}>
                            <div className="goal-card-header">
                              <span className="goal-card-title">{goal.title}</span>
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <button
                                  onClick={() => handleStartEditGoal(goal)}
                                  className="icon-btn btn-edit"
                                  title="Edit Goal"
                                  type="button"
                                >
                                  <i className="fa-solid fa-pen"></i>
                                </button>
                                <button
                                  onClick={() => handleDeleteGoal(goal.id)}
                                  className="icon-btn btn-delete"
                                  title="Remove Goal"
                                  type="button"
                                >
                                  <i className="fa-solid fa-trash"></i>
                                </button>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <span className="pill pill-dynamic">{getCategoryEmoji(goal.category)} {getCategoryName(goal.category)}</span>
                              <span className={`goal-card-deadline ${diffDays < 0 ? 'text-red' : ''}`}>
                                <i className="fa-regular fa-calendar-times"></i> {goal.targetDate} ({deadlineText})
                              </span>
                            </div>

                            <div className="goal-card-slider-wrapper">
                              <div className="goal-card-slider-label">
                                <span>Progress</span>
                                <span className="progress-val-lbl text-purple">{goal.progress}%</span>
                              </div>
                              <div className="goal-progress-bar-bg">
                                <div className="goal-progress-bar-fill" style={{ width: `${goal.progress}%` }}></div>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={goal.progress}
                                onChange={(e) => handleGoalProgressChange(goal.id, parseInt(e.target.value))}
                                className="mood-range-slider progress-slider"
                                style={{ marginTop: '0.25rem' }}
                              />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

              </div>
            </section>
          )}

        </main>

        {/* Edit Activity Modal Overlay */}
        {editingActivity && (
          <div className="modal-overlay">
            <div className="modal-box glass-panel">
              <div className="modal-header">
                <h2><i className="fa-solid fa-pen-to-square icon-purple"></i> Edit Activity</h2>
                <button className="icon-btn" onClick={() => setEditingActivity(null)} aria-label="Close modal" type="button">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <form onSubmit={handleSaveEditActivity} className="activity-form">
                <div className="modal-body">
                  <div className="form-group">
                    <label>Activity Title</label>
                    <input
                      type="text"
                      required
                      value={editActivityTitle}
                      onChange={(e) => setEditActivityTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <div className="select-wrapper">
                      <select
                        value={editActivityCategory}
                        onChange={(e) => setEditActivityCategory(e.target.value)}
                        required
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Schedule Type</label>
                    <div className="frequency-selectors">
                      <label className="freq-btn">
                        <input
                          type="radio"
                          value="recurring"
                          checked={editActivityFreq === 'recurring'}
                          onChange={() => setEditActivityFreq('recurring')}
                        />
                        <span className="freq-label">
                          <i className="fa-solid fa-repeat"></i> Everyday Recurring
                        </span>
                      </label>
                      <label className="freq-btn">
                        <input
                          type="radio"
                          value="oneoff"
                          checked={editActivityFreq === 'oneoff'}
                          onChange={() => setEditActivityFreq('oneoff')}
                        />
                        <span className="freq-label">
                          <i className="fa-solid fa-calendar-day"></i> One-off Date
                        </span>
                      </label>
                    </div>
                  </div>

                  {editActivityFreq === 'oneoff' && (
                    <div className="form-group">
                      <label>Target Date</label>
                      <input
                        type="date"
                        className="form-input"
                        value={editActivityDate}
                        onChange={(e) => setEditActivityDate(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Time Slot (Optional)</label>
                    <input
                      type="time"
                      className="form-input"
                      value={editActivityTime}
                      onChange={(e) => setEditActivityTime(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Importance Weight</label>
                    <div className="weight-selectors">
                      {['low', 'medium', 'high'].map(w => (
                        <label key={w} className="weight-btn">
                          <input
                            type="radio"
                            name="edit-weight"
                            value={w}
                            checked={editActivityWeight === w}
                            onChange={() => setEditActivityWeight(w)}
                          />
                          <span className={`weight-label ${w === 'low' ? 'low-weight' : w === 'medium' ? 'med-weight' : 'high-weight'}`}>
                            <span className="weight-dot"></span> {w.charAt(0).toUpperCase() + w.slice(1)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                </div>

                <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="action-btn outline-btn" onClick={() => setEditingActivity(null)} type="button">
                    Cancel
                  </button>
                  <button className="action-btn primary-btn" type="submit">
                    Save Changes <i className="fa-solid fa-circle-check"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Goal Modal Overlay */}
        {editingGoal && (
          <div className="modal-overlay">
            <div className="modal-box glass-panel">
              <div className="modal-header">
                <h2><i className="fa-solid fa-pen-to-square icon-purple"></i> Edit Life Goal</h2>
                <button className="icon-btn" onClick={() => setEditingGoal(null)} aria-label="Close modal" type="button">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              <form onSubmit={handleSaveEditGoal} className="activity-form">
                <div className="modal-body">
                  <div className="form-group">
                    <label>Goal Title / Target Achievement</label>
                    <input
                      type="text"
                      required
                      value={editGoalTitle}
                      onChange={(e) => setEditGoalTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Improvement Domain</label>
                    <div className="select-wrapper">
                      <select
                        value={editGoalCategory}
                        onChange={(e) => setEditGoalCategory(e.target.value)}
                        required
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Goal Target Date (Deadline)</label>
                    <input
                      type="date"
                      required
                      value={editGoalTargetDate}
                      onChange={(e) => setEditGoalTargetDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Current Progress</label>
                    <div className="goal-slider-wrapper">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={editGoalProgress}
                        onChange={(e) => setEditGoalProgress(parseInt(e.target.value))}
                        className="mood-range-slider"
                        style={{ flexGrow: 1 }}
                      />
                      <span className="badge text-purple" style={{ minWidth: '48px', textAlign: 'center' }}>
                        {editGoalProgress}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="action-btn outline-btn" onClick={() => setEditingGoal(null)} type="button">
                    Cancel
                  </button>
                  <button className="action-btn primary-btn" type="submit">
                    Save Changes <i className="fa-solid fa-circle-check"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tomorrow Planner Modal overlay */}
        {isPlannerOpen && (
          <div className="modal-overlay">
            <div className="modal-box glass-panel">
              <div className="modal-header">
                <h2><i className="fa-solid fa-calendar-check icon-purple"></i> Plan Tomorrow's Schedule</h2>
                <button className="icon-btn" onClick={() => setIsPlannerOpen(false)} aria-label="Close modal" type="button">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
              
              <div className="modal-body">
                <p className="section-subtitle">Set your focus, toggle activities, and build your timeline schedule for tomorrow (<span>{tomorrowStr}</span>).</p>

                {/* Focus text */}
                <div className="form-group">
                  <label htmlFor="tomorrow-notes"><i className="fa-solid fa-bullseye icon-purple"></i> Tomorrow's Main Focus & Priorities</label>
                  <input
                    type="text"
                    value={tomorrowNotes}
                    onChange={(e) => setTomorrowNotes(e.target.value)}
                    placeholder="e.g. Finish writing project proposal, focus on healthy eating"
                    className="form-input"
                  />
                </div>

                {/* Checklist toggles */}
                <div className="form-group">
                  <label><i className="fa-solid fa-circle-check icon-purple"></i> Scheduled Activities for Tomorrow</label>
                  <p className="form-help">Toggle off tasks you do not plan to do tomorrow. Checked tasks will appear on tomorrow's checklist.</p>
                  
                  <div className="tomorrow-checklist-box">
                    {activities.filter(act => !act.deleted && (!act.date || act.date === tomorrowStr)).length === 0 ? (
                      <p className="section-subtitle">No activities defined yet. Create some in the Activity Manager!</p>
                    ) : (
                      [...activities]
                        .filter(act => !act.deleted && (!act.date || act.date === tomorrowStr))
                        .sort((a, b) => {
                          if (a.time && !b.time) return -1;
                          if (!a.time && b.time) return 1;
                          if (a.time && b.time) return a.time.localeCompare(b.time);
                          return 0;
                        })
                        .map(act => {
                          const isScheduled = tomorrowActiveIds.includes(act.id);
                          return (
                            <div key={act.id} className="planner-toggle-item">
                              <span className="planner-toggle-label">
                                <span>{getCategoryEmoji(act.category)} {act.title}{act.time ? ` [${formatTime12h(act.time)}]` : ''}</span>
                              </span>
                              <div className="planner-toggle-meta">
                                <span className={`weight-badge weight-${act.weight}`}>{act.weight}</span>
                                <label className="switch">
                                  <input
                                    type="checkbox"
                                    checked={isScheduled}
                                    onChange={(e) => handleTomorrowToggleChange(act.id, e.target.checked)}
                                  />
                                  <span className="slider"></span>
                                </label>
                              </div>
                            </div>
                          )
                        })
                    )}
                  </div>
                </div>

                {/* Quick Add scheduled for tomorrow */}
                <div className="quick-add-tomorrow-box">
                  <h3><i className="fa-solid fa-clock icon-purple"></i> Add Task Scheduled for Tomorrow</h3>
                  <div className="quick-add-tomorrow-grid">
                    <input
                      type="text"
                      placeholder="Task Title..."
                      value={tomorrowNewTaskTitle}
                      onChange={(e) => setTomorrowNewTaskTitle(e.target.value)}
                      className="form-input"
                    />
                    <select
                      value={tomorrowNewTaskCategory}
                      onChange={(e) => setTomorrowNewTaskCategory(e.target.value)}
                      className="form-input"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={tomorrowNewTaskTime}
                      onChange={(e) => setTomorrowNewTaskTime(e.target.value)}
                      className="form-input"
                    />
                    <button type="button" onClick={handleAddTomorrowTask} className="action-btn outline-btn short-btn">
                      <i className="fa-solid fa-plus"></i> Add to Schedule
                    </button>
                  </div>
                </div>

              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="action-btn outline-btn" onClick={() => setIsPlannerOpen(false)} type="button">
                  Cancel / Close
                </button>
                <button className="action-btn primary-btn" onClick={handleSaveTomorrowPlan} type="button">
                  Save & Apply Tomorrow's Schedule <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <p>&copy; 2026 دائماً. تعقب وأنجز.</p>
        </footer>
      </div>
    </>
  );
}

export default App;
