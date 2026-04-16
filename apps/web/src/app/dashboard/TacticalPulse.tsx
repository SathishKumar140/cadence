"use client";

import React from 'react';
import { motion } from 'framer-motion';

export interface MetricPoint {
  day: string;
  count: number;
}

interface TacticalPulseProps {
  data: MetricPoint[];
  type?: 'line' | 'bar';
  title?: string;
}

export default function TacticalPulse({ data, type = 'line', title }: TacticalPulseProps) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.count), 1);
  const chartHeight = 120;
  const chartWidth = 500;
  const padding = 30;
  
  const stepX = (chartWidth - padding * 2) / (data.length - 1);
  
  // Calculate points for line chart
  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: chartHeight - padding - (d.count / maxVal) * (chartHeight - padding * 2),
    ...d
  }));

  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <div className="w-full bg-slate-50/50 dark:bg-zinc-900/50 rounded-2xl border border-slate-100 dark:border-zinc-800/50 p-6 my-4 animate-in fade-in duration-700">
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/60">{title}</h4>
          <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
             <span className="text-[9px] font-bold text-[var(--muted-text)] uppercase tracking-widest">Live Momentum</span>
          </div>
        </div>
      )}

      <div className="relative h-[120px] w-full">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
          {/* Grid Lines */}
          {[0, 0.5, 1].map((p, i) => (
            <line 
              key={i}
              x1={padding}
              y1={chartHeight - padding - p * (chartHeight - padding * 2)}
              x2={chartWidth - padding}
              y2={chartHeight - padding - p * (chartHeight - padding * 2)}
              className="stroke-slate-200 dark:stroke-zinc-800"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          ))}

          {type === 'line' ? (
            <>
              {/* Area Under Line */}
              <motion.path
                d={`${pathD} L ${points[points.length-1].x},${chartHeight-padding} L ${points[0].x},${chartHeight-padding} Z`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                transition={{ duration: 1.5 }}
                className="fill-indigo-500"
              />
              
              {/* Main Line */}
              <motion.path
                d={pathD}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-indigo-500"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              />
              
              {/* Dots */}
              {points.map((p, i) => (
                <motion.circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1 + i * 0.1 }}
                  className="fill-[var(--background)] stroke-indigo-500"
                  strokeWidth="2"
                />
              ))}
            </>
          ) : (
            <>
              {/* Bar Chart Implementation */}
              {points.map((p, i) => (
                <motion.rect
                  key={i}
                  x={p.x - 10}
                  y={p.y}
                  width="20"
                  height={chartHeight - padding - p.y}
                  rx="4"
                  initial={{ height: 0, y: chartHeight - padding }}
                  animate={{ height: chartHeight - padding - p.y, y: p.y }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="fill-indigo-500/80 hover:fill-indigo-500 transition-colors cursor-pointer"
                />
              ))}
            </>
          )}

          {/* Labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={chartHeight - 5}
              textAnchor="middle"
              className="text-[9px] font-bold fill-[var(--muted-text)] uppercase tracking-tighter"
            >
              {p.day}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
