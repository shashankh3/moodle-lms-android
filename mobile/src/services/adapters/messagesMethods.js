import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../adapterUtils';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const messagesMethods = {
    async getConversations(userId = 2) {
    const client = await this.getClient();
    if (client) {
      try {
        const liveConvos = await client.getConversations(userId);
        if (liveConvos && Array.isArray(liveConvos.conversations)) {
          return liveConvos.conversations.map((c) => ({
            id: c.id,
            partner: {
              id: c.members?.[0]?.id || 1,
              name: c.name || c.members?.[0]?.fullname || 'Moodle Contact',
              avatar: getMoodleMediaUrl(c.members?.[0]?.profileimageurl, client.token) || null,
              role: 'Enrolled Member',
              online: c.members?.[0]?.isonline || false,
            },
            course: 'Direct Messages',
            unreadCount: c.unreadcount || 0,
            lastMessage: c.messages?.[c.messages.length - 1]?.text || '',
            lastMessageTime: 'Recent',
            messages: (c.messages || []).map((m) => ({
              id: m.id,
              senderId: m.useridfrom,
              senderName: m.useridfrom === userId ? 'You' : 'Contact',
              text: m.text,
              time: new Date(m.timecreated * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })),
          }));
        }
      } catch (e) {
        console.warn('Real Moodle getConversations note:', e);
      }
    }
    return [];
  },

    async sendMessage(conversationId, text, currentUser) {
    const client = await this.getClient();
    if (client) {
      try {
        await client.sendInstantMessages([
          {
            touserid: parseInt(conversationId, 10),
            text,
          },
        ]);
      } catch (e) {
        console.warn('Real Moodle sendInstantMessages note:', e);
      }
    }
    return {
      id: Date.now(),
      senderId: currentUser?.id || 2,
      text,
      timestamp: 'Just now',
      isMe: true,
    };
  },

};
