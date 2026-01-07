import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiShare2 } from "react-icons/fi";

import Header from "../components/Header";
import CaptchaModal from "../components/CaptchaModal";
import Toast from "../components/Toast";
import { getSubjectName } from "../utils/subjectMapper";
import { trackEvent } from "../utils/analytics";
import { getSlotTimes, getMaxSlots } from "../utils/slotTimes";

export default function TimetableView() {
  const [timetable, setTimetable] = useState(
    JSON.parse(localStorage.getItem("timetable") || "{}")
  );
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [exporting, setExporting] = useState(false);
  const timetableRef = useRef(null);
  const navigate = useNavigate();

  // Get slot times based on current user's campus
  const slotTimes = getSlotTimes();
  const maxSlots = getMaxSlots();

  // Track timetable page view
  useEffect(() => {
    const dayCount = Object.keys(timetable).length;
    trackEvent('timetable_page_viewed', {
      has_timetable: dayCount > 0,
      day_count: dayCount
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Track only once on mount

  const refreshTimetable = () => {
    setShowCaptchaModal(true);
  };

  const handleCaptchaSuccess = (newTimetable) => {
    const dayCount = Object.keys(newTimetable).length;
    trackEvent('timetable_synced', {
      sync_location: 'timetable_page',
      day_count: dayCount,
      sync_method: 'captcha'
    });
    
    setTimetable(newTimetable);
    setToast({
      show: true,
      message: "Timetable synced successfully!",
      type: "success"
    });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  // Function to replace course code with custom subject name in timetable entry
  const replaceCourseCodeWithCustomName = useCallback((content) => {
    if (!content || content === "-") return content;
    
    // Extract course code (alphanumeric part at the start)
    // Format: "24MT2012-L - S-205 -RoomNo-S914"
    // Match course code at the beginning
    const match = content.match(/^([A-Za-z0-9]+)/);
    if (!match) return content;
    
    const courseCode = match[1];
    
    // Get custom name from localStorage
    const customName = getSubjectName(courseCode);
    
    // If custom name exists and is different, replace the course code in the content
    if (customName !== courseCode) {
      return content.replace(courseCode, customName);
    }
    
    return content;
  }, []);

  const generateHighQualityCanvas = useCallback(() => {
    if (!timetable || Object.keys(timetable).length === 0) return null;

    const scale = 2;
    const padding = 40;
    const cellPadding = 12;
    const headerHeight = 60;
    const rowHeight = 50;
    const timeColWidth = 100;
    const dayColWidth = 200;
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const orderedDays = days.filter(day => timetable[day]);
    
    if (orderedDays.length === 0) return null;

    const numSlots = getMaxSlots();
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
    ctx.fillText('Timetable', width / 2, 35);
    
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
        const daySlots = timetable[day] || {};
        const classInfo = daySlots[slot.toString()];
        
        ctx.fillStyle = classInfo && classInfo !== '-' ? '#f0f4ff' : '#ffffff';
        ctx.fillRect(dayX, slotY, dayColWidth, rowHeight);
        ctx.strokeStyle = '#e0e0e0';
        ctx.strokeRect(dayX, slotY, dayColWidth, rowHeight);
        
        if (classInfo && classInfo !== '-') {
          const displayContent = replaceCourseCodeWithCustomName(classInfo);
          
          // Split long text into multiple lines if needed
          const maxWidth = dayColWidth - (cellPadding * 2);
          ctx.fillStyle = '#1a1a1a';
          ctx.font = '600 11px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          
          const words = displayContent.split(' ');
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
  }, [timetable, replaceCourseCodeWithCustomName, slotTimes]);

  const exportAsImage = useCallback(async () => {
    if (!timetable || Object.keys(timetable).length === 0) return;
    setExporting(true);
    
    try {
      const canvas = generateHighQualityCanvas();
      if (!canvas) {
        alert('Failed to generate image');
        setExporting(false);
        return;
      }
      
      const fileName = `Timetable_${new Date().toISOString().split('T')[0]}.png`;
      
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
              title: 'My Timetable',
              text: 'Check out my timetable!'
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
  }, [timetable, generateHighQualityCanvas]);

  const renderDay = (day, slots) => {
    const entries = Object.entries(slots)
      .filter(([slot]) => parseInt(slot) <= maxSlots)
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
        {merged.map((block, idx) => {
          const displayContent = replaceCourseCodeWithCustomName(block.content);
          return (
            <div key={idx} className="class-block">
              <div className="class-name">{displayContent}</div>
              <div className="class-time">
                {slotTimes[block.startSlot].start} – {slotTimes[block.endSlot].end}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <Header onRefresh={refreshTimetable} />

      <div className="container">
        <div className="page-header">
          <h1 className="page-title">Your Timetable</h1>
          <div className="action-buttons">
            <button onClick={() => navigate("/home")}>
              Back to Home
            </button>
          </div>
        </div>

        <div ref={timetableRef}>
          {Object.keys(timetable).length === 0 ? (
            <div className="card">
              <p className="text-center">No timetable loaded. Please log in.</p>
            </div>
          ) : (
            Object.entries(timetable).map(([day, slots]) =>
              renderDay(day, slots)
            )
          )}
        </div>
      </div>

      {Object.keys(timetable).length > 0 && (
        <button
          className="export-icon-btn"
          onClick={exportAsImage}
          disabled={exporting}
          title="Export as Image"
        >
          {exporting ? (
            <span style={{ fontSize: '20px' }}>⏳</span>
          ) : (
            <FiShare2 size={24} />
          )}
        </button>
      )}

      <CaptchaModal
        isOpen={showCaptchaModal}
        onClose={() => setShowCaptchaModal(false)}
        onSuccess={handleCaptchaSuccess}
      />

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.show}
        onClose={closeToast}
      />
    </>
  );
}
