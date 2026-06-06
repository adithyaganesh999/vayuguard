'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const RANGES = [
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: '1 Year', days: 365 },
  { label: 'Custom', days: -1 },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function DateRangePicker({ onChange, value = {} }) {
  const [selectedRange, setSelectedRange] = useState(value.preset || 30);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState(value.startDate || null);
  const [customEnd, setCustomEnd] = useState(value.endDate || null);
  const [selectingStart, setSelectingStart] = useState(true);

  const handleRangeSelect = (days) => {
    setSelectedRange(days);
    if (days > 0) {
      setShowCalendar(false);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      onChange?.({ preset: days, startDate, endDate, days });
    } else {
      setShowCalendar(true);
    }
  };

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const handleDayClick = (day) => {
    const clicked = new Date(calendarYear, calendarMonth, day);
    if (selectingStart) {
      setCustomStart(clicked);
      setSelectingStart(false);
    } else {
      setCustomEnd(clicked);
      if (customStart && clicked >= customStart) {
        onChange?.({ preset: -1, startDate: customStart, endDate: clicked, days: Math.round((clicked - customStart) / 86400000) });
      }
      setSelectingStart(true);
    }
  };

  const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
  const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);

  const formatDate = (date) => {
    if (!date) return 'Select...';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <Calendar size={14} className="text-emerald-400" />
        <span className="text-white/40 text-xs uppercase tracking-wider">Date Range</span>
      </div>

      {/* Quick ranges */}
      <div className="flex flex-wrap gap-2 mb-3">
        {RANGES.map((range) => (
          <button
            key={range.label}
            onClick={() => handleRangeSelect(range.days)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
              selectedRange === range.days
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'glass text-white/50 hover:text-white/70'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Custom Calendar */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {/* Custom range display */}
            <div className="flex gap-2 mb-3">
              <div className="flex-1 p-2 rounded-lg glass text-center">
                <div className="text-white/20 text-[9px] uppercase">Start</div>
                <div className={`text-xs ${customStart ? 'text-emerald-400' : 'text-white/30'}`}>
                  {formatDate(customStart)}
                </div>
              </div>
              <div className="flex-1 p-2 rounded-lg glass text-center">
                <div className="text-white/20 text-[9px] uppercase">End</div>
                <div className={`text-xs ${customEnd ? 'text-emerald-400' : 'text-white/30'}`}>
                  {formatDate(customEnd)}
                </div>
              </div>
            </div>

            {/* Calendar header */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={() => {
                  if (calendarMonth === 0) {
                    setCalendarMonth(11);
                    setCalendarYear((y) => y - 1);
                  } else {
                    setCalendarMonth((m) => m - 1);
                  }
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/30"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-white/60 text-sm">
                {MONTHS[calendarMonth]} {calendarYear}
              </span>
              <button
                onClick={() => {
                  if (calendarMonth === 11) {
                    setCalendarMonth(0);
                    setCalendarYear((y) => y + 1);
                  } else {
                    setCalendarMonth((m) => m + 1);
                  }
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/30"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-white/20 text-[9px] py-1">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const date = new Date(calendarYear, calendarMonth, day);
                const isStart = customStart?.toDateString() === date.toDateString();
                const isEnd = customEnd?.toDateString() === date.toDateString();
                const isInRange = customStart && customEnd && date >= customStart && date <= customEnd;
                const isToday = new Date().toDateString() === date.toDateString();

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`aspect-square rounded-lg text-xs flex items-center justify-center transition-all ${
                      isStart || isEnd
                        ? 'bg-emerald-500 text-black font-bold'
                        : isInRange
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : isToday
                        ? 'bg-white/10 text-white'
                        : 'text-white/40 hover:bg-white/5'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
