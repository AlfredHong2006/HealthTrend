/**
 * Narrow, readable aliases over the generated OpenAPI types.
 *
 * `schema.d.ts` is generated (`npm run gen:api`) straight from the backend's committed
 * `openapi.json` and is deliberately never hand-edited. Its shapes are correct but verbose
 * (`paths["/api/demo/{scenario}"]["get"]["responses"][200]["content"]["application/json"]`),
 * so this module is the one place that indexes into it; every other module imports from here.
 */

import type { components } from "./schema.d.ts";

export type DemoAnalysis = components["schemas"]["DemoAnalysisResponse"];
export type DemoCatalogue = components["schemas"]["DemoCatalogueResponse"];
export type DemoScenario = components["schemas"]["DemoScenarioOut"];

export type CurrentEstimate = components["schemas"]["CurrentEstimateOut"];
export type Forecast = components["schemas"]["ForecastOut"];
export type ForecastPoint = components["schemas"]["ForecastPointOut"];
export type Observation = components["schemas"]["ObservationOut"];
export type TrajectoryPoint = components["schemas"]["TrajectoryPointOut"];

export type ErrorBody = components["schemas"]["ErrorBody"];
