/**
 * ELD Log Sheet Grid Drawing Utilities
 * Draws FMCSA-compliant driver's daily log on HTML5 canvas.
 */

export const DUTY_STATUS_ROWS = {
  off_duty: 0,
  sleeper_berth: 1,
  driving: 2,
  on_duty_not_driving: 3,
};

export const ROW_LABELS = ['1. Off Duty', '2. Sleeper\nBerth', '3. Driving', '4. On Duty\n(Not Driving)'];
export const ROW_COLORS = { off_duty: '#2563EB', sleeper_berth: '#7C3AED', driving: '#059669', on_duty_not_driving: '#DC2626' };

// Canvas layout constants
export const LAYOUT = {
  WIDTH: 960,
  HEADER_HEIGHT: 170,
  GRID_LEFT: 130,
  GRID_TOP: 205,
  ROW_HEIGHT: 44,
  GRID_HEIGHT: 176, // 4 rows * 44
  GRID_WIDTH: 785,  // 720 hour grid + 65 total hours column
  REMARKS_TOP: 405,
  REMARKS_HEIGHT: 110,
  RECAP_TOP: 535,
  TOTAL_HEIGHT: 710,
};

/**
 * Convert an ISO datetime string to fractional hours from midnight.
 * Clamps to [0, 24].
 */
export function isoToHours(isoString, dayDateStr) {
  const eventDate = new Date(isoString);
  const dayDate = new Date(dayDateStr + "T00:00:00Z");
  
  // Calculate difference in milliseconds
  const diffMs = eventDate.getTime() - dayDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Clamp to [0, 24]
  return Math.max(0, Math.min(24, diffHours));
}

/**
 * Convert fractional hours to X coordinate on the grid.
 */
export function hoursToX(hours) {
  return LAYOUT.GRID_LEFT + (hours / 24) * 720;
}

/**
 * Get the Y center of a given duty status row.
 */
export function rowToY(rowIndex) {
  return LAYOUT.GRID_TOP + rowIndex * LAYOUT.ROW_HEIGHT + LAYOUT.ROW_HEIGHT / 2;
}

/**
 * Draw the full log sheet background structure onto a canvas context.
 */
