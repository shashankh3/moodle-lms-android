import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MobileAPI } from '../../services/apiAdapter';
import { ArrowLeft, Send, MessageSquare, Check, CheckCheck } from 'lucide-react-native';

export default function MessagesScreen({ navigation }) {
  const { theme } = useTheme();
  const { currentUser } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    MobileAPI.getConversations().then(convs => {
      setConversations(convs);
      if (convs.length > 0) setActiveConv(convs[0]);
    });
  }, []);

  const handleSend = async () => {
    if (!inputText.trim() || !activeConv) return;
    const text = inputText.trim();
    setInputText('');

    const updated = await MobileAPI.sendMessage(activeConv.id, text, currentUser);
    if (updated) {
      setActiveConv(updated);
      setConversations(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Top Bar */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={theme.text} />
        </TouchableOpacity>
        {activeConv ? (
          <View style={styles.topBarUser}>
            <Image source={{ uri: activeConv.avatar }} style={styles.topAvatar} />
            <View>
              <Text style={[styles.topUserName, { color: theme.text }]}>{activeConv.userName}</Text>
              <Text style={[styles.topUserRole, { color: theme.primary }]}>{activeConv.userRole}</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.topBarTitle, { color: theme.text }]}>Messages</Text>
        )}
      </View>

      {/* Conversations Horizontal Selector */}
      <View style={[styles.convSelectorWrap, { borderBottomColor: theme.cardBorder }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.convScroll}>
          {conversations.map(conv => {
            const isSelected = activeConv?.id === conv.id;
            return (
              <TouchableOpacity
                key={conv.id}
                style={[
                  styles.convPill,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.card,
                    borderColor: isSelected ? theme.primary : theme.cardBorder,
                  },
                ]}
                onPress={() => setActiveConv(conv)}
              >
                <Image source={{ uri: conv.avatar }} style={styles.pillAvatar} />
                <Text style={[styles.pillText, { color: isSelected ? '#FFFFFF' : theme.text }]}>
                  {conv.userName.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Chat Messages Body */}
      <ScrollView contentContainerStyle={styles.messagesList} showsVerticalScrollIndicator={false}>
        {activeConv?.messages.map((msg, index) => {
          const isMe = msg.isMe || msg.senderId === currentUser.id;
          return (
            <View
              key={msg.id || index}
              style={[
                styles.bubbleWrapper,
                isMe ? styles.myBubbleWrapper : styles.theirBubbleWrapper,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isMe
                    ? [styles.myBubble, { backgroundColor: theme.primary }]
                    : [styles.theirBubble, { backgroundColor: theme.card, borderColor: theme.cardBorder }],
                ]}
              >
                <Text style={[styles.msgText, { color: isMe ? '#FFFFFF' : theme.text }]}>
                  {msg.text}
                </Text>
                <Text
                  style={[
                    styles.msgTime,
                    { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textDim },
                  ]}
                >
                  {msg.timestamp}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Input Row */}
      <View style={[styles.inputBar, { backgroundColor: theme.card, borderTopColor: theme.cardBorder }]}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surfaceSubtle, borderColor: theme.cardBorder, color: theme.text },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textDim}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: theme.primary }]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  topBarUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  topUserName: {
    fontSize: 15,
    fontWeight: '700',
  },
  topUserRole: {
    fontSize: 11,
    fontWeight: '600',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  convSelectorWrap: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  convScroll: {
    gap: 10,
  },
  convPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  pillAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  bubbleWrapper: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myBubbleWrapper: {
    alignSelf: 'flex-end',
  },
  theirBubbleWrapper: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 44,
    fontSize: 14,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
