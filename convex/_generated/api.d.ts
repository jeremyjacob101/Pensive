/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as backupSnapshots from "../backupSnapshots.js";
import type * as baseSubIds from "../baseSubIds.js";
import type * as effectiveAmounts from "../effectiveAmounts.js";
import type * as expenses from "../expenses.js";
import type * as http from "../http.js";
import type * as incomings from "../incomings.js";
import type * as monthYears from "../monthYears.js";
import type * as notepad from "../notepad.js";
import type * as paybackHelpers from "../paybackHelpers.js";
import type * as paybackLinks from "../paybackLinks.js";
import type * as recurrings from "../recurrings.js";
import type * as savings from "../savings.js";
import type * as summaries from "../summaries.js";
import type * as tracking from "../tracking.js";
import type * as userOptions from "../userOptions.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  backupSnapshots: typeof backupSnapshots;
  baseSubIds: typeof baseSubIds;
  effectiveAmounts: typeof effectiveAmounts;
  expenses: typeof expenses;
  http: typeof http;
  incomings: typeof incomings;
  monthYears: typeof monthYears;
  notepad: typeof notepad;
  paybackHelpers: typeof paybackHelpers;
  paybackLinks: typeof paybackLinks;
  recurrings: typeof recurrings;
  savings: typeof savings;
  summaries: typeof summaries;
  tracking: typeof tracking;
  userOptions: typeof userOptions;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
