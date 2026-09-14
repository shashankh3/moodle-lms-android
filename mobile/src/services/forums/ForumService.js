/**
 * Forum Service — Phase 2 (Service Layer Refactoring)
 * Handles forum discussions, posts, and replies.
 * Reference: moodlehq/moodleapp addons/mod/forum
 */
import { MobileAPI, getMoodleMediaUrl } from '../apiAdapter';

export const ForumService = {
  async getForumById(forumId) {
    const client = await MobileAPI.getClient();
    if (client) {
      try {
        const discResp = await client.getForumDiscussions(forumId);
        if (discResp && Array.isArray(discResp.discussions)) {
          return {
            id: parseInt(forumId, 10),
            courseId: 1,
            courseName: 'Moodle Discussions',
            title: 'Course Discussions',
            description: 'Participate in active course discussions.',
            discussionsCount: discResp.discussions.length,
            unreadCount: 0,
            discussions: discResp.discussions.map((d) => ({
              id: d.discussion,
              title: d.name,
              content: d.message ? d.message.replace(/<[^>]*>?/gm, '').trim() : '',
              author: d.userfullname || 'Participant',
              authorRole: 'Contributor',
              authorAvatar: getMoodleMediaUrl(d.userpictureurl, client.token) || null,
              pinned: !!d.pinned,
              created: new Date(d.created * 1000).toISOString(),
              repliesCount: d.numreplies || 0,
              replies: [],
            })),
          };
        }
      } catch (e) {
        console.warn('[ForumService] getForumDiscussions note:', e);
      }
    }
    return null;
  },

  async addForumDiscussion(forumId, user, title, content) {
    const client = await MobileAPI.getClient();
    if (client) {
      try {
        await client.addDiscussion(forumId, title, content);
      } catch (e) {
        console.warn('[ForumService] addDiscussion note:', e);
      }
    }
    return this.getForumById(forumId);
  },

  async addForumReply(forumId, discussionId, user, content) {
    const client = await MobileAPI.getClient();
    if (client) {
      try {
        await client.addDiscussionPost(discussionId, 'Re: Discussion', content);
      } catch (e) {
        console.warn('[ForumService] addDiscussionPost note:', e);
      }
    }
    return this.getForumById(forumId);
  },
};
