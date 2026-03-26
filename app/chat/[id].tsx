import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Animated,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useMessagesStore } from '@/stores/messages';
import { useWebSocketStore } from '@/stores/websocket';
import { useAppSettingsStore } from '@/stores/app-settings';
import { formatTime } from '@/lib/time';
import { haptic } from '@/lib/haptics';
import type { Message } from '@/lib/api/wtt-client';

const hasMarkdown = (text: string) =>
  /[*_`#\[\]!\->|]/.test(text) && (
    /\*\*.+\*\*/.test(text) ||
    /`.+`/.test(text) ||
    /^#{1,6}\s/m.test(text) ||
    /^\s*[-*]\s/m.test(text) ||
    /^\s*\d+\.\s/m.test(text) ||
    /```/.test(text) ||
    /\[.+\]\(.+\)/.test(text)
  );

const userMdStyles = {
  body: { color: '#1F2937', fontSize: 15, lineHeight: 22, fontFamily: 'Inter' },
  code_inline: { backgroundColor: '#E0E7FF', color: '#4338CA', fontFamily: 'JetBrainsMono', fontSize: 13, paddingHorizontal: 4, borderRadius: 3 },
  code_block: { backgroundColor: '#E0E7FF', color: '#4338CA', fontFamily: 'JetBrainsMono', fontSize: 13, padding: 8, borderRadius: 6 },
  fence: { backgroundColor: '#E0E7FF', color: '#4338CA', fontFamily: 'JetBrainsMono', fontSize: 13, padding: 8, borderRadius: 6 },
  link: { color: '#4338CA' },
  heading1: { fontSize: 18, fontWeight: '700' as const, marginBottom: 4, color: '#1F2937' },
  heading2: { fontSize: 16, fontWeight: '600' as const, marginBottom: 3, color: '#1F2937' },
  heading3: { fontSize: 15, fontWeight: '600' as const, marginBottom: 2, color: '#1F2937' },
  bullet_list_icon: { color: '#6366F1' },
};

