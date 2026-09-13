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

// The manual-entry (non-demo) request/response pair: `POST /api/analyse`, called directly
// from the browser rather than from a demo server component.
export type AnalysisRequest = components["schemas"]["AnalysisRequest"];
export type AnalysisResponse = components["schemas"]["AnalysisResponse"];
export type ObservationIn = components["schemas"]["ObservationIn"];

// CSV import (`POST /api/ingest/csv`): a parsing step, not an analysis. `accepted` is
// `ObservationIn[]`, the same type above -- pass it straight into `AnalysisRequest.observations`.
export type CsvIngestResponse = components["schemas"]["CsvIngestResponse"];
export type CsvRowIssue = components["schemas"]["CsvRowIssue"];

// Passwordless auth (`POST /api/auth/code/request`, `POST /api/auth/code/verify`) and the
// signed-in account (`GET /api/me`, `GET /api/me/analysis`): the wire shapes `accountClient.ts`
// calls against. `GET /api/me/analysis` answers in the plain `AnalysisResponse` shape above,
// with `meta.source` reading `"account"`, so it needs no type of its own.
export type CodeRequestIn = components["schemas"]["CodeRequestIn"];
export type CodeVerifyIn = components["schemas"]["CodeVerifyIn"];
export type MeOut = components["schemas"]["MeOut"];

// Stored measurement CRUD (`GET/POST /api/me/measurements`, `PUT/DELETE
// /api/me/measurements/{id}`): create and update both take the same `ObservationIn` above.
export type MeasurementOut = components["schemas"]["MeasurementOut"];
export type MeasurementListOut = components["schemas"]["MeasurementListOut"];
export type MeasurementBatchOut = components["schemas"]["MeasurementBatchOut"];

// Account settings: display preference and the optional, analysis-neutral goal.
export type PreferencesIn = components["schemas"]["PreferencesIn"];
export type PreferencesOut = components["schemas"]["PreferencesOut"];
export type GoalIn = components["schemas"]["GoalIn"];
export type GoalOut = components["schemas"]["GoalOut"];
