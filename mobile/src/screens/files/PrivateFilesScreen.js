import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { MobileAPI } from '../../services/apiAdapter';
import * as WebBrowser from 'expo-web-browser';
import {
  ArrowLeft,
  Menu,
  FileText,
  Folder,
  Upload,
  Plus,
  Trash2,
  Download,
  Share2,
  HardDrive,
  Check,
  X,
  RefreshCw,
  Layers,
} from 'lucide-react-native';

export default function PrivateFilesScreen({ navigation }) {
  const { t } = useTranslation();
  const { theme, openDrawer } = useTheme();
  const { currentUser } = useAuth();

  const [files, setFiles] = useState([]);
  const [quotaInfo, setQuotaInfo] = useState({ filecount: 0, formattedSize: '0 MB' });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileNotes, setNewFileNotes] = useState('');

  const fetchFiles = useCallback(async () => {
    try {
      const [realFiles, quota] = await Promise.all([
        MobileAPI.getPrivateFiles(currentUser),
        MobileAPI.getPrivateFilesQuota(currentUser),
      ]);
      setFiles(realFiles || []);
      if (quota) setQuotaInfo(quota);
    } catch (e) {
      console.warn('Error fetching private files:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      fetchFiles();
    }, [fetchFiles])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchFiles();
  };

  const handleAddFile = async () => {
    if (!newFileName.trim()) {
      Alert.alert('Required', 'Please enter a name for your file/note.');
      return;
    }
    const newEntry = {
      id: Date.now().toString(),
      name: newFileName.trim().endsWith('.txt') ? newFileName.trim() : `${newFileName.trim()}.txt`,
      size: `${Math.max(1, Math.round(newFileNotes.length / 100))} KB`,
      updated: 'Just now',
      content: newFileNotes,
      type: 'txt',
    };
    setLoading(true);
    const updated = await MobileAPI.addPrivateFile(currentUser, newEntry);
    setFiles(updated);
    const quota = await MobileAPI.getPrivateFilesQuota(currentUser);
    if (quota) setQuotaInfo(quota);
    setLoading(false);
    setNewFileName('');
    setNewFileNotes('');
    setAddModalVisible(false);
    Alert.alert('Success', 'File synced to your private Moodle storage.');
  };

  const handleDeleteFile = (id, name) => {
    if (id.startsWith('moodle_server_')) {
      Alert.alert(
        'Server File',
        'Moodle does not allow apps to delete server files. Please log in to the Moodle website to delete this file.'
      );
      return;
    }
    
    Alert.alert('Delete File', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          const updated = await MobileAPI.deletePrivateFile(currentUser, id);
          setFiles(updated);
          const quota = await MobileAPI.getPrivateFilesQuota(currentUser);
          if (quota) setQuotaInfo(quota);
          setLoading(false);
        },
      },
    ]);
  };

  const handleOpenFile = async (file) => {
    if (file.url) {
      const isVideo = file.mimetype?.startsWith('video/') || file.name?.toLowerCase().endsWith('.mp4');
      const isPdf = file.mimetype === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      const isAudio = file.mimetype?.startsWith('audio/') || file.name?.toLowerCase().endsWith('.mp3');
      const isImage = file.mimetype?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name);

      navigation.navigate('CourseContentViewer', {
        module: {
          name: file.name,
          fileUrl: file.url,
          mimetype: file.mimetype || (isImage ? 'image/png' : isPdf ? 'application/pdf' : 'application/octet-stream'),
          isPdf,
          type: isVideo ? 'video' : isAudio ? 'audio' : isPdf ? 'pdf' : isImage ? 'image' : 'resource',
          files: [{ fileurl: file.url, mimetype: file.mimetype || (isImage ? 'image/png' : 'application/octet-stream') }],
        },
        courseName: 'Private Files',
      });
    } else if (file.content) {
      navigation.navigate('CourseContentViewer', {
        module: {
          name: file.name,
          contentHtml: `<div style="padding: 16px;"><pre style="white-space: pre-wrap; font-family: inherit; font-size: 15px;">${file.content}</pre></div>`,
          type: 'page',
        },
        courseName: 'Private Notes',
      });
    } else {
      Alert.alert(file.name, `Private file: ${file.size || 'Saved'} • ${file.updated || 'Recent'}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.topBar, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('DashboardTab')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>{t('private_files_title')}</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onRefresh}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <RefreshCw size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={openDrawer}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Menu size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#00AEEF']} />
        }
      >
        {/* Storage Quota Card */}
        <View style={[styles.quotaCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.quotaHeader}>
            <View style={styles.quotaTitleRow}>
              <HardDrive size={18} color="#00AEEF" />
              <Text style={[styles.quotaTitle, { color: theme.text }]}>{t('private_storage_quota')}</Text>
            </View>
            <Text style={styles.quotaPercent}>
              {quotaInfo.formattedSize || '0 MB'} • {files.length} {t('items', 'files')}
            </Text>
          </View>
          <Text style={[styles.quotaSub, { color: theme.textDim }]}>
            {t('private_storage_desc')}
          </Text>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.85}
          >
            <Plus size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.uploadBtnText}>{t('add_document_note')}</Text>
          </TouchableOpacity>
        </View>

        {/* Files List */}
        <Text style={[styles.sectionHeading, { color: theme.text }]}>
          {t('my_documents')} ({files.length})
        </Text>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#00AEEF" />
            <Text style={[styles.loadingText, { color: theme.textDim }]}>
              {t('loading_catalog')}
            </Text>
          </View>
        ) : files.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Folder size={40} color="#94A3B8" />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>{t('no_private_files_title')}</Text>
            <Text style={[styles.emptySub, { color: theme.textDim }]}>
              {t('no_private_files_sub')}
            </Text>
          </View>
        ) : (
          files.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.fileCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
              onPress={() => handleOpenFile(f)}
              activeOpacity={0.8}
            >
              <View style={styles.fileIconWrapper}>
                <FileText size={22} color="#004F7A" />
              </View>

              <View style={styles.fileDetails}>
                <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={[styles.fileMeta, { color: theme.textDim }]}>
                  {f.size} • Updated {f.updated}
                </Text>
              </View>

              <View style={styles.fileActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleOpenFile(f)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Download size={16} color="#00AEEF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => handleDeleteFile(f.id, f.name)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add File / Note Modal */}
      <Modal
        visible={addModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Private Note / File</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <X size={20} color={theme.textDim} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, { color: theme.text }]}>Document Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.cardBorder }]}
              placeholder="e.g. Lesson_Plan_Notes"
              placeholderTextColor="#94A3B8"
              value={newFileName}
              onChangeText={setNewFileName}
            />

            <Text style={[styles.modalLabel, { color: theme.text }]}>Content / Notes</Text>
            <TextInput
              style={[styles.modalTextArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.cardBorder }]}
              placeholder="Type your notes or document description here..."
              placeholderTextColor="#94A3B8"
              value={newFileNotes}
              onChangeText={setNewFileNotes}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleAddFile}
              >
                <Text style={styles.saveModalBtnText}>Save File</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  topBarTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  quotaCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  quotaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  quotaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quotaTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  quotaPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00AEEF',
  },
  quotaSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionRow: {
    marginBottom: 16,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#004F7A',
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  centerLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
  },
  emptyCard: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  fileIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 79, 122, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
    marginRight: 8,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  fileMeta: {
    fontSize: 11,
  },
  fileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  modalInput: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 14,
    fontSize: 14,
  },
  modalTextArea: {
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelModalBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  saveModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#004F7A',
  },
  saveModalBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