const agentMdStyles = {
  body: { color: '#1F2937', fontSize: 15, lineHeight: 22, fontFamily: 'Inter' },
  code_inline: { backgroundColor: '#F1F5F9', color: '#334155', fontFamily: 'JetBrainsMono', fontSize: 13, paddingHorizontal: 4, borderRadius: 3 },
  code_block: { backgroundColor: '#F1F5F9', color: '#334155', fontFamily: 'JetBrainsMono', fontSize: 13, padding: 8, borderRadius: 6 },
  fence: { backgroundColor: '#F1F5F9', color: '#334155', fontFamily: 'JetBrainsMono', fontSize: 13, padding: 8, borderRadius: 6 },
  link: { color: '#6366F1' },
  heading1: { fontSize: 18, fontWeight: '700' as const, marginBottom: 4, color: '#1E293B' },
  heading2: { fontSize: 16, fontWeight: '600' as const, marginBottom: 3, color: '#1E293B' },
  heading3: { fontSize: 15, fontWeight: '600' as const, marginBottom: 2, color: '#1E293B' },
  bullet_list_icon: { color: '#6366F1' },
};

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
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const flatListRef = useRef<FlatList>(null);
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
    if (!text.trim() || !token || !topicId || !agentId || sending) return;
    const content = text.trim();
    setText('');
    setImageUri(null);
    setSending(true);
    try {
      await sendMessage(token, topicId, content, agentId);
      haptic.light();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { /* ignore */ }
    setSending(false);
  }, [text, token, topicId, agentId, sending, sendMessage]);

  const handlePickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please grant microphone access to record voice messages.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
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
        ])
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
          [
            { text: 'Discard', style: 'cancel', onPress: () => setAudioUri(null) },
            { text: 'OK' },
          ]
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
    } catch { /* ignore */ }
    setRecording(null);
    setRecordingDuration(0);
    setAudioUri(null);
  }, [recording, pulseAnim]);

  const headerTitle = useMemo(() => {
    if (topicName) return topicName;
    if (topicId && topicId.length > 20) return `${topicId.slice(0, 8)}...`;
    return topicId ?? 'Chat';
  }, [topicId, topicName]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender_type === 'human';
    const useMd = hasMarkdown(item.content);

    return (
      <View
        className={`px-4 py-1 ${isUser ? 'items-end' : 'items-start'}`}
        style={[cs.msgRow, isUser ? cs.msgRowUser : cs.msgRowAgent]}
      >
        {!isUser && (
          <Text className="text-xs text-indigo-500 font-inter mb-1 ml-1" style={cs.senderLabel}>
            {item.sender_id}
          </Text>
        )}
        <View
          className={`max-w-[85%] rounded-2xl px-3 py-2 ${
            isUser
              ? 'bg-indigo-50 rounded-tr-lg'
              : 'bg-white rounded-tl-lg border border-gray-100'
          }`}
          style={[cs.bubble, isUser ? cs.bubbleUser : cs.bubbleAgent]}
        >
          {useMd ? (
            <Markdown style={isUser ? userMdStyles : agentMdStyles}>
              {item.content}
            </Markdown>
          ) : (
            <Text
              className={`text-[15px] font-inter leading-5 ${
                isUser ? 'text-gray-900' : 'text-gray-800'
              }`}
              style={cs.msgText}
            >
              {item.content}
            </Text>
          )}
          <Text
            className={`text-[11px] font-inter mt-1 ${
              isUser ? 'text-right text-gray-400' : 'text-gray-400'
            }`}
            style={[cs.timestamp, isUser && cs.timestampRight]}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: headerTitle, headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-gray-50"
        style={cs.root}
        keyboardVerticalOffset={90}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center" style={cs.loading}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.message_id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingVertical: 8 }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: false })
            }
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const distFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
              setShowScrollBtn(distFromBottom > 200);
            }}
            scrollEventThrottle={100}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20" style={cs.empty}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color="#D1D5DB" />
                <Text className="mt-3 text-gray-400 text-sm font-inter" style={cs.emptyText}>No messages yet</Text>
              </View>
            }
          />
        )}

        {/* Scroll to bottom FAB */}
        {showScrollBtn && !recording && (
          <TouchableOpacity
            className="absolute right-4 bottom-20 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center border border-gray-100"
            style={cs.scrollFab}
            onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-down" size={20} color="#6366F1" />
          </TouchableOpacity>
        )}

        {/* Recording overlay */}
        {recording && (
          <View className="absolute bottom-16 left-0 right-0 bg-red-500/95 py-4 px-6 flex-row items-center justify-between z-10" style={cs.recordingBar}>
            <View className="flex-row items-center" style={cs.recordingLeft}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View className="w-3 h-3 rounded-full bg-white" style={cs.recordDot} />
              </Animated.View>
              <Text className="text-white font-bold ml-3 text-base" style={cs.recordTime}>
                {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
              </Text>
            </View>
            <View className="flex-row" style={cs.recordActions}>
              <TouchableOpacity
                className="bg-white/30 rounded-full px-4 py-2 mr-3"
                style={cs.recordCancel}
                onPress={cancelRecording}
              >
                <Text className="text-white font-semibold" style={cs.recordCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-white rounded-full px-4 py-2"
                style={cs.recordStop}
                onPress={stopRecording}
              >
                <Text className="text-red-500 font-bold" style={cs.recordStopText}>Stop</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Audio preview */}
        {audioUri && !recording && (
          <View className="px-4 pb-1" style={cs.previewWrap}>
            <View className="flex-row items-center bg-indigo-50 rounded-lg px-3 py-2" style={cs.audioPreview}>
              <Ionicons name="musical-note" size={18} color="#6366F1" />
              <Text className="flex-1 text-sm text-indigo-700 ml-2 font-inter" style={cs.audioLabel}>
                Voice recording ({recordingDuration}s)
              </Text>
              <TouchableOpacity onPress={() => setAudioUri(null)}>
                <Ionicons name="close-circle" size={20} color="#6366F1" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Image preview */}
        {imageUri && (
          <View className="px-4 pb-1" style={cs.previewWrap}>
            <View style={{ position: 'relative' }}>
              <Image source={{ uri: imageUri }} className="w-20 h-20 rounded-lg" style={cs.imgPreview} />
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

        {/* Input Bar */}
        <View className="flex-row items-end px-3 py-2 bg-white border-t border-gray-100" style={cs.inputBar}>
          <TouchableOpacity className="p-2" style={cs.iconBtn} onPress={handlePickImage}>
            <Ionicons name="image-outline" size={24} color="#64748B" />
          </TouchableOpacity>
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
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 mx-1 text-base font-inter text-gray-900 max-h-28"
            style={cs.textInput}
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            className={`p-2 rounded-full ${text.trim() ? 'bg-indigo-500' : 'bg-gray-200'}`}
            style={[cs.sendBtn, text.trim() ? cs.sendActive : cs.sendInactive]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size={20} color="#FFFFFF" />
            ) : (
              <Ionicons
                name="send"
                size={20}
                color={text.trim() ? '#FFFFFF' : '#9CA3AF'}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { marginTop: 12, color: '#9CA3AF', fontSize: 14 },
  msgRow: { paddingHorizontal: 16, paddingVertical: 4 },
  msgRowUser: { alignItems: 'flex-end' },
  msgRowAgent: { alignItems: 'flex-start' },
  senderLabel: { fontSize: 12, color: '#6366F1', marginBottom: 4, marginLeft: 4 },
  bubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleUser: { backgroundColor: '#EEF2FF', borderTopRightRadius: 8 },
  bubbleAgent: { backgroundColor: '#fff', borderTopLeftRadius: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  msgText: { fontSize: 15, lineHeight: 22, color: '#1F2937' },
  timestamp: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  timestampRight: { textAlign: 'right' },
  scrollFab: { position: 'absolute', right: 16, bottom: 80, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F3F4F6', elevation: 3 },
  recordingBar: { position: 'absolute', bottom: 64, left: 0, right: 0, backgroundColor: 'rgba(239,68,68,0.95)', paddingVertical: 16, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recordingLeft: { flexDirection: 'row', alignItems: 'center' },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  recordTime: { color: '#fff', fontWeight: 'bold', marginLeft: 12, fontSize: 16 },
  recordActions: { flexDirection: 'row' },
  recordCancel: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, marginRight: 12 },
  recordCancelText: { color: '#fff', fontWeight: '600' },
  recordStop: { backgroundColor: '#fff', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8 },
  recordStopText: { color: '#EF4444', fontWeight: 'bold' },
  previewWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  audioPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  audioLabel: { flex: 1, fontSize: 14, color: '#4338CA', marginLeft: 8 },
  imgPreview: { width: 80, height: 80, borderRadius: 8 },
  imgClose: { position: 'absolute', top: -4, right: -4, backgroundColor: '#1F2937', borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  iconBtn: { padding: 8 },
  textInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4, fontSize: 16, color: '#111827', maxHeight: 112 },
  sendBtn: { padding: 8, borderRadius: 9999 },
  sendActive: { backgroundColor: '#6366F1' },
  sendInactive: { backgroundColor: '#E5E7EB' },
});
