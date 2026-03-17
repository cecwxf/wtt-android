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
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useMessagesStore } from '@/stores/messages';
import { formatTime } from '@/lib/time';
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

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (token && topicId) {
      fetchMessages(token, topicId);
    }
  }, [token, topicId, fetchMessages]);

  // Auto-refresh messages every 10s
  useEffect(() => {
    if (!token || !topicId) return;
    const interval = setInterval(() => fetchMessages(token, topicId), 10000);
    return () => clearInterval(interval);
  }, [token, topicId, fetchMessages]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !token || !topicId || !agentId || sending) return;
    const content = text.trim();
    setText('');
    setImageUri(null);
    setSending(true);
    try {
      await sendMessage(token, topicId, content, agentId);
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

  const headerTitle = useMemo(() => {
    if (topicName) return topicName;
    if (topicId && topicId.length > 20) return `${topicId.slice(0, 8)}...`;
    return topicId ?? 'Chat';
  }, [topicId, topicName]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender_type === 'human';
    const useMd = hasMarkdown(item.content);

    return (
      <View className={`px-4 py-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <Text className="text-xs text-indigo-500 font-inter mb-1 ml-1">
            {item.sender_id}
          </Text>
        )}
        <View
          className={`max-w-[85%] rounded-2xl px-3 py-2 ${
            isUser
              ? 'bg-indigo-50 rounded-tr-lg'
              : 'bg-white rounded-tl-lg border border-gray-100'
          }`}
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
            >
              {item.content}
            </Text>
          )}
          <Text
            className={`text-[11px] font-inter mt-1 ${
              isUser ? 'text-right text-gray-400' : 'text-gray-400'
            }`}
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
        keyboardVerticalOffset={90}
      >
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
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
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20">
                <Ionicons name="chatbubble-ellipses-outline" size={40} color="#D1D5DB" />
                <Text className="mt-3 text-gray-400 text-sm font-inter">No messages yet</Text>
              </View>
            }
          />
        )}

        {/* Image preview */}
        {imageUri && (
          <View className="px-4 pb-1">
            <View className="relative">
              <Image source={{ uri: imageUri }} className="w-20 h-20 rounded-lg" />
              <TouchableOpacity
                className="absolute -top-1 -right-1 bg-gray-800 rounded-full w-5 h-5 items-center justify-center"
                onPress={() => setImageUri(null)}
              >
                <Ionicons name="close" size={12} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Input Bar */}
        <View className="flex-row items-end px-3 py-2 bg-white border-t border-gray-100">
          <TouchableOpacity className="p-2" onPress={handlePickImage}>
            <Ionicons name="image-outline" size={24} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity className="p-2">
            <Ionicons name="mic-outline" size={24} color="#64748B" />
          </TouchableOpacity>
          <TextInput
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 mx-1 text-base font-inter text-gray-900 max-h-28"
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
