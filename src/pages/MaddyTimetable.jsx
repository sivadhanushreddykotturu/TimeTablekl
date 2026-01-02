import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FiShare2 } from "react-icons/fi";
import Header from "../components/Header";
import Toast from "../components/Toast";

const slotTimes = {
  1: { start: "07:10", end: "08:00" },
  2: { start: "08:00", end: "08:50" },
  3: { start: "09:20", end: "10:10" },
  4: { start: "10:10", end: "11:00" },
  5: { start: "11:10", end: "12:00" },
  6: { start: "12:00", end: "12:50" },
  7: { start: "13:00", end: "13:50" },
  8: { start: "13:50", end: "14:40" },
  9: { start: "14:50", end: "15:40" },
  10: { start: "15:50", end: "16:40" },
  11: { start: "16:40", end: "17:30" },
};

const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MaddyTimetable() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [maddy, setMaddy] = useState(null);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [exporting, setExporting] = useState(false);
  const timetableRef = useRef(null);

  useEffect(() => {
    const maddys = JSON.parse(localStorage.getItem("maddys") || "[]");
    const foundMaddy = maddys.find(m => m.id === parseInt(id));
    
    if (!foundMaddy) {
      setToast({
        show: true,
        message: "Friend not found",
        type: "error"
      });
      setTimeout(() => navigate("/maddys"), 2000);
      return;
    }

    setMaddy(foundMaddy);
  }, [id, navigate]);

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  const getSemesterDisplayName = (sem) => {
    switch(sem) {
      case 'odd': return 'Odd Semester';
      case 'even': return 'Even Semester';
      case 'summer': return 'Summer Semester';
      default: return sem;
    }
  };

  const generateHighQualityCanvas = useCallback(() => {
    if (!maddy || !maddy.timetable || Object.keys(maddy.timetable).length === 0) return null;

    const scale = 2;
    const padding = 40;
    const cellPadding = 12;
    const headerHeight = 60;
    const rowHeight = 50;
    const timeColWidth = 100;
    const dayColWidth = 200;
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const orderedDays = days.filter(day => maddy.timetable[day]);
    
    if (orderedDays.length === 0) return null;

    const numSlots = 11;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const width = timeColWidth + (dayColWidth * orderedDays.length) + (padding * 2);
    const height = headerHeight + (rowHeight * numSlots) + (padding * 2) + 40; // +40 for watermark
    
    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Title
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${maddy.name}'s Timetable`, width / 2, 35);
    
    let x = padding;
    let y = padding + headerHeight;
    
    // Draw time column header
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(x, y - headerHeight, timeColWidth, headerHeight);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y - headerHeight, timeColWidth, headerHeight);
    
    ctx.fillStyle = '#333333';
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Time', x + timeColWidth / 2, y - headerHeight / 2 + 5);
    
    // Draw day headers
    orderedDays.forEach((day, dayIdx) => {
      const dayX = x + timeColWidth + (dayColWidth * dayIdx);
      ctx.fillStyle = '#667eea';
      ctx.fillRect(dayX, y - headerHeight, dayColWidth, headerHeight);
      ctx.strokeStyle = '#5568d3';
      ctx.strokeRect(dayX, y - headerHeight, dayColWidth, headerHeight);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(day, dayX + dayColWidth / 2, y - headerHeight / 2 + 5);
    });
    
    // Draw time slots and classes
    for (let slot = 1; slot <= numSlots; slot++) {
      const slotY = y + (rowHeight * (slot - 1));
      
      // Time slot label
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(x, slotY, timeColWidth, rowHeight);
      ctx.strokeStyle = '#e0e0e0';
      ctx.strokeRect(x, slotY, timeColWidth, rowHeight);
      
      ctx.fillStyle = '#666666';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const timeText = `${slotTimes[slot].start} - ${slotTimes[slot].end}`;
      ctx.fillText(timeText, x + timeColWidth / 2, slotY + rowHeight / 2 + 4);
      
      // Day columns
      orderedDays.forEach((day, dayIdx) => {
        const dayX = x + timeColWidth + (dayColWidth * dayIdx);
        const daySlots = maddy.timetable[day] || {};
        const classInfo = daySlots[slot.toString()];
        
        ctx.fillStyle = classInfo && classInfo !== '-' ? '#f0f4ff' : '#ffffff';
        ctx.fillRect(dayX, slotY, dayColWidth, rowHeight);
        ctx.strokeStyle = '#e0e0e0';
        ctx.strokeRect(dayX, slotY, dayColWidth, rowHeight);
        
        if (classInfo && classInfo !== '-') {
          // Split long text into multiple lines if needed
          const maxWidth = dayColWidth - (cellPadding * 2);
          ctx.fillStyle = '#1a1a1a';
          ctx.font = '600 11px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          
          const words = classInfo.split(' ');
          let line = '';
          let lineY = slotY + cellPadding + 12;
          
          words.forEach((word) => {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && line !== '') {
              ctx.fillText(line, dayX + cellPadding, lineY);
              line = word + ' ';
              lineY += 14;
            } else {
              line = testLine;
            }
          });
          ctx.fillText(line, dayX + cellPadding, lineY);
        }
      });
    }
    
    // Add watermark
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#999999';
    ctx.font = 'italic 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Timetable', width - 20, height - 15);
    ctx.restore();
    
    return canvas;
  }, [maddy]);

  const exportAsImage = useCallback(async () => {
    if (!maddy || !maddy.timetable || Object.keys(maddy.timetable).length === 0) return;
    setExporting(true);
    
    try {
      const canvas = generateHighQualityCanvas();
      if (!canvas) {
        alert('Failed to generate image');
        setExporting(false);
        return;
      }
      
      const fileName = `${maddy.name}_Timetable_${new Date().toISOString().split('T')[0]}.png`;
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('Failed to generate image');
          setExporting(false);
          return;
        }
        
        // Try to use Web Share API if available
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], fileName, { type: 'image/png' });
            const shareData = {
              files: [file],
              title: `${maddy.name}'s Timetable`,
              text: `Check out ${maddy.name}'s timetable!`
            };
            
            // Check if we can share files
            if (navigator.canShare(shareData)) {
              await navigator.share(shareData);
              setExporting(false);
              return;
            }
          } catch (shareError) {
            // If sharing fails or is cancelled, fall back to download
            if (shareError.name !== 'AbortError') {
              console.log('Share failed, falling back to download:', shareError);
            }
          }
        }
        
        // Fallback: download if Web Share API is not available or failed
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        setExporting(false);
      }, 'image/png', 1.0);
      
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
      setExporting(false);
    }
  }, [maddy, generateHighQualityCanvas]);

  const renderTimetableDay = (day, slots) => {
    const entries = Object.entries(slots)
      .filter(([slot]) => parseInt(slot) <= 11)
      .map(([slot, value]) => [parseInt(slot), value]);

    const merged = [];
    let i = 0;

    while (i < entries.length) {
      const [startSlot, value] = entries[i];
      if (value === "-") {
        i++;
        continue;
      }

      let endSlot = startSlot;
      while (
        i + 1 < entries.length &&
        entries[i + 1][1] === value &&
        entries[i + 1][0] === endSlot + 1
      ) {
        endSlot++;
        i++;
      }

      merged.push({ content: value, startSlot, endSlot });
      i++;
    }

    return (
      <div key={day} className="timetable-day">
        <h3>{day}</h3>
        <div className="timetable-slots">
          {merged.map((block, index) => (
            <div key={index} className="class-block">
              <div className="class-name">{block.content}</div>
              <div className="class-time">
                {slotTimes[block.startSlot].start} - {slotTimes[block.endSlot].end}
              </div>
            </div>
          ))}
          {merged.length === 0 && (
            <div className="no-classes">No classes today</div>
          )}
        </div>
      </div>
    );
  };

  if (!maddy) {
    return (
      <>
        <Header onRefresh={() => {}} />
        <div className="container">
          <div className="text-center">
            <h2>Loading...</h2>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header onRefresh={() => {}} />

      <div className="container">
        <div className="page-header">
          <div>
            <h1 className="page-title">{maddy.name}'s Timetable 📅</h1>
            <p className="page-subtitle">
              {getSemesterDisplayName(maddy.semester)} • {maddy.academicYear}
            </p>
          </div>
          <button 
            onClick={() => navigate("/maddys")} 
            className="secondary"
            style={{ marginTop: "16px" }}
          >
            ← Back to Maddys
          </button>
        </div>

        <div ref={timetableRef} className="timetable-container">
          {Object.entries(maddy.timetable).map(([day, slots]) =>
            renderTimetableDay(day, slots)
          )}
        </div>

        <div className="button-container">
          <button 
            onClick={() => navigate(`/maddys/${id}/class`)} 
            className="secondary full-width-mobile"
          >
            View Class Info 📚
          </button>
        </div>
      </div>

      {maddy && maddy.timetable && Object.keys(maddy.timetable).length > 0 && (
        <button
          className="export-icon-btn"
          onClick={exportAsImage}
          disabled={exporting}
          title="Share Timetable"
        >
          {exporting ? (
            <span style={{ fontSize: '20px' }}>⏳</span>
          ) : (
            <FiShare2 size={24} />
          )}
        </button>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
