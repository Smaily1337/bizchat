import type { Appearance } from "@clerk/types";
import { dark } from "@clerk/themes";

/**
 * Shared Clerk appearance — sits inside our Dark Glass container.
 * OTP + Google/Apple are enabled in the Clerk Dashboard (not here).
 */
export const clerkAppearance: Appearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#2dd4bf",
    colorBackground: "transparent",
    colorInputBackground: "rgba(255,255,255,0.06)",
    colorInputText: "#f4f4f5",
    colorText: "#e4e4e7",
    colorTextSecondary: "#a1a1aa",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full mx-auto",
    card: "bg-transparent shadow-none border-0",
    headerTitle: "text-zinc-50",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButton:
      "bg-white/5 border border-white/10 hover:bg-white/10 text-zinc-100",
    formFieldInput:
      "bg-white/5 border border-white/10 text-zinc-50 focus:border-teal-400/50",
    formButtonPrimary:
      "bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold",
    footerActionLink: "text-teal-300 hover:text-teal-200",
    identityPreviewEditButton: "text-teal-300",
  },
};
