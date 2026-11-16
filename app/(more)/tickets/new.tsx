import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { createTicket, type TicketPriority } from "../../../src/lib/tickets";
import { apiErrorMessage, titleCase } from "../../../src/lib/format";
import { Button, Field, Input, toast } from "../../../src/components/ui";
import { Page, SelectField } from "../../../src/components/kit";
import { PRIORITIES } from "../../../src/components/tickets/shared";

export default function NewTicket() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!subject.trim()) return toast.error("Give the ticket a subject.");
    if (!message.trim()) return toast.error("Add a message so support knows what's going on.");
    setBusy(true);
    try {
      const t = await createTicket({ subject: subject.trim(), priority, message: message.trim() });
      toast.success("Ticket created.");
      router.replace(`/tickets/${t.id}`);
    } catch (e: any) {
      toast.error(apiErrorMessage(e, "Couldn't create the ticket."));
      setBusy(false);
    }
  };

  return (
    <Page title="New ticket">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }} keyboardShouldPersistTaps="handled">
          <Field label="Subject">
            <Input value={subject} onChangeText={setSubject} placeholder="What's going on?" editable={!busy} />
          </Field>
          <SelectField
            label="Priority"
            value={priority}
            onChange={(v) => setPriority(v as TicketPriority)}
            options={PRIORITIES.filter((p) => p !== "ALL").map((p) => ({ value: p, label: titleCase(p) }))}
          />
          <Field label="Message" hint="We'll reply here and keep you posted.">
            <Input
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the issue in as much detail as you can..."
              multiline
              textAlignVertical="top"
              editable={!busy}
              style={{ height: 150, alignItems: "flex-start", paddingTop: 12 }}
            />
          </Field>
          <View>
            <Button label="Create ticket" icon="send" onPress={submit} busy={busy} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Page>
  );
}
