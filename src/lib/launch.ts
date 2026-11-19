// Remembers that the app has been opened before, so returning users get a short splash.
import { getJSON, setJSON } from "./localStore";

const KEY = "brikoh_has_launched";

export const hasLaunchedBefore = () => getJSON<boolean>(KEY, false);
export const markLaunched = () => setJSON(KEY, true);