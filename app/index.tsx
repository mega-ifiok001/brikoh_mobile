import { Redirect } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

// Entry route ("/"). Always reachable, so it sends you to the right place:
// sign in, finish setup, or the Home tab.
export default function Index() {
  const { isAuthed, isOnboarded } = useAuth();
  return <Redirect href={!isAuthed ? "/login" : isOnboarded ? "/home" : "/setup"} />;
}
