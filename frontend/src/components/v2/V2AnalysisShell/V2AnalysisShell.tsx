"use client";

import { useState } from "react";
import { V2Header } from "@/components/v2/V2Header/V2Header";
import { V2Workspace } from "@/components/v2/V2Workspace/V2Workspace";
import { DEFAULT_DISPLAY_UNIT, type DisplayUnit } from "@/lib/v2/units";
import type { AnalysisResponse, DemoScenario } from "@/lib/api/types";

interface V2AnalysisShellProps {
  /** Which nav item reads as current -- "analysis" for a demo scenario, "analyse" for real data. */
  current: "analysis" | "analyse";
  analysis: AnalysisResponse;
  /** The scenario switcher's contents, on a demo analysis page only. */
  scenarios?: DemoScenario[];
  activeId?: string;
  scenario?: DemoScenario;
}

/**
 * The client-side owner of the one piece of display state the header and the workspace both
 * need: the kg/lb toggle. The frozen design reserves a slot for it beside the header's badge
 * (docs/design/09_1B_Implementation_Spec, "digits={5} so switching kg to lb moves nothing"), but
 * the mock never renders a control for it -- the prop exists only for the design tool's own
 * preview. Placing a real one in the header, next to the provenance badge it already reserves
 * space around, needs a component above both `V2Header` and `V2Workspace` to own the state, since
 * the page route that renders them is a server component and cannot hold client state itself.
 *
 * `analysis` is the plain `AnalysisResponse` shape both a generated demo scenario and a real
 * submitted-data analysis satisfy -- `DemoAnalysisResponse` carries one extra field
 * (`scenario`), so this shell takes that as a separate, optional prop rather than reading it off
 * `analysis` itself, which is what lets `/v2/analyse` (docs/design real-user-data entry point)
 * reuse this exact shell and `V2Workspace` for a real analysis with no second implementation.
 *
 * The unit is display-only and ephemeral, the same as the goal: nothing here is stored, and every
 * value `V2Workspace` reads from `analysis` stays in kilograms until the last formatting step
 * (docs/privacy.md).
 */
export function V2AnalysisShell({
  current,
  analysis,
  scenarios,
  activeId,
  scenario,
}: V2AnalysisShellProps) {
  const [unit, setUnit] = useState<DisplayUnit>(DEFAULT_DISPLAY_UNIT);

  return (
    <>
      <V2Header
        current={current}
        scenarios={scenarios}
        activeId={activeId}
        meta={analysis.meta}
        scenario={scenario}
        unit={unit}
        onUnitChange={setUnit}
      />
      <V2Workspace analysis={analysis} unit={unit} />
    </>
  );
}
