import { useRef, useEffect, useState } from 'react';
import { Download, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { renderLogSheet } from '../../utils/gridDrawer';

function LogSheetCanvas({ dayLog, tripData }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !dayLog) return;
    const animationFrameId = requestAnimationFrame(() => {
      if (canvasRef.current) {
        renderLogSheet(canvasRef.current, dayLog, tripData);
      }
    });
    return () => cancelAnimationFrame(animationFrameId);
  }, [dayLog, tripData]);

  return (
    <div className="overflow-x-auto w-full">
      <canvas
        ref={canvasRef}
        className="log-canvas rounded-lg border border-slate-700"
        style={{ minWidth: '960px', display: 'block', margin: '0 auto', maxWidth: 'none' }}
      />
    </div>
  );
}

export default function LogSheetViewer({ tripData }) {
  const [currentDay, setCurrentDay] = useState(0);
  const canvasRef = useRef(null);

  const dailyLogs = tripData?.daily_logs || [];
  const totalDays = dailyLogs.length;
  const currentLog = dailyLogs[currentDay];

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [960, 710] });

    for (let i = 0; i < totalDays; i++) {
      if (i > 0) pdf.addPage();

      // Render to a temp canvas
      const tempCanvas = document.createElement('canvas');
      renderLogSheet(tempCanvas, dailyLogs[i], tripData);
      const imgData = tempCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 960, 710);
    }

    pdf.save(`ELD-Log-${tripData.trip_id?.slice(0, 8) || 'trip'}.pdf`);
  };

  const handleDownloadPNG = () => {
    const tempCanvas = document.createElement('canvas');
    renderLogSheet(tempCanvas, currentLog, tripData);
    const link = document.createElement('a');
    link.download = `ELD-Log-Day-${currentDay + 1}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
  };

  if (!currentLog) return (
    <div className="flex items-center justify-center h-48 text-slate-500">
      No log sheets generated.
    </div>
  );

  const dutyColors = {
    driving: 'bg-emerald-500',
    on_duty_not_driving: 'bg-red-500',
    off_duty: 'bg-blue-500',
    sleeper_berth: 'bg-purple-500',
  };

  return (
    <div className="space-y-4 max-w-[1008px] mx-auto w-full">
      {/* Day selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText size={18} className="text-amber-400" />
          <h3 className="font-mono font-semibold text-white">
            Daily Log Sheets
            <span className="text-slate-400 font-normal text-sm ml-2">({totalDays} day{totalDays !== 1 ? 's' : ''})</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPNG}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 transition-colors"
          >
            <Download size={13} /> PNG
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 rounded-lg text-xs font-bold transition-colors"
            style={{color:'#0a1628'}}
          >
            <Download size={13} /> All Days PDF
          </button>
        </div>
      </div>

      {/* Day pagination */}
      {totalDays > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCurrentDay(d => Math.max(0, d - 1))}
            disabled={currentDay === 0}
            className="p-1.5 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          {dailyLogs.map((log, i) => (
            <button
              key={i}
              onClick={() => setCurrentDay(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors whitespace-nowrap ${
                i === currentDay
                  ? 'bg-amber-500 text-navy-900'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              style={i === currentDay ? {color:'#0a1628'} : {}}
            >
              Day {log.day}
              <span className="block text-xs opacity-70">{log.date}</span>
            </button>
          ))}

          <button
            onClick={() => setCurrentDay(d => Math.min(totalDays - 1, d + 1))}
            disabled={currentDay === totalDays - 1}
            className="p-1.5 rounded-lg bg-slate-700 disabled:opacity-40 hover:bg-slate-600 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Hour summary pills */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'Driving', value: currentLog.total_driving_hours, cls: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
          { label: 'On Duty', value: currentLog.total_on_duty_hours, cls: 'border-rose-500/30 text-rose-400 bg-rose-500/10' },
          { label: 'Off Duty', value: currentLog.total_off_duty_hours, cls: 'border-sky-500/30 text-sky-400 bg-sky-500/10' },
          { label: 'Miles', value: currentLog.total_miles, cls: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
          { label: 'Cycle Used', value: currentLog.cycle_hours_end_of_day, cls: 'border-purple-500/30 text-purple-400 bg-purple-500/10' },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`px-3 py-1.5 border rounded-lg text-xs font-mono ${cls}`}>
            <span className="opacity-85"> {label}: </span>
            <span className="font-bold">{typeof value === 'number' && label !== 'Miles' ? value.toFixed(2) : Math.round(value)}{label !== 'Miles' ? 'h' : ' mi'}</span>
          </div>
        ))}
      </div>

      {/* Canvas log sheet */}
      <div className="bg-white rounded-xl p-6 shadow-xl">
        <LogSheetCanvas dayLog={currentLog} tripData={tripData} />
      </div>

      {/* Event timeline for current day */}
      <div className="bg-navy-800 border border-slate-700 rounded-xl p-4" style={{background:'rgba(26,46,74,0.7)'}}>
        <h4 className="font-mono text-sm font-semibold text-white mb-3">Day {currentLog.day} Event Timeline</h4>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {(currentLog.events || []).map((ev, i) => {
            const statusColors = {
              driving: 'text-emerald-400 border-emerald-600',
              on_duty_not_driving: 'text-red-400 border-red-700',
              off_duty: 'text-blue-400 border-blue-700',
              sleeper_berth: 'text-purple-400 border-purple-700',
            };
            const cls = statusColors[ev.duty_status] || 'text-slate-400 border-slate-600';
            const startTime = new Date(ev.start_time).toUTCString().slice(17, 22);
            let endTime = new Date(ev.end_time).toUTCString().slice(17, 22);
            if (endTime === '00:00' && new Date(ev.end_time).getTime() > new Date(ev.start_time).getTime()) {
              endTime = '24:00';
            }
            return (
              <div key={i} className={`flex items-start gap-3 text-xs border-l-2 pl-3 py-0.5 ${cls}`}>
                <span className="font-mono text-slate-500 whitespace-nowrap">{startTime}–{endTime}</span>
                <span className="text-slate-300">{ev.notes || ev.event_type}</span>
                {ev.location?.name && <span className="text-slate-500 ml-auto whitespace-nowrap">📍 {ev.location.name}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
