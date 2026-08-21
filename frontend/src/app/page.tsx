import { redirect } from "next/navigation";

const DEFAULT_SCENARIO = "gradual-loss";

/** Acceptance criterion: opening `/` lands on a scenario with no further interaction. */
export default function RootPage() {
  redirect(`/demo/${DEFAULT_SCENARIO}`);
}