export function drawLogSheetBackground(ctx, dayLog, tripData = null, meta = {}) {
  const { WIDTH, TOTAL_HEIGHT, GRID_LEFT, GRID_TOP, GRID_WIDTH, GRID_HEIGHT, ROW_HEIGHT } = LAYOUT;
  const date = dayLog?.date || '';

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WIDTH, TOTAL_HEIGHT);

  // ---- HEADER SECTION (Redesigned matching original paper log form) ----
  // 1. Top Title & Possession text
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px "IBM Plex Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText("Drivers Daily Log", 20, 44);

  ctx.font = '8px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText("Original - File at home terminal.", 670, 32);
  ctx.fillText("Duplicate - Driver retains in his/her possession for 8 days.", 670, 43);

  // Date fields in the middle-top: (month) / (day) / (year)
  let month = "", day = "", year = "";
  if (date) {
    const parts = date.split('-');
    if (parts.length === 3) {
      month = parts[1];
      day = parts[2];
      year = parts[0];
    }
  }

  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.font = 'bold 11px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';

  // Draw month line & value
  ctx.beginPath(); ctx.moveTo(350, 42); ctx.lineTo(390, 42); ctx.stroke();
  ctx.fillText(month, 370, 39);
  ctx.font = '8px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#64748B'; ctx.fillText('(month)', 370, 51);

  // Slash
  ctx.font = 'bold 12px "IBM Plex Sans", sans-serif'; ctx.fillText('/', 395, 41);

  // Draw day line & value
  ctx.font = 'bold 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#0F172A';
  ctx.beginPath(); ctx.moveTo(400, 42); ctx.lineTo(430, 42); ctx.stroke();
  ctx.fillText(day, 415, 39);
  ctx.font = '8px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#64748B'; ctx.fillText('(day)', 415, 51);

  // Slash
  ctx.font = 'bold 12px "IBM Plex Sans", sans-serif'; ctx.fillText('/', 435, 41);

  // Draw year line & value
  ctx.font = 'bold 11px "IBM Plex Mono", monospace'; ctx.fillStyle = '#0F172A';
  ctx.beginPath(); ctx.moveTo(440, 42); ctx.lineTo(480, 42); ctx.stroke();
  ctx.fillText(year, 460, 39);
  ctx.font = '8px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#64748B'; ctx.fillText('(year)', 460, 51);

  // 2. From & To lines
  ctx.font = 'bold 9px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.textAlign = 'left';
  ctx.fillText("From:", 20, 74);
  ctx.fillText("To:", 480, 74);

  // Draw lines
  ctx.beginPath(); ctx.moveTo(60, 76); ctx.lineTo(450, 76); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(505, 76); ctx.lineTo(940, 76); ctx.stroke();

  // Draw values
  ctx.fillStyle = '#0F172A';
  ctx.font = '9px "IBM Plex Sans", sans-serif';
  const {
    carrierName = "Driver Transportation Co.",
    officeAddress = "Main Office",
    terminalAddress = "Main Terminal"
  } = meta;

  let fromLoc = "—";
  let toLoc = "—";
  if (tripData?.route?.waypoints && tripData.route.waypoints.length > 0) {
    fromLoc = tripData.route.waypoints[0].name || "—";
    toLoc = tripData.route.waypoints[tripData.route.waypoints.length - 1].name || "—";
  } else if (dayLog && dayLog.events && dayLog.events.length > 0) {
    const firstEv = dayLog.events.find(e => e.location && e.location.name && e.location.name !== "Start Location" && !e.notes.includes("Off duty before"));
    if (firstEv) fromLoc = firstEv.location.name;
    const revEvents = [...dayLog.events].reverse();
    const lastEv = revEvents.find(e => e.location && e.location.name && e.location.name !== "Start Location");
    if (lastEv) toLoc = lastEv.location.name;
  }
  ctx.fillText(fromLoc, 65, 72);
  ctx.fillText(toLoc, 510, 72);

  // 3. Left Boxes & Right lines
  // Miles Box 1
  ctx.strokeRect(20, 86, 120, 30);
  ctx.font = '8px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#64748B';
  ctx.textAlign = 'center';
  ctx.fillText("Total Miles Driving Today", 80, 126);

  // Miles Box 2 (Total Mileage Today)
  ctx.strokeRect(155, 86, 120, 30);
  ctx.fillText("Total Mileage Today", 215, 126);

  // Values inside boxes
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 12px "IBM Plex Mono", monospace';
  ctx.fillText(dayLog ? Math.round(dayLog.total_miles).toString() : "0", 80, 105);
  const totalTripMiles = tripData?.total_distance_miles != null ? Math.round(tripData.total_distance_miles).toString() : "0";
  ctx.fillText(totalTripMiles, 215, 105);

  // Vehicle Numbers Box
  ctx.strokeStyle = '#94A3B8';
  ctx.strokeRect(20, 136, 255, 25);
  ctx.font = '8px "IBM Plex Sans", sans-serif'; ctx.fillStyle = '#64748B';
  ctx.fillText("Truck/Tractor & Trailer Numbers", 147, 171);

  ctx.fillStyle = '#0F172A';
  ctx.font = '9px "IBM Plex Sans", sans-serif';
  ctx.fillText("TRK-001 / TRL-99", 147, 152);

  // Right-side Carrier fields
  ctx.textAlign = 'left';
  ctx.font = 'bold 9px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText("Name of Carrier:", 300, 104);
  ctx.fillText("Main Office Address:", 300, 129);
  ctx.fillText("Home Terminal Address:", 300, 154);

  // Lines for right side
  ctx.beginPath(); ctx.moveTo(385, 106); ctx.lineTo(940, 106); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(405, 131); ctx.lineTo(940, 131); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(415, 156); ctx.lineTo(940, 156); ctx.stroke();

  // Values for right side
  ctx.fillStyle = '#0F172A';
  ctx.font = '9px "IBM Plex Sans", sans-serif';
  ctx.fillText(carrierName, 390, 102);
  ctx.fillText(officeAddress, 410, 127);
  ctx.fillText(terminalAddress, 420, 152);

  // ---- HOUR LABELS HEADER BAR ----
  ctx.fillStyle = '#1A2E4A';
  ctx.fillRect(GRID_LEFT, GRID_TOP - 30, GRID_WIDTH, 30);

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(GRID_LEFT, GRID_TOP - 30, GRID_WIDTH, 30);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8px "IBM Plex Mono", monospace';

  const hours = ['Mid\nnight', '1','2','3','4','5','6','7','8','9','10','11','Noon',
                 '1','2','3','4','5','6','7','8','9','10','11','Mid\nnight'];
  hours.forEach((h, i) => {
    const x = GRID_LEFT + (i / 24) * 720;
    
    if (i === 0) {
      ctx.textAlign = 'left';
    } else if (i === 24) {
      ctx.textAlign = 'right';
    } else {
      ctx.textAlign = 'center';
    }

    const xPos = i === 0 ? x + 4 : (i === 24 ? x - 4 : x);

    if (h.includes('\n')) {
      const parts = h.split('\n');
      ctx.fillText(parts[0], xPos, GRID_TOP - 20);
      ctx.fillText(parts[1], xPos, GRID_TOP - 10);
    } else {
      ctx.fillText(h, xPos, GRID_TOP - 13);
    }
  });

  // Total Hours column label
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 8px "IBM Plex Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText("Total", 882.5, GRID_TOP - 20);
  ctx.fillText("Hours", 882.5, GRID_TOP - 10);

  // ---- GRID BACKGROUND ----
  // Alternating columns (AM/PM shading) for 24-hour grid
  for (let i = 0; i < 24; i++) {
    const x = GRID_LEFT + (i / 24) * 720;
    const w = 720 / 24;
    ctx.fillStyle = i >= 12 ? '#F8FAFF' : '#FFFFFF';
    ctx.fillRect(x, GRID_TOP, w, GRID_HEIGHT);
  }

  // Total Hours column background
  ctx.fillStyle = '#FAFCFF';
  ctx.fillRect(850, GRID_TOP, 65, GRID_HEIGHT);

  // Grid border (enclosing the 24 hour grid and total column)
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(GRID_LEFT, GRID_TOP, GRID_WIDTH, GRID_HEIGHT);

  // Horizontal row dividers
  for (let r = 1; r < 4; r++) {
    const y = GRID_TOP + r * ROW_HEIGHT;
    ctx.beginPath();
    ctx.moveTo(GRID_LEFT, y);
    ctx.lineTo(GRID_LEFT + GRID_WIDTH, y);
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Vertical hour lines (0 to 24)
  for (let h = 0; h <= 24; h++) {
    const x = GRID_LEFT + (h / 24) * 720;
    ctx.beginPath();
    ctx.moveTo(x, GRID_TOP);
    ctx.lineTo(x, GRID_TOP + GRID_HEIGHT);
    ctx.strokeStyle = h % 6 === 0 ? '#475569' : (h % 2 === 0 ? '#CBD5E1' : '#E2E8F0');
    ctx.lineWidth = h % 6 === 0 ? 1.2 : 0.5;
    ctx.stroke();
  }

  // 15-minute tick marks inside 24h grid
  for (let q = 0; q < 24 * 4; q++) {
    if (q % 4 === 0) continue; // skip full hours
    const x = GRID_LEFT + (q / (24 * 4)) * 720;
    for (let r = 0; r < 4; r++) {
      const y = GRID_TOP + r * ROW_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 6);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }
  }

  // Row labels (left side)
  ROW_LABELS.forEach((label, i) => {
    const y = GRID_TOP + i * ROW_HEIGHT;
    ctx.fillStyle = '#1A2E4A';
    ctx.font = 'bold 9px "IBM Plex Sans", sans-serif';
    ctx.textAlign = 'right';
    const lines = label.split('\n');
    lines.forEach((line, li) => {
      ctx.fillText(line, GRID_LEFT - 6, y + 14 + li * 12);
    });
  });

  // ---- REMARKS SECTION ----
  ctx.fillStyle = '#1A2E4A';
  ctx.fillRect(0, LAYOUT.REMARKS_TOP - 4, WIDTH, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('REMARKS — (Enter city/town at each duty status change)', 20, LAYOUT.REMARKS_TOP + 10);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const y = LAYOUT.REMARKS_TOP + 24 + i * 22;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(WIDTH - 20, y);
    ctx.stroke();
  }

  // ---- RECAP SECTION ----
  ctx.fillStyle = '#1A2E4A';
  ctx.fillRect(0, LAYOUT.RECAP_TOP - 4, WIDTH, 22);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('RECAP — TOTAL HOURS', 20, LAYOUT.RECAP_TOP + 10);
}

