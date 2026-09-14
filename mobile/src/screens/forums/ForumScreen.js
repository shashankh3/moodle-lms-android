import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { showMessage } from '../../utils/alert';
import {
  ArrowLeft,
  MessageSquare,
  Pin,
  Send,
  Plus,
  CornerDownRight,
  MessageCircle,
} from 'lucide-react-native';

export default function ForumScreen({ route, navigation }) {
  const { forumId = 1, courseId = 1 } = route?.params || {};
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  const [forum, setForum] = useState(null);
  const [activeDiscussion, setActiveDiscussion] = useState(null);
  const [showNewDisc, setShowNewDisc] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    MobileAPI.getForumById(forumId).then(f => {
      setForum(f);
      if (f && f.discussions.length > 0) {
        setActiveDiscussion(f.discussions[0]);
      }
    });
  }, [forumId]);

  const handleCreateDiscussion = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      showMessage('Incomplete', 'Please provide a title and content for your discussion topic.');
      return;
    }

    const updatedForum = await MobileAPI.addForumDiscussion(
      forum.id,
      currentUser,
      newTitle,
      newContent
    );
    if (updatedForum) {
      setForum(updatedForum);
      setActiveDiscussion(updatedForum.discussions[0]);
      setNewTitle('');
      setNewContent('');
      setShowNewDisc(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeDiscussion) return;

    const updatedForum = await MobileAPI.addForumReply(
      forum.id,
      activeDiscussion.id,
      currentUser,
      replyText.trim()
    );
    if (updatedForum) {
      setForum(updatedForum);
      const updatedDisc = updatedForum.discussions.find(d => d.id === activeDiscussion.id);
      setActiveDiscussion(updatedDisc);
      setReplyText('');
    }
  };

  if (!forum) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.textMuted }}>Loading forum...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: theme.text }]} numberOfLines={1}>
          {forum.name}
        </Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => setShowNewDisc(!showNewDisc)}
        >
          <Plus size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Forum Header Info */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.forumTitle, { color: theme.text }]}>{forum.name}</Text>
          <Text style={[styles.forumDesc, { color: theme.textMuted }]}>{forum.description}</Text>
        </View>

        {/* New Discussion Form */}
        {showNewDisc && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.formTitle, { color: theme.text }]}>New Discussion Topic</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surfaceSubtle, borderColor: theme.cardBorder, color: theme.text }]}
              placeholder="Topic Subject / Title"
              placeholderTextColor={theme.textDim}
              value={newTitle}
              onChangeText={setNewTitle}
            />
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surfaceSubtle, borderColor: theme.cardBorder, color: theme.text }]}
              placeholder="Write your discussion question or announcement..."
              placeholderTextColor={theme.textDim}
              value={newContent}
              onChangeText={setNewContent}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.postBtn, { backgroundColor: theme.primary }]}
              onPress={handleCreateDiscussion}
            >
              <Text style={styles.postBtnText}>Post to Forum</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Discussions List */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Discussion Threads</Text>
        {forum.discussions.map(disc => {
          const isSelected = activeDiscussion?.id === disc.id;
          return (
            <View
              key={disc.id}
              style={[
                styles.discCard,
                { backgroundColor: theme.card, borderColor: isSelected ? theme.primary : theme.cardBorder },
              ]}
            >
              <TouchableOpacity
                style={styles.discHeader}
                onPress={() => setActiveDiscussion(disc)}
                activeOpacity={0.7}
              >
                <Image source={{ uri: disc.authorAvatar }} style={styles.authorAvatar} />
                <View style={styles.discInfo}>
                  <View style={styles.discTitleRow}>
                    {disc.pinned && <Pin size={14} color={theme.warning} style={{ marginRight: 4 }} />}
                    <Text style={[styles.discTitle, { color: theme.text }]}>{disc.title}</Text>
                  </View>
                  <Text style={[styles.authorName, { color: theme.textDim }]}>
                    {disc.author} • {disc.authorRole}
                  </Text>
                </View>
                <View style={[styles.repliesCountBadge, { backgroundColor: theme.surfaceSubtle }]}>
                  <MessageCircle size={12} color={theme.textDim} />
                  <Text style={[styles.repliesCountText, { color: theme.textMuted }]}>
                    {disc.repliesCount || 0}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Expanded Discussion Body & Replies */}
              {isSelected && (
                <View style={[styles.discBody, { borderTopColor: theme.cardBorder }]}>
                  <Text style={[styles.discContent, { color: theme.text }]}>{disc.content}</Text>

                  {/* Replies List */}
                  {disc.replies && disc.replies.length > 0 && (
                    <View style={styles.repliesSection}>
                      <Text style={[styles.repliesHeading, { color: theme.textDim }]}>Replies ({disc.replies.length})</Text>
                      {disc.replies.map(reply => (
                        <View key={reply.id} style={[styles.replyCard, { backgroundColor: theme.surfaceSubtle }]}>
                          <View style={styles.replyTop}>
                            <Image source={{ uri: reply.authorAvatar }} style={styles.replyAvatar} />
                            <Text style={[styles.replyAuthor, { color: theme.text }]}>{reply.author}</Text>
                          </View>
                          <Text style={[styles.replyText, { color: theme.textMuted }]}>{reply.content}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Reply Input Bar */}
                  <View style={[styles.replyInputRow, { backgroundColor: theme.surfaceSubtle }]}>
                    <TextInput
                      style={[styles.replyInput, { color: theme.text }]}
                      placeholder="Write a reply..."
                      placeholderTextColor={theme.textDim}
                      value={replyText}
                      onChangeText={setReplyText}
                    />
                    <TouchableOpacity
                      style={[styles.replySendBtn, { backgroundColor: theme.primary }]}
                      onPress={handleSendReply}
                      disabled={!replyText.trim()}
                    >
                      <Send size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginHorizontal: 10,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  forumTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  forumDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    marginBottom: 10,
  },
  textArea: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  postBtn: {
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  discCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  discHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  discInfo: {
    flex: 1,
  },
  discTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  discTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  authorName: {
    fontSize: 12,
    marginTop: 2,
  },
  repliesCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  repliesCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  discBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  discContent: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 14,
  },
  repliesSection: {
    gap: 8,
    marginBottom: 12,
  },
  repliesHeading: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  replyCard: {
    padding: 10,
    borderRadius: 10,
  },
  replyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  replyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  replyAuthor: {
    fontSize: 12,
    fontWeight: '700',
  },
  replyText: {
    fontSize: 13,
    lineHeight: 18,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  replyInput: {
    flex: 1,
    height: 40,
    fontSize: 13,
  },
  replySendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
