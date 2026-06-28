import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  buildContentWithAttachments,
  MobileChatSurface,
} from '@wtt/mobile-chat-kit';
import {
  MOBILE_ATTACHMENT_DOCUMENT_TYPES,
  mobileCameraPickerOptions,
  mobileImagePickerOptions,
} from '@wtt/mobile-chat-kit/attachment-options';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useMessagesStore } from '@/stores/messages';
import { useWebSocketStore } from '@/stores/websocket';
import { useAppSettingsStore } from '@/stores/app-settings';
import { formatTime } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import {
  uploadMobileAsset,
  type LocalUploadAsset,
  type PendingUploadAsset,
} from '@/lib/mobile-attachments';

export default function ChatScreen() {
  const { id: topicId, name: topicName } = useLocalSearchParams<{ id: string; name?: string }>();
  const token = useAuthStore((s) => s.token);
  const agentId = useAgentsStore((s) => s.selectedAgentId);
  const messages = useMessagesStore((s) => s.messagesByTopic[topicId ?? ''] || []);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);
  const sendMessage = useMessagesStore((s) => s.sendMessage);
  const isLoading = useMessagesStore((s) => s.isLoading);
  const wsState = useWebSocketStore((s) => s.wsState);
  const fallbackPollSeconds = useAppSettingsStore((s) => s.fallbackPollSeconds);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pendingAssets, setPendingAssets] = useState<PendingUploadAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (token && topicId) {
      fetchMessages(token, topicId);
    }
  }, [token, topicId, fetchMessages]);

  // WS-first: only poll when WS is disconnected (fallback mode)
  useEffect(() => {
    if (!token || !topicId) return;
    if (wsState === 'connected') return;
    const interval = setInterval(() => fetchMessages(token, topicId), fallbackPollSeconds * 1000);
    return () => clearInterval(interval);
  }, [token, topicId, fetchMessages, wsState, fallbackPollSeconds]);

  const handleSend = useCallback(async () => {
    if ((!text.trim() && pendingAssets.length === 0) || !token || !topicId || !agentId || sending || uploading) {
      return;
    }
    const content = buildContentWithAttachments(text, pendingAssets);
    setText('');
    setImageUri(null);
    setPendingAssets([]);
    setSending(true);
    try {
      await sendMessage(token, topicId, content, agentId);
      haptic.light();
    } catch {
      /* ignore */
    }
    setSending(false);
  }, [agentId, pendingAssets, sendMessage, sending, text, token, topicId, uploading]);

  const uploadAttachment = useCallback(
    async (asset: LocalUploadAsset) => {
      if (!token || uploading) return;
      setUploading(true);
      setUploadProgress(0);
      setUploadError('');
      try {
        const uploaded = await uploadMobileAsset(asset, token, setUploadProgress);
        setPendingAssets((prev) => [...prev, uploaded]);
        haptic.light();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(message);
        Alert.alert('Upload failed', message);
      } finally {
        setUploading(false);
        setUploadProgress(null);
      }
    },
    [token, uploading],
  );

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(mobileImagePickerOptions());
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
        await uploadAttachment({
          uri: asset.uri,
          name: asset.fileName || undefined,
          mimeType: asset.mimeType || undefined,
          size: asset.fileSize || undefined,
        });
      setImageUri(null);
    }
  }, [uploadAttachment]);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(mobileCameraPickerOptions());
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
        await uploadAttachment({
          uri: asset.uri,
          name: asset.fileName || `photo-${Date.now()}.jpg`,
          mimeType: asset.mimeType || 'image/jpeg',
          size: asset.fileSize || undefined,
        });
      setImageUri(null);
    }
  }, [uploadAttachment]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [...MOBILE_ATTACHMENT_DOCUMENT_TYPES],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadAttachment({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
    });
  }, [uploadAttachment]);

  const openAttachmentMenu = useCallback(() => {
    if (uploading) return;
    Alert.alert(
      'Attach',
      'Choose what to add',
      [
        { text: 'Photo Library', onPress: () => void handlePickImage() },
        { text: 'Camera', onPress: () => void handleTakePhoto() },
        { text: 'File', onPress: () => void handlePickFile() },
      ],
      { cancelable: true },
    );
  }, [handlePickFile, handlePickImage, handleTakePhoto, uploading]);

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'Please grant microphone access to record voice messages.',
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      haptic.medium();
      setRecording(rec);
      setRecordingDuration(0);
      recordingTimer.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }, [pulseAnim]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      if (uri) {
        setAudioUri(uri);
        // Send as text note with duration info (media upload can be added later)
        const mins = Math.floor(recordingDuration / 60);
        const secs = recordingDuration % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        Alert.alert(
          'Voice Recorded',
          `Duration: ${durationStr}\n\nVoice messages will be sent as audio attachments once media upload is enabled. For now, you can describe the content in text.`,
          [{ text: 'Discard', style: 'cancel', onPress: () => setAudioUri(null) }, { text: 'OK' }],
        );
      }
    } catch (err) {
      console.error('Failed to stop recording', err);
      setRecording(null);
    }
  }, [recording, recordingDuration, pulseAnim]);

  const cancelRecording = useCallback(async () => {
    if (!recording) return;
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      /* ignore */
    }
    setRecording(null);
    setRecordingDuration(0);
    setAudioUri(null);
  }, [recording, pulseAnim]);

  const headerTitle = useMemo(() => {
    if (topicName) return topicName;
    if (topicId && topicId.length > 20) return `${topicId.slice(0, 8)}...`;
    return topicId ?? 'Chat';
  }, [topicId, topicName]);

  return (
    <>
      <Stack.Screen options={{ title: headerTitle, headerShown: true }} />
      <MobileChatSurface
        messages={messages.map((item) => ({
          id: item.message_id,
          senderId: item.sender_id,
          senderType: item.sender_type,
          content: item.content,
          timestamp: item.timestamp,
        }))}
        input={text}
        onInputChange={setText}
        onSend={handleSend}
        onAttachPress={openAttachmentMenu}
        onRemoveAttachment={(index) => setPendingAssets((prev) => prev.filter((_, i) => i !== index))}
        loading={isLoading}
        sending={sending}
        uploading={uploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        pendingAttachments={pendingAssets}
        emptyTitle="No messages yet"
        emptyText="Start the conversation from here."
        placeholder="Type a message..."
        theme={{ accent: '#6366F1', accentSoft: '#EEF2FF', accentBorder: '#C7D2FE' }}
        formatTime={formatTime}
        composerTopContent={
          <>
            {recording && (
              <View
                className="bg-red-500/95 py-4 px-6 flex-row items-center justify-between"
                style={cs.recordingBar}
              >
                <View className="flex-row items-center" style={cs.recordingLeft}>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <View className="w-3 h-3 rounded-full bg-white" style={cs.recordDot} />
                  </Animated.View>
                  <Text className="text-white font-bold ml-3 text-base" style={cs.recordTime}>
                    {Math.floor(recordingDuration / 60)}:
                    {String(recordingDuration % 60).padStart(2, '0')}
                  </Text>
                </View>
                <View className="flex-row" style={cs.recordActions}>
                  <TouchableOpacity
                    className="bg-white/30 rounded-full px-4 py-2 mr-3"
                    style={cs.recordCancel}
                    onPress={cancelRecording}
                  >
                    <Text className="text-white font-semibold" style={cs.recordCancelText}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="bg-white rounded-full px-4 py-2"
                    style={cs.recordStop}
                    onPress={stopRecording}
                  >
                    <Text className="text-red-500 font-bold" style={cs.recordStopText}>
                      Stop
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {audioUri && !recording && (
              <View className="px-4 pb-1" style={cs.previewWrap}>
                <View
                  className="flex-row items-center bg-indigo-50 rounded-lg px-3 py-2"
                  style={cs.audioPreview}
                >
                  <Ionicons name="musical-note" size={18} color="#6366F1" />
                  <Text
                    className="flex-1 text-sm text-indigo-700 ml-2 font-inter"
                    style={cs.audioLabel}
                  >
                    Voice recording ({recordingDuration}s)
                  </Text>
                  <TouchableOpacity onPress={() => setAudioUri(null)}>
                    <Ionicons name="close-circle" size={20} color="#6366F1" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {imageUri && (
              <View className="px-4 pb-1" style={cs.previewWrap}>
                <View style={{ position: 'relative' }}>
                  <Image
                    source={{ uri: imageUri }}
                    className="w-20 h-20 rounded-lg"
                    style={cs.imgPreview}
                  />
                  <TouchableOpacity
                    className="absolute -top-1 -right-1 bg-gray-800 rounded-full w-5 h-5 items-center justify-center"
                    style={cs.imgClose}
                    onPress={() => setImageUri(null)}
                  >
                    <Ionicons name="close" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        }
        composerExtraLeftActions={
          <TouchableOpacity
            className={`p-2 ${recording ? 'opacity-50' : ''}`}
            style={cs.iconBtn}
            onPress={recording ? stopRecording : startRecording}
          >
            <Ionicons
              name={recording ? 'stop-circle' : 'mic-outline'}
              size={24}
              color={recording ? '#EF4444' : '#64748B'}
            />
          </TouchableOpacity>
        }
      />
    </>
  );
}

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  msgRowUser: { justifyContent: 'flex-start' },
  msgRowAgent: { alignItems: 'flex-start' },
  agentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginTop: 18,
  },
  agentAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  senderLabel: { fontSize: 12, color: '#6366F1', marginBottom: 2, marginLeft: 2 },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleUser: { backgroundColor: '#EEF2FF', borderTopLeftRadius: 8 },
  bubbleAgent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  msgText: { fontSize: 15, lineHeight: 22, color: '#1F2937' },
  messageAttachmentList: { gap: 8, marginTop: 8 },
  messageAttachmentCard: {
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    padding: 8,
  },
  messageAttachmentImage: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#E2E8F0' },
  messageAttachmentIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageAttachmentCopy: { flex: 1, minWidth: 0 },
  messageAttachmentLabel: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  messageAttachmentKind: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timestamp: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  timestampRight: { textAlign: 'left' },
  scrollFab: {
    position: 'absolute',
    right: 16,
    bottom: 80,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 3,
  },
  recordingBar: {
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(239,68,68,0.95)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingLeft: { flexDirection: 'row', alignItems: 'center' },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  recordTime: { color: '#fff', fontWeight: 'bold', marginLeft: 12, fontSize: 16 },
  recordActions: { flexDirection: 'row' },
  recordCancel: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  recordCancelText: { color: '#fff', fontWeight: '600' },
  recordStop: {
    backgroundColor: '#fff',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  recordStopText: { color: '#EF4444', fontWeight: 'bold' },
  previewWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  audioPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  audioLabel: { flex: 1, fontSize: 14, color: '#4338CA', marginLeft: 8 },
  imgPreview: { width: 80, height: 80, borderRadius: 8 },
  imgClose: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachments: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  assetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  assetName: { flex: 1, color: '#111827', fontSize: 13, fontWeight: '700' },
  assetKind: {
    color: '#6366F1',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  uploadText: { color: '#4338CA', fontSize: 12, fontWeight: '700' },
  uploadError: { color: '#B91C1C', fontSize: 12, fontWeight: '700' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  iconBtn: { padding: 8 },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    fontSize: 16,
    color: '#111827',
    maxHeight: 112,
  },
  sendBtn: { padding: 8, borderRadius: 9999 },
  sendActive: { backgroundColor: '#6366F1' },
  sendInactive: { backgroundColor: '#E5E7EB' },
  dateSep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  dateSepLine: { flex: 1, height: 0.5, backgroundColor: '#E5E7EB' },
  dateSepText: { fontSize: 12, color: '#9CA3AF', paddingHorizontal: 10, fontWeight: '500' },
});
