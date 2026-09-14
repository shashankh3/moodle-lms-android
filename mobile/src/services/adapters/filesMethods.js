import { STORAGE_KEYS, saveToStorage, getFromStorage, swrFetch, getMoodleMediaUrl, fixMoodleHtmlContent, extractCourseImage } from '../apiAdapter';
import { MoodleClient, normalizeMoodleUrl } from '../moodleClient';

export const filesMethods = {
    async getPrivateFiles(user) {
    const client = await this.getClient();
    if (!client) return [];
    try {
      const siteInfo = await this.getSiteInfo();
      const moodleUserId = siteInfo?.userid || user?.id || 14;

      let files = [];
      let userContextId;
      try {
        // Always fetch dynamic context ID to prevent cache issues
        const draftInfo = await client.call('core_files_get_unused_draft_itemid', {});
        if (draftInfo && draftInfo.contextid) {
          userContextId = draftInfo.contextid;
          // Optionally save it, but we always re-fetch it above
          await saveToStorage(`moodle_user_context_${moodleUserId}`, userContextId);
        }
      } catch (de) {
        console.warn('draftInfo note:', de);
        // Fallback to cached context ID if offline or API fails
        userContextId = await getFromStorage(`moodle_user_context_${moodleUserId}`);
      }

        if (!userContextId) userContextId = 88;

      try {
        const res = await client.call('core_files_get_files', {
          contextid: userContextId,
          component: 'user',
          filearea: 'private',
          itemid: 0,
          filepath: '/',
          filename: '',
        });

        if (res && Array.isArray(res.files)) {
          files = res.files
            .filter((f) => f.filename !== '.')
            .map((f) => ({
              id: `moodle_server_${f.filename}_${f.timemodified || ''}`,
              name: f.filename,
              size: f.filesize ? (f.filesize > 1048576 ? `${(f.filesize / 1048576).toFixed(1)} MB` : `${Math.round(f.filesize / 1024)} KB`) : '0 KB',
              updated: f.timemodified ? new Date(f.timemodified * 1000).toLocaleDateString() : 'Recent',
              url: f.url ? getMoodleMediaUrl(f.url, client.token) : null,
              mimetype: f.mimetype,
              timemodified: f.timemodified,
              filesize: f.filesize,
              author: f.author,
              isServer: true,
            }));
        }
      } catch (err) {
        console.warn('core_files_get_files note:', err);
      }

      const localFiles = (await getFromStorage(`moodle_private_files_${moodleUserId}`)) || [];
      const serverNames = new Set(files.map((f) => f.name));
      const filteredLocal = localFiles.filter((lf) => !serverNames.has(lf.name));

      return files.concat(filteredLocal);
    } catch (e) {
      console.warn('getPrivateFiles error:', e);
      return [];
    }
  },

    async getPrivateFilesQuota(user) {
    const client = await this.getClient();
    if (!client) return { filecount: 0, filesize: 0, formattedSize: '0 MB' };
    try {
      const siteInfo = await this.getSiteInfo();
      const moodleUserId = siteInfo?.userid || user?.id || 14;
      const res = await client.call('core_user_get_private_files_info', { userid: moodleUserId });
      if (res && res.filesize !== undefined) {
        const sizeBytes = res.filesize || 0;
        const formatted = sizeBytes > 1048576 
          ? `${(sizeBytes / 1048576).toFixed(1)} MB` 
          : `${Math.round(sizeBytes / 1024)} KB`;
        return {
          filecount: res.filecount || 0,
          filesize: sizeBytes,
          formattedSize: formatted,
        };
      }
    } catch (e) {
      console.warn('getPrivateFilesQuota note:', e);
    }
    return { filecount: 0, filesize: 0, formattedSize: '0 MB' };
  },

    async addPrivateFile(user, fileData) {
    const client = await this.getClient();
    const siteInfo = await this.getSiteInfo();
    const moodleUserId = siteInfo?.userid || user?.id || 14;

    // 1. Save locally for instant offline UI update
    const existing = (await getFromStorage(`moodle_private_files_${moodleUserId}`)) || [];
    const updated = [fileData, ...existing];
    await saveToStorage(`moodle_private_files_${moodleUserId}`, updated);

    // 2. Sync to Moodle server if online
    if (client && client.token) {
      try {
        const draftRes = await client.call('core_files_get_unused_draft_itemid', {});
        if (draftRes && draftRes.itemid) {
          const draftId = draftRes.itemid;
          if (draftRes.contextid) {
            await saveToStorage(`moodle_user_context_${moodleUserId}`, draftRes.contextid);
          }

          const cleanBaseUrl = (client.baseUrl || 'https://mh.unilearn.org.in').replace(/\/+$/, '');
          const uploadUrl = `${cleanBaseUrl}/webservice/upload.php?token=${client.token}&filearea=draft&itemid=${draftId}&filepath=/&filename=${encodeURIComponent(fileData.name)}`;

          const boundary = `----ReactNativeBoundary${Date.now().toString(16)}`;
          const contentStr = typeof fileData.content === 'string' ? fileData.content : JSON.stringify(fileData.content || '');

          let body = '';
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="token"\r\n\r\n${client.token}\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="filearea"\r\n\r\ndraft\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="itemid"\r\n\r\n${draftId}\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="filepath"\r\n\r\n/\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="filename"\r\n\r\n${fileData.name}\r\n`;
          body += `--${boundary}\r\n`;
          body += `Content-Disposition: form-data; name="file"; filename="${fileData.name}"\r\n`;
          body += `Content-Type: text/plain; charset=utf-8\r\n\r\n`;
          body += `${contentStr}\r\n`;
          body += `--${boundary}--\r\n`;

          const uploadRes = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
            },
            body: body,
          });

          const uploadText = await uploadRes.text();
          console.log('[PrivateFiles upload.php]', uploadRes.status, uploadText);

          await client.call('core_user_add_user_private_files', {
            draftid: draftId,
          });
        }
      } catch (syncErr) {
        console.warn('Private file server sync note:', syncErr);
      }
    }

    return this.getPrivateFiles(user);
  },

    async deletePrivateFile(user, fileId) {
    const siteInfo = await this.getSiteInfo();
    const moodleUserId = siteInfo?.userid || user?.id || 14;
    const existing = (await getFromStorage(`moodle_private_files_${moodleUserId}`)) || [];
    const updated = existing.filter((f) => f.id !== fileId);
    await saveToStorage(`moodle_private_files_${moodleUserId}`, updated);
    return this.getPrivateFiles(user);
  },

};
