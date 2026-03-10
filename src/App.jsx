import React, { useState, useEffect, useCallback } from "react";

const SYMPTOMS = ["cramps", "bloating", "headache", "fatigue", "mood swings", "backache", "nausea", "spotting"];
const FLOW_LEVELS = ["light", "medium", "heavy"];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}
function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function today() {
  const n = new Date();
  return dateKey(n.getFullYear(), n.getMonth(), n.getDate());
}

function predictNextPeriod(periodLogs) {
  const starts = Object.entries(periodLogs)
    .filter(([, v]) => v.start)
    .map(([k]) => parseKey(k))
    .sort((a, b) => a - b);

  if (starts.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < starts.length; i++) {
    gaps.push((starts[i] - starts[i - 1]) / (1000 * 60 * 60 * 24));
  }
  const avgCycle = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const lastStart = starts[starts.length - 1];
  const next = new Date(lastStart);
  next.setDate(next.getDate() + avgCycle);
  return { date: next, avgCycle };
}

function getCycleDay(periodLogs) {
  const starts = Object.entries(periodLogs)
    .filter(([, v]) => v.start)
    .map(([k]) => parseKey(k))
    .sort((a, b) => b - a);
  if (!starts.length) return null;
  const last = starts[0];
  const now = new Date();
  const diff = Math.floor((now - last) / (1000 * 60 * 60 * 24)) + 1;
  return diff;
}

