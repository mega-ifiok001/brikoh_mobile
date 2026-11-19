// Slim banner at the top of the app when the phone has no internet, with a Retry button.
// Shows a brief "Back online" confirmation when the connection returns.
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import NetInfo, { useNetInfo } from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T } from "./ui";
import { C } from "../theme";

export default function OfflineBanner() {
  const net = useNetInfo();
  const insets = useSafeAreaInsets();
  const offline = net.isConnected === false || net.isInternetReachable === false;
  const wasOffline = useRef(false);
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
      setBackOnline(false);
      return undefined;
    }
    if (wasOffline.current && net.isConnected) {
      wasOffline.current = false;
      setBackOnline(true);
      const t = setTimeout(() => setBackOnline(false), 2500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [offline, net.isConnected]);

  if (!offline && !backOnline) return null;

  const bg = offline ? C.gold100 : C.leaf100;
  const fg = offline ? C.gold600 : C.leaf500;

  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: bg, paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}
    >
      <Ionicons name={offline ? "cloud-offline-outline" : "checkmark-circle-outline"} size={17} color={fg} />
      <T w="bold" size={12.5} color={fg} style={{ flex: 1 }}>
        {offline ? "You're offline. Some things won't load or save." : "Back online"}
      </T>
      {offline && (
        <Pressable onPress={() => NetInfo.refresh()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retry connection">
          <T w="extra" size={12.5} color={fg}>
            Retry
          </T>
        </Pressable>
      )}
    </View>
  );
}