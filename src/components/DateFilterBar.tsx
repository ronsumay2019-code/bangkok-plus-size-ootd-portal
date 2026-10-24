import React from 'react';
import { CalendarDays } from 'lucide-react';
import { formatManilaDay } from '../utils/dates';

interface DateFilterBarProps {
  value: string;
  dates: string[];
  onChange: (day: string) => void;
  /** What an empty value shows, e.g. "All dates" or "Latest live" */
  allLabel: string;
  /** Short summary of what is shown, e.g. "42 orders" */
  caption?: string;
  /** Lives on the chosen date */
  liveTitles?: string[];
}

/** Picks a Manila calendar day for the order review, reconciliation and invoice views. */
export const DateFilterBar: React.FC<DateFilterBarProps> = ({ value, dates, onChange, allLabel, caption, liveTitles = [] }) => (
  <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs">
    <CalendarDays className="w-4 h-4 text-rose-400" />
    <label htmlFor="view-date" className="text-neutral-400 font-semibold">
      View date
    </label>
    <select
      id="view-date"
      name="view-date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-white font-semibold focus:outline-none"
    >
      <option value="">{allLabel}</option>
      {dates.map((d) => (
        <option key={d} value={d}>
          {formatManilaDay(d)}
        </option>
      ))}
    </select>
    {liveTitles.length > 0 && <span className="text-neutral-300">Live: {liveTitles.join(', ')}</span>}
    {caption && <span className="text-neutral-500">{caption}</span>}
    <span className="text-neutral-600 ml-auto">Manila time</span>
  </div>
);