export default function PeriodTracker() {
  const [logs, setLogs] = useState({});
  const [view, setView] = useState("calendar");
  const [selectedDay, setSelectedDay] = useState(null);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Load from storage
  useEffect(() => {
    const saved = localStorage.getItem("period-tracker-logs");
    if (saved) setLogs(JSON.parse(saved));
    setLoaded(true);
  }, []);

  // Save to storage
  const save = useCallback((newLogs) => {
    localStorage.setItem("period-tracker-logs", JSON.stringify(newLogs));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(""), 1500);
  }, []);

  const updateLog = (key, update) => {
    setLogs(prev => {
      const newLogs = {
        ...prev,
        [key]: { ...(prev[key] || {}), ...update }
      };
      save(newLogs);
      return newLogs;
    });
  };

  const togglePeriodDay = (key) => {
    setLogs(prev => {
      const curr = prev[key] || {};
      let newLogs;
      if (curr.period) {
        // Remove period
        const { period, flow, start, end, ...rest } = curr;
        newLogs = { ...prev, [key]: rest };
      } else {
        // Add period, auto-detect start/end
        const allPeriodDays = Object.entries(prev)
          .filter(([, v]) => v.period)
          .map(([k]) => k);

        // Check if day before is period
        const d = parseKey(key);
        const dayBefore = new Date(d); dayBefore.setDate(d.getDate() - 1);
        const keyBefore = dateKey(dayBefore.getFullYear(), dayBefore.getMonth(), dayBefore.getDate());
        const dayAfter = new Date(d); dayAfter.setDate(d.getDate() + 1);
        const keyAfter = dateKey(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate());

        const hasBefore = prev[keyBefore]?.period;
        const hasAfter = prev[keyAfter]?.period;

        newLogs = { ...prev, [key]: { ...curr, period: true } };

        // Mark start if no day before
        if (!hasBefore) {
          newLogs[key].start = true;
          // Remove start from day after if it exists
          if (newLogs[keyAfter]?.start) {
            newLogs[keyAfter] = { ...newLogs[keyAfter] };
            delete newLogs[keyAfter].start;
          }
        }
        // Mark end if no day after (or day after doesn't have period)
        if (!hasAfter) {
          newLogs[key].end = true;
          // Remove end from day before
          if (newLogs[keyBefore]?.end) {
            newLogs[keyBefore] = { ...newLogs[keyBefore] };
            delete newLogs[keyBefore].end;
          }
        }
      }
      save(newLogs);
      return newLogs;
    });
  };

  const prediction = predictNextPeriod(logs);
  const cycleDay = getCycleDay(logs);

  // Stats
  const periodDays = Object.entries(logs).filter(([, v]) => v.period);
  const startDays = Object.entries(logs).filter(([, v]) => v.start);

  // Build calendar
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const todayKey = today();
  const predKey = prediction ? dateKey(prediction.date.getFullYear(), prediction.date.getMonth(), prediction.date.getDate()) : null;

  // Check if predicted days
  const predRange = prediction ? (() => {
    const keys = new Set();
    for (let i = 0; i < (prediction.avgCycle > 28 ? 5 : 5); i++) {
      const d = new Date(prediction.date);
      d.setDate(d.getDate() + i);
      keys.add(dateKey(d.getFullYear(), d.getMonth(), d.getDate()));
    }
    return keys;
  })() : new Set();

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  if (!loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#fdf6f0', fontFamily: 'Georgia,serif', color: '#c9706a', fontSize: '1.2rem' }}>
      Loading...
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #fdf6f0 0%, #fce8e4 50%, #fdf0f5 100%)',
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: '#3d2b2b',
      padding: '0',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #c9706a 0%, #e8857a 40%, #d4748c 100%)',
        padding: '24px 20px 20px',
        textAlign: 'center',
        boxShadow: '0 4px 20px rgba(201,112,106,0.3)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: -10, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ fontSize: '1.6rem', marginBottom: 2 }}>🌸</div>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.7rem', color: '#fff', letterSpacing: '0.05em', fontWeight: 'normal', textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
          Bloom
        </h1>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Period Tracker
        </p>
        {saveStatus && (
          <div style={{ position: 'absolute', top: 8, right: 12, fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 10 }}>
            ✓ saved
          </div>
        )}
      </div>

      {/* Cycle Status Bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 10, padding: '16px 14px 8px',
      }}>
        {[
          { label: 'Cycle Day', value: cycleDay ? `Day ${cycleDay}` : '—', icon: '🔄' },
          { label: 'Avg Cycle', value: prediction ? `${prediction.avgCycle}d` : '—', icon: '📅' },
          { label: 'Next Period', value: prediction ? `${Math.ceil((prediction.date - new Date()) / (1000 * 60 * 60 * 24))}d away` : '—', icon: '🌙' },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{
            background: 'rgba(255,255,255,0.7)',
            borderRadius: 14,
            padding: '12px 8px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 2px 12px rgba(201,112,106,0.1)',
            border: '1px solid rgba(255,255,255,0.8)',
          }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 3 }}>{icon}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#c9706a', marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: '0.62rem', color: '#a07070', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Nav Tabs */}
      <div style={{ display: 'flex', padding: '0 14px', gap: 6, marginBottom: 12 }}>
        {[['calendar', '📆 Calendar'], ['log', '✏️ Log Day'], ['insights', '📊 Insights']].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '9px 4px', border: 'none', cursor: 'pointer',
            borderRadius: 10, fontSize: '0.72rem', fontWeight: 'bold', letterSpacing: '0.05em',
            background: view === v ? 'linear-gradient(135deg,#c9706a,#d4748c)' : 'rgba(255,255,255,0.6)',
            color: view === v ? '#fff' : '#a07070',
            boxShadow: view === v ? '0 3px 12px rgba(201,112,106,0.3)' : 'none',
            transition: 'all 0.2s',
            backdropFilter: 'blur(8px)',
            border: view === v ? 'none' : '1px solid rgba(255,255,255,0.7)',
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* CALENDAR VIEW */}
      {view === 'calendar' && (
        <div style={{ padding: '0 14px 20px' }}>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#c9706a', fontSize: '1rem' }}>‹</button>
            <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#3d2b2b', letterSpacing: '0.03em' }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#c9706a', fontSize: '1rem' }}>›</button>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { color: '#e8857a', label: 'Period' },
              { color: 'rgba(232,133,122,0.25)', label: 'Predicted', border: '2px dashed #e8857a' },
              { color: 'transparent', label: 'Today', border: '2px solid #c9706a' },
            ].map(({ color, label, border }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#a07070' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color, border: border || 'none' }} />
                {label}
              </div>
            ))}
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 3 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '0.65rem', color: '#a07070', padding: '4px 0', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
            {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
            {Array(daysInMonth).fill(null).map((_, i) => {
              const day = i + 1;
              const key = dateKey(calYear, calMonth, day);
              const log = logs[key] || {};
              const isPeriod = !!log.period;
              const isPred = predRange.has(key) && !isPeriod;
              const isToday = key === todayKey;
              const hasSymptom = log.symptoms?.length > 0;
              const hasNote = !!log.note;

              return (
                <button
                  key={day}
                  onClick={() => { setSelectedDay(key); setView('log'); }}
                  style={{
                    aspectRatio: '1',
                    border: isToday ? '2px solid #c9706a' : isPred ? '2px dashed rgba(232,133,122,0.6)' : '1px solid rgba(255,255,255,0.5)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                    background: isPeriod
                      ? 'linear-gradient(135deg,#e8857a,#d4748c)'
                      : isPred
                        ? 'rgba(232,133,122,0.18)'
                        : isToday
                          ? 'rgba(201,112,106,0.08)'
                          : 'rgba(255,255,255,0.55)',
                    color: isPeriod ? '#fff' : isToday ? '#c9706a' : '#3d2b2b',
                    fontSize: '0.82rem',
                    fontWeight: isToday ? 'bold' : 'normal',
                    boxShadow: isPeriod ? '0 2px 8px rgba(201,112,106,0.35)' : 'none',
                    transition: 'transform 0.1s',
                    padding: 0,
                  }}
                >
                  {day}
                  {(hasSymptom || hasNote) && (
                    <div style={{ position: 'absolute', bottom: 2, right: 2, width: 5, height: 5, borderRadius: '50%', background: isPeriod ? 'rgba(255,255,255,0.7)' : '#c9706a' }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tap hint */}
          <p style={{ textAlign: 'center', fontSize: '0.7rem', color: '#c9706a99', marginTop: 12 }}>
            Tap a date to log details
          </p>
        </div>
      )}

      {/* LOG VIEW */}
      {view === 'log' && (
        <div style={{ padding: '0 14px 30px' }}>
          {/* Date selector */}
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px', marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          }}>
            <label style={{ fontSize: '0.75rem', color: '#a07070', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Date
            </label>
            <input
              type="date"
              value={selectedDay || todayKey}
              onChange={e => setSelectedDay(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid rgba(201,112,106,0.3)',
                borderRadius: 8, fontSize: '0.9rem', color: '#3d2b2b',
                background: 'rgba(255,255,255,0.8)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Period toggle */}
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px', marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (logs[selectedDay || todayKey]?.period) ? 12 : 0 }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#3d2b2b' }}>🩸 Period Day</div>
                <div style={{ fontSize: '0.72rem', color: '#a07070', marginTop: 2 }}>Mark this as a period day</div>
              </div>
              <button
                onClick={() => togglePeriodDay(selectedDay || todayKey)}
                style={{
                  width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: logs[selectedDay || todayKey]?.period ? 'linear-gradient(135deg,#c9706a,#d4748c)' : 'rgba(200,200,200,0.4)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  left: logs[selectedDay || todayKey]?.period ? 25 : 3,
                  width: 22, height: 22, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Flow level */}
            {logs[selectedDay || todayKey]?.period && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#a07070', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Flow</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {FLOW_LEVELS.map(f => (
                    <button key={f} onClick={() => updateLog(selectedDay || todayKey, { flow: f })} style={{
                      flex: 1, padding: '7px 4px', border: 'none', cursor: 'pointer', borderRadius: 8,
                      fontSize: '0.75rem', textTransform: 'capitalize',
                      background: logs[selectedDay || todayKey]?.flow === f ? 'linear-gradient(135deg,#c9706a,#d4748c)' : 'rgba(201,112,106,0.12)',
                      color: logs[selectedDay || todayKey]?.flow === f ? '#fff' : '#c9706a',
                      fontWeight: logs[selectedDay || todayKey]?.flow === f ? 'bold' : 'normal',
                    }}>
                      {f === 'light' ? '💧' : f === 'medium' ? '💧💧' : '💧💧💧'} {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Symptoms */}
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px', marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#3d2b2b', marginBottom: 10 }}>💭 Symptoms</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {SYMPTOMS.map(s => {
                const key = selectedDay || todayKey;
                const active = (logs[key]?.symptoms || []).includes(s);
                return (
                  <button key={s} onClick={() => {
                    const curr = logs[key]?.symptoms || [];
                    const next = active ? curr.filter(x => x !== s) : [...curr, s];
                    updateLog(key, { symptoms: next });
                  }} style={{
                    padding: '8px 6px', border: 'none', cursor: 'pointer', borderRadius: 8,
                    fontSize: '0.75rem', textTransform: 'capitalize', textAlign: 'left',
                    background: active ? 'rgba(201,112,106,0.15)' : 'rgba(200,200,200,0.15)',
                    color: active ? '#c9706a' : '#a08080',
                    fontWeight: active ? 'bold' : 'normal',
                    border: active ? '1px solid rgba(201,112,106,0.3)' : '1px solid transparent',
                  }}>
                    {active ? '✓ ' : '  '}{s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mood */}
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px', marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#3d2b2b', marginBottom: 10 }}>🌈 Mood</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
              {[['😔', 'sad'], ['😤', 'irritable'], ['😐', 'neutral'], ['🙂', 'good'], ['😊', 'great']].map(([emoji, mood]) => {
                const key = selectedDay || todayKey;
                const active = logs[key]?.mood === mood;
                return (
                  <button key={mood} onClick={() => updateLog(key, { mood: active ? null : mood })} style={{
                    flex: 1, padding: '8px 2px', border: 'none', cursor: 'pointer', borderRadius: 8,
                    fontSize: '1.4rem', textAlign: 'center',
                    background: active ? 'rgba(201,112,106,0.15)' : 'transparent',
                    border: active ? '1px solid rgba(201,112,106,0.35)' : '1px solid transparent',
                    transition: 'transform 0.1s',
                    transform: active ? 'scale(1.15)' : 'scale(1)',
                  }}>
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px',
            border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#3d2b2b', marginBottom: 8 }}>📝 Notes</div>
            <textarea
              value={logs[selectedDay || todayKey]?.note || ''}
              onChange={e => updateLog(selectedDay || todayKey, { note: e.target.value })}
              placeholder="How are you feeling today..."
              rows={3}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid rgba(201,112,106,0.25)',
                borderRadius: 8, fontSize: '0.85rem', color: '#3d2b2b', resize: 'none',
                background: 'rgba(255,255,255,0.7)', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'Georgia,serif', lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      )}

      {/* INSIGHTS VIEW */}
      {view === 'insights' && (
        <div style={{ padding: '0 14px 30px' }}>
          {/* Prediction card */}
          {prediction && (
            <div style={{
              background: 'linear-gradient(135deg,rgba(201,112,106,0.15),rgba(212,116,140,0.15))',
              border: '1px solid rgba(201,112,106,0.25)',
              borderRadius: 14, padding: '16px', marginBottom: 12,
            }}>
              <div style={{ fontSize: '0.75rem', color: '#a07070', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                Next Period Predicted
              </div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#c9706a', marginBottom: 4 }}>
                {prediction.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#a07070' }}>
                In ~{Math.max(0, Math.ceil((prediction.date - new Date()) / (1000 * 60 * 60 * 24)))} days • Based on {startDays.length} cycle{startDays.length !== 1 ? 's' : ''}
              </div>
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#c9706a' }}>
                Average cycle: <b>{prediction.avgCycle} days</b>
              </div>
            </div>
          )}

          {!prediction && startDays.length < 2 && (
            <div style={{
              background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '20px', marginBottom: 12,
              textAlign: 'center', border: '1px solid rgba(255,255,255,0.8)',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🌱</div>
              <div style={{ fontSize: '0.85rem', color: '#a07070', lineHeight: 1.5 }}>
                Log at least 2 periods to see cycle predictions!
              </div>
            </div>
          )}

          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { icon: '🩸', label: 'Periods Logged', value: startDays.length },
              { icon: '📅', label: 'Total Days', value: periodDays.length },
              {
                icon: '⏱️', label: 'Avg Period Length',
                value: (() => {
                  const cycles = [];
                  let count = 0;
                  const sorted = Object.entries(logs).filter(([, v]) => v.period).map(([k]) => k).sort();
                  for (let i = 0; i < sorted.length; i++) {
                    count++;
                    const k = sorted[i];
                    const next = sorted[i + 1];
                    if (!next || !isConsecutive(k, next)) {
                      cycles.push(count); count = 0;
                    }
                  }
                  if (!cycles.length) return '—';
                  return `${Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length)}d`;
                })()
              },
              {
                icon: '😊', label: 'Most Common Mood',
                value: (() => {
                  const moods = Object.values(logs).filter(v => v.mood).map(v => v.mood);
                  if (!moods.length) return '—';
                  const freq = moods.reduce((a, m) => ({ ...a, [m]: (a[m] || 0) + 1 }), {});
                  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
                })()
              },
            ].map(({ icon, label, value }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px',
                border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
              }}>
                <div style={{ fontSize: '1.4rem', marginBottom: 5 }}>{icon}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#c9706a', marginBottom: 3 }}>{value || '—'}</div>
                <div style={{ fontSize: '0.68rem', color: '#a07070', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Top symptoms */}
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px', marginBottom: 12,
            border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#3d2b2b', marginBottom: 10 }}>
              Most Frequent Symptoms
            </div>
            {(() => {
              const freq = {};
              Object.values(logs).forEach(v => (v.symptoms || []).forEach(s => freq[s] = (freq[s] || 0) + 1));
              const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5);
              if (!sorted.length) return <div style={{ fontSize: '0.8rem', color: '#a07070', textAlign: 'center', padding: '8px 0' }}>No symptoms logged yet</div>;
              const max = sorted[0][1];
              return sorted.map(([sym, count]) => (
                <div key={sym} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: '0.8rem', textTransform: 'capitalize', color: '#3d2b2b' }}>{sym}</span>
                    <span style={{ fontSize: '0.75rem', color: '#a07070' }}>{count}x</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(201,112,106,0.12)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: 'linear-gradient(90deg,#c9706a,#d4748c)', borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                </div>
              ));
            })()}
          </div>

          {/* Recent history */}
          <div style={{
            background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px',
            border: '1px solid rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#3d2b2b', marginBottom: 10 }}>
              Recent Periods
            </div>
            {startDays.length === 0
              ? <div style={{ fontSize: '0.8rem', color: '#a07070', textAlign: 'center', padding: '8px 0' }}>No periods logged yet</div>
              : startDays.sort((a, b) => b[0].localeCompare(a[0])).slice(0, 5).map(([key]) => {
                const d = parseKey(key);
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid rgba(201,112,106,0.1)' }}>
                    <span style={{ fontSize: '0.85rem', color: '#3d2b2b' }}>
                      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#c9706a', background: 'rgba(201,112,106,0.1)', padding: '3px 8px', borderRadius: 10 }}>
                      🩸 started
                    </span>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}

function isConsecutive(k1, k2) {
  const d1 = parseKey(k1);
  const d2 = parseKey(k2);
  return (d2 - d1) === 86400000;
}
