import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

/* Inter backs up SF Pro (system-ui on this Mac); JetBrains Mono is the app's mono. */
loadInter("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "latin-ext"] });
loadMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });
