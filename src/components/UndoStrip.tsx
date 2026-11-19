// "Removed · Undo" strip. useUndo() holds one pending undo for a few seconds; <UndoStrip> shows it.
// Rendered by the screen itself (not a global toast) so it also works inside bottom sheets.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { T } from "./ui";
import { C } from "../theme";

export interface UndoItem {
  label: string;
  undo: () => void;
}

export function useUndo(ms = 6000) {
  const [item, setItem] = useState<UndoItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setItem(null);
  }, []);

  const offer = useCallback(
    (label: string, undo: () => void) => {
      if (timer.current) clearTimeout(timer.current);
      setItem({ label, undo });
      timer.current = setTimeout(() => setItem(null), ms);
    },
    [ms]
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { item, offer, dismiss };
}

export function UndoStrip({ item, onDone, style }: { item: UndoItem | null; onDone: () => void; style?: StyleProp<ViewStyle> }) {
  if (!item) return null;
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: C.solid, borderRadius: 14, paddingLeft: 14, paddingRight: 4, paddingVertical: 4 },
        style,
      ]}
    >
      <T w="semi" size={13} color={C.onSolid} numberOfLines={1} style={{ flex: 1 }}>
        {item.label}
      </T>
      <Pressable
        onPress={() => {
          item.undo();
          onDone();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Undo"
        style={({ pressed }) => ({ paddingHorizontal: 14, height: 36, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
      >
        <T w="extra" size={13} color={C.brand}>
          Undo
        </T>
      </Pressable>
    </View>
  );
}