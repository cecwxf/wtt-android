import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth';
import { useAgentsStore } from '@/stores/agents';
import { useMessagesStore } from '@/stores/messages';
import { formatTime } from '@/lib/time';
import type { Message } from '@/lib/api/wtt-client';

export default function ChatScreen() {
  const { id: topicId } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((s) => s.token);
  const agentId = useAgentsStore((s) => s.selectedAgentId);
  const messages = useMessagesStore((s) => s.messagesByTopic[topicId ?? ''] || []);
  const fetchMessages = useMessagesStore((s) => s.fetchMessages);
  const sendMessage = useMessagesStore((s) => s.sendMessage);
  const isLoading = useMessagesStore((s) => s.isLoading);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (token && topicId) {
      fetchMessages(token, topicId);
    }
  }, [token, topicId, fetchMessages]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !token || !topicId || !agentId || sending) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage(token, topicId, content, agentId);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { /* ignore */ }
    setSending(false);
  }, [text, token, topicId, agentId, sending, sendMessage]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender_type === 'human';
    return (
      <View className={`px-4 py-1 ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && (
          <Text className="text-xs text-primary font-inter mb-1 ml-1">
            {item.sender_id}
          </Text>
        )}
        <View
          className={`max-w-[82%] rounded-2xl px-3 py-2 ${
            isUser
              ? 'bg-primary-50 dark:bg-primary-900 rounded-tr-lg'
              : 'bg-white dark:bg-zinc-800 rounded-tl-lg border border-gray-100 dark:border-zinc-700'
          }`}
        >
          <Text
            className={`text-[15px] font-inter leading-5 ${
              isUser
                ? 'text-gray-900 dark:text-gray-100'
                : 'text-gray-800 dark:text-gray-200'
            }`}
          >
            {item.content}
          </Text>
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
      <Stack.Screen options={{ title: topicId ?? 'Chat', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 bg-background-light dark:bg-background-dark"
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
          />
        )}

        {/* Input Bar */}
        <View className="flex-row items-end px-3 py-2 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800">
          <TouchableOpacity className="p-2">
            <Ionicons name="mic-outline" size={24} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity className="p-2">
            <Ionicons name="attach-outline" size={24} color="#64748B" />
          </TouchableOpacity>
          <TextInput
            className="flex-1 bg-gray-100 dark:bg-zinc-800 rounded-2xl px-4 py-2 mx-1 text-base font-inter text-gray-900 dark:text-gray-100 max-h-28"
            placeholder="Type a message..."
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
            multiline
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            className={`p-2 rounded-full ${text.trim() ? 'bg-primary' : 'bg-gray-200 dark:bg-zinc-700'}`}
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
