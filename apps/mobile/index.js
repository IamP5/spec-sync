// The order is load-bearing: the secure random source must be installed
// before CopilotKit's polyfills, and both before any app code (whichever
// crypto polyfill loads first wins). See apps/mobile/docs/adr/0003-chat-runtime.md.
import 'react-native-get-random-values';
import '@copilotkit/react-native/polyfills';
import 'expo-router/entry';
