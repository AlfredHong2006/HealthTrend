import { redirect } from "next/navigation";

/** The prototype needs a series to draw; `/v2` alone lands on the same default `/` uses. */
export default function V2IndexPage() {
  redirect("/v2/gradual-loss");
}