/**
 * Draw a horizontal line for one duty status period.
 */
export function drawDutySegment(ctx, dutyStatus, startHour, endHour, prevStatus, prevEndHour) {
  const rowIndex = DUTY_STATUS_ROWS[dutyStatus] ?? 0;
  const y = rowToY(rowIndex);
  const x1 = hoursToX(startHour);
  const x2 = hoursToX(endHour);
  const color = ROW_COLORS[dutyStatus] || '#0F172A';

  // Draw vertical connector from previous status row to current row first
  if (prevStatus !== null && prevStatus !== undefined) {
    const prevRowIndex = DUTY_STATUS_ROWS[prevStatus] ?? 0;
    const prevY = rowToY(prevRowIndex);
    const xConnect = hoursToX(startHour);
    ctx.beginPath();
    ctx.moveTo(xConnect, prevY);
    ctx.lineTo(xConnect, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw horizontal line for this period
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * Draw remarks text entries.
 */
export function drawRemarks(ctx, remarks) {
  // Draw left labels and mock values matching original paper log layout
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 9px "IBM Plex Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText("Shipping Documents:", 20, LAYOUT.REMARKS_TOP + 32);
  ctx.fillText("Manifest or DVL No.:", 20, LAYOUT.REMARKS_TOP + 57);
  ctx.fillText("Shipper & Commodity:", 20, LAYOUT.REMARKS_TOP + 82);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(125, LAYOUT.REMARKS_TOP + 34); ctx.lineTo(280, LAYOUT.REMARKS_TOP + 34); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(125, LAYOUT.REMARKS_TOP + 59); ctx.lineTo(280, LAYOUT.REMARKS_TOP + 59); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(125, LAYOUT.REMARKS_TOP + 84); ctx.lineTo(280, LAYOUT.REMARKS_TOP + 84); ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '9px "IBM Plex Sans", sans-serif';
  ctx.fillText("—", 130, LAYOUT.REMARKS_TOP + 30);
  ctx.fillText("—", 130, LAYOUT.REMARKS_TOP + 55);
  ctx.fillText("—", 130, LAYOUT.REMARKS_TOP + 80);

  // Draw horizontal lines for the actual remarks on the right
  for (let i = 0; i < 4; i++) {
    const y = LAYOUT.REMARKS_TOP + 24 + i * 22;
    ctx.strokeStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(310, y + 10);
    ctx.lineTo(940, y + 10);
    ctx.stroke();
  }

  // Draw the remarks text
  ctx.fillStyle = '#0F172A';
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  remarks.slice(0, 4).forEach((remark, i) => {
    const y = LAYOUT.REMARKS_TOP + 30 + i * 22;
    ctx.fillText(remark, 315, y);
  });

  if (remarks.length > 4) {
    remarks.slice(4, 8).forEach((remark, i) => {
      const y = LAYOUT.REMARKS_TOP + 30 + i * 22;
      ctx.fillText(remark, 630, y);
    });
  }
}

/**
 * Draw recap totals.
 */
export function drawRecap(ctx, totals) {
  const { driving, onDuty, offDuty, cycleEnd, availableTomorrow, totalMiles } = totals;

  // Draw container border box for the Recap grid
  ctx.strokeStyle = '#94A3B8';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, LAYOUT.RECAP_TOP + 20, 920, 115);

  // Divide box into 2 columns
  ctx.beginPath();
  ctx.moveTo(300, LAYOUT.RECAP_TOP + 20);
  ctx.lineTo(300, LAYOUT.RECAP_TOP + 135);
  ctx.stroke();

  // Column 1: Daily Hours Summary
  ctx.fillStyle = '#1A2E4A';
  ctx.font = 'bold 10px "IBM Plex Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText("Daily Hours Summary", 35, LAYOUT.RECAP_TOP + 38);

  const dailyStats = [
    { label: 'Off Duty Hours Today:', value: offDuty.toFixed(2) + ' hrs' },
    { label: 'Driving Hours Today:', value: driving.toFixed(2) + ' hrs' },
    { label: 'On Duty (Not Driving) Today:', value: onDuty.toFixed(2) + ' hrs' },
    { label: 'Total Miles Today:', value: totalMiles.toFixed(0) + ' mi' },
  ];

  dailyStats.forEach((stat, i) => {
    const y = LAYOUT.RECAP_TOP + 57 + i * 18;
    ctx.fillStyle = '#64748B';
    ctx.font = '9px "IBM Plex Sans", sans-serif';
    ctx.fillText(stat.label, 35, y);
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 9px "IBM Plex Mono", monospace';
    ctx.fillText(stat.value, 195, y);
  });

  // Column 2: HOS Cycle Recap
  ctx.fillStyle = '#1A2E4A';
  ctx.font = 'bold 10px "IBM Plex Sans", sans-serif';
  ctx.fillText("70-Hour / 8-Day Carrier Rules Recap", 320, LAYOUT.RECAP_TOP + 38);

  const hosStats = [
    { 
      label: 'A. On-Duty Hours Today:', 
      value: (driving + onDuty).toFixed(2) + ' hrs',
      desc: '(Driving + On Duty Not Driving for the current day)' 
    },
    { 
      label: 'B. Total HOS Cycle Hours Used (last 8 days):', 
      value: cycleEnd.toFixed(2) + ' hrs',
      desc: '(Includes cumulative on-duty hours of current trip cycle)' 
    },
    { 
      label: 'C. HOS Hours Available Tomorrow (70 - B):', 
      value: availableTomorrow.toFixed(2) + ' hrs',
      desc: '(Hours remaining before hitting the 70-hour HOS limit)' 
    },
  ];

  hosStats.forEach((stat, i) => {
    const y = LAYOUT.RECAP_TOP + 57 + i * 24;
    ctx.fillStyle = '#64748B';
    ctx.font = '9px "IBM Plex Sans", sans-serif';
    ctx.fillText(stat.label, 320, y);
    
    ctx.font = 'italic 8px "IBM Plex Sans", sans-serif';
    ctx.fillText(stat.desc, 320, y + 10);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 11px "IBM Plex Mono", monospace';
    ctx.fillText(stat.value, 600, y + 4);
  });

  // 34-hour restart note
  ctx.fillStyle = '#94A3B8';
  ctx.font = 'italic 8px "IBM Plex Sans", sans-serif';
  ctx.fillText("*Note: Taking 34 consecutive hours off-duty fully resets the HOS 70-hour cycle to zero.", 320, LAYOUT.RECAP_TOP + 148);

  // Draw values inside the grid Total Hours column boxes (right side of main grid)
  const statusTotals = [
    { label: 'Off Duty', hours: offDuty },
    { label: 'Sleeper', hours: 0 },
    { label: 'Driving', hours: driving },
    { label: 'On Duty', hours: onDuty },
  ];
  statusTotals.forEach((s, i) => {
    const y = LAYOUT.GRID_TOP + i * LAYOUT.ROW_HEIGHT + LAYOUT.ROW_HEIGHT / 2;
    ctx.fillStyle = '#1A2E4A';
    ctx.font = 'bold 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(s.hours.toFixed(2), 882.5, y + 4);
  });
}

/**
 * Main function: render a complete day's log sheet onto a canvas element.
 */
export function renderLogSheet(canvas, dayLog, tripData = null) {
  const ctx = canvas.getContext('2d');
  canvas.width = LAYOUT.WIDTH;
  canvas.height = LAYOUT.TOTAL_HEIGHT;

  // Scale for retina displays
  const dpr = window.devicePixelRatio || 1;
  canvas.width = LAYOUT.WIDTH * dpr;
  canvas.height = LAYOUT.TOTAL_HEIGHT * dpr;
  canvas.style.width = `${LAYOUT.WIDTH}px`;
  canvas.style.height = `${LAYOUT.TOTAL_HEIGHT}px`;
  canvas.style.maxWidth = 'none';
  ctx.scale(dpr, dpr);

  // Draw background structure
  drawLogSheetBackground(ctx, dayLog, tripData);

  // Draw duty status segments
  const events = dayLog.events || [];
  let prevStatus = null;
  let prevEndHour = 0;

  events.forEach((event) => {
    const startHour = isoToHours(event.start_time, dayLog.date);
    const endHour = isoToHours(event.end_time, dayLog.date);
    drawDutySegment(ctx, event.duty_status, startHour, endHour, prevStatus, prevEndHour);
    prevStatus = event.duty_status;
    prevEndHour = endHour;
  });

  // Build remarks
  const remarks = events
    .filter(e => e.notes)
    .slice(0, 8)
    .map(e => {
      const time = new Date(e.start_time).toUTCString().slice(17, 22);
      return `${time} — ${e.notes} — ${e.location?.name || ''}`;
    });
  drawRemarks(ctx, remarks);

  // Draw recap
  drawRecap(ctx, {
    driving: dayLog.total_driving_hours,
    onDuty: dayLog.total_on_duty_hours,
    offDuty: dayLog.total_off_duty_hours,
    cycleEnd: dayLog.cycle_hours_end_of_day,
    availableTomorrow: dayLog.hours_available_tomorrow,
    totalMiles: dayLog.total_miles,
  });
}
