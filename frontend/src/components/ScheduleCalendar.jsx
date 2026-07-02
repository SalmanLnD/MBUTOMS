import { useRef, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { schedulesToEvents } from '../utils/scheduleUtils.js';
import '../styles/calendar.css';

const ScheduleCalendar = ({
  events = [],
  rangeStart,
  rangeEnd,
  onEventClick,
  onDatesSet,
  initialView = 'timeGridWeek',
  height = 'auto',
}) => {
  const calendarRef = useRef(null);

  const calendarEvents = useMemo(() => {
    if (!rangeStart || !rangeEnd) return [];
    return schedulesToEvents(events, new Date(rangeStart), new Date(rangeEnd));
  }, [events, rangeStart, rangeEnd]);

  const handleDatesSet = useCallback((info) => {
    onDatesSet?.(info);
  }, [onDatesSet]);

  return (
    <div className="schedule-calendar">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={initialView}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
        }}
        events={calendarEvents}
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        allDaySlot={false}
        height={height}
        nowIndicator
        eventClick={onEventClick}
        datesSet={handleDatesSet}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
      />
    </div>
  );
};

export default ScheduleCalendar;
