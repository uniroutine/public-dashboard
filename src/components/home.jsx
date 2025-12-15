// src/components/home.jsx
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import './home.css';

function Routines() {
  const [routines, setRoutines] = useState([]);
  const [selectedRoutine, setSelectedRoutine] = useState(null);
  const [scheduleData, setScheduleData] = useState({});
  const [loading, setLoading] = useState(false);

  /* OFFLINE DETECTION */
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  /* CONSTANTS */
  // SATURDAY REMOVED
  const daysToFetch = ['mon', 'tue', 'wed', 'thu', 'fri'];

  const dayDisplayNames = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
  };

  const timeSlots = [
    { period: 1, time: '9:00 - 10:00' },
    { period: 2, time: '10:00 - 11:00' },
    { period: 3, time: '11:00 - 12:00' },
    { period: 4, time: '12:00 - 1:00', isLunch: true },
    { period: 5, time: '1:00 - 2:00' },
    { period: 6, time: '2:00 - 3:00' },
    { period: 7, time: '3:00 - 4:00' },
    { period: 8, time: '4:00 - 5:00' },
  ];

  /* ROUTINE OPTIONS */
  const routineOptions = routines.map((routine) => ({
    value: routine.id,
    label: routine.name || routine.id,
    data: routine,
  }));
  const selectedOption = selectedRoutine ? routineOptions.find((opt) => opt.value === selectedRoutine.id) : null;

  /* FETCH ROUTINES - preserve selection by id, but do not auto-select */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'routines'), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRoutines(list);
      setSelectedRoutine((prev) => {
        if (!prev) return null; // keep nothing selected on initial load
        return list.find((r) => r.id === prev.id) || null;
      });
    }, (err) => {
      console.error('routines snapshot error', err);
    });
    return () => unsub();
  }, []);

  /* FETCH SCHEDULE for selected routine */
  useEffect(() => {
    if (!selectedRoutine) {
      setScheduleData({});
      return;
    }

    setLoading(true);
    const unsubscribers = [];

    daysToFetch.forEach((day) => {
      const ref = collection(db, 'routines', selectedRoutine.id, day);
      const unsub = onSnapshot(ref, (snap) => {
        const periods = snap.docs.map((d) => ({
          id: d.id,
          periodNumber: parseInt(d.id, 10),
          ...d.data(),
        }));
        periods.sort((a, b) => a.periodNumber - b.periodNumber);
        setScheduleData((prev) => ({ ...prev, [day]: periods }));
        setLoading(false);
      }, (err) => {
        console.error('day snapshot error', err);
        setLoading(false);
      });
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((u) => u());
      setScheduleData({});
    };
  }, [selectedRoutine]);

  const getPeriodData = (day, periodNumber) => {
    const dayKey = day.toLowerCase().substring(0, 3);
    const arr = scheduleData[dayKey];
    if (!arr) return null;
    const p = arr.find((x) => x.periodNumber === periodNumber);
    if (!p) return null;
    return {
      subject: p.sname || p.subject || p.name || '',
      teacher: p.tname || p.teacher || '',
      code: p.scode || p.code || '',
      room: p.room || '',
    };
  };

  return (
    <>
      {isOffline && (
        <div className="offline-overlay">
          <div className="offline-dialog">
            <div className="offline-icon">🚫</div>
            <h2>You’re offline</h2>
            <p>Please check your network connection</p>
          </div>
        </div>
      )}

      <div className="routines-container">
        <div className="routines-header">
          <h1>Uniroutine</h1>
          <p>The universal routine manager</p>
        </div>

        <div className="routine-toolbar">
          <div className="routine-selector">
            <label>Select Class:</label>
            <Select
              value={selectedOption}
              onChange={(opt) => setSelectedRoutine(opt ? opt.data : null)}
              options={routineOptions}
              className="routine-select"
              classNamePrefix="routine-select"
              placeholder="Select your class"
              isSearchable
              isClearable
              isDisabled={loading}
            />
          </div>
        </div>

        {loading && (
          <div className="loading-box">
            <div className="throbber-ring" />
            <div className="loading-text">Loading schedule…</div>
          </div>
        )}

        {!selectedRoutine && !loading && (
          <div className="table-container">
            <div className="no-selection">
              <h3>Select your class first</h3>
              <p>To view your class schedule, please select it from the dropdown menu above</p>
            </div>
          </div>
        )}

        {selectedRoutine && !loading && (
          <div className="table-container">
            <h2 className="table-title">{selectedRoutine.name || selectedRoutine.id}</h2>

            <div className="table-wrapper">
              <table className="routine-table">
                <thead>
                  <tr>
                    <th className="day-column">Day / Time</th>
                    {timeSlots.map((slot, idx) => (
                      <th key={idx} className={slot.isLunch ? 'lunch-header' : ''}>{slot.time}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {daysToFetch.map((day) => (
                    <tr key={day}>
                      <td className="day-cell">{dayDisplayNames[day]}</td>

                      {timeSlots.map((slot, idx) => {
                        if (slot.isLunch) {
                          return (
                            <td key={idx} className="lunch-cell">
                              <span className="lunch-text">Lunch Break</span>
                            </td>
                          );
                        }

                        const periodData = getPeriodData(dayDisplayNames[day], slot.period);
                        return (
                          <td key={idx} className="subject-cell">
                            {periodData && periodData.subject ? (
                              <div className="cell-content">
                                <div className="subject-name">{periodData.subject}</div>
                                {periodData.code && <div className="subject-code">{periodData.code}</div>}
                                {periodData.teacher && <div className="teacher-name">{periodData.teacher}</div>}
                                {periodData.room && <div className="room-name">{periodData.room}</div>}
                              </div>
                            ) : (
                              <div className="cell-empty">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="info-footer">
              <p>Please contact your HOD in case of any discrepancy</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Routines;
