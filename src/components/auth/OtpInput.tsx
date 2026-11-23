import { useRef, useState, type ComponentRef } from "react";
import { Pressable, TextInput, View } from "react-native";
import { T } from "../ui";
import { C } from "../../theme";

// Six (or `length`) separate boxes backed by ONE invisible TextInput, so
// typing, deleting, paste and iOS/Android one-time-code autofill all work.
export default function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  autoFocus = false,
  disabled = false,
  hasError = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void; // fires once when the last digit is entered
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
  hasError?: boolean;
}) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const handleChange = (raw: string) => {
    const v = raw.replace(/\D/g, "").slice(0, length);
    onChange(v);
    if (v.length === length) onComplete?.(v);
  };

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={`${length}-digit code`}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {Array.from({ length }).map((_, i) => {
          const active = focused && !disabled && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={{
                flex: 1,
                height: 58,
                borderRadius: 14,
                backgroundColor: "#161d19",
                borderWidth: 1.5,
                borderColor: hasError ? "#f08a7e" : active ? C.brand : "#26302a",
                alignItems: "center",
                justifyContent: "center",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <T w="display" size={24} color={C.cream50}>
                {value[i] ?? ""}
              </T>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        maxLength={length}
        autoCorrect={false}
        caretHidden
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        underlineColorAndroid="transparent"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
      />
    </Pressable>
  );
}