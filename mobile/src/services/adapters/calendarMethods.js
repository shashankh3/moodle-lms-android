import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const calendarMethods = {
    async getEvents(year, month) {
    const client = await this.getClient();
    if (!client) return [];
    try {
      const y1 = year || new Date().getFullYear();
      const m1 = month || new Date().getMonth() + 1;
      
      const liveAgenda1 = await client.getCalendarMonthlyView(y1, m1).catch(() => ({ weeks: [] }));

      const events = [];
      if (liveAgenda1 && liveAgenda1.weeks) {
        liveAgenda1.weeks.forEach((w) => {
          w.days?.forEach((d) => {
            d.events?.forEach((ev) => {
              events.push({
                id: ev.id,
                title: ev.name,
                course: ev.course?.fullname || 'Moodle Calendar',
                type: ev.eventtype === 'due' ? 'assignment' : ev.eventtype === 'quiz' ? 'quiz' : 'live_session',
                date: new Date(ev.timestart * 1000).toISOString().split('T')[0],
                time: new Date(ev.timestart * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                instructor: 'Staff',
                platform: 'Moodle Calendar',
              });
            });
          });
        });
      }
      return events;
    } catch (e) {
      console.warn('Real Moodle getCalendarMonthlyView note:', e);
    }
    return [];
  },

    async addEvent(eventData) {
    const client = await this.getClient();
    if (client) {
      try {
        await client.createCalendarEvents([
          {
            name: eventData.title,
            description: eventData.description || 'Calendar event',
            timestart: Math.floor(new Date(eventData.date).getTime() / 1000),
          },
        ]);
      } catch (e) {
        console.warn('Real Moodle createCalendarEvents note:', e);
      }
    }
    return { id: Date.now(), ...eventData };
  },

};
