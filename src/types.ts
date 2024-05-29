import type {
  SqlFragment,
  SqlFragmentIdentifier,
  SqlFragmentRaw,
} from "./sql-fragments.ts";

export type SqlBoundIgnoredValues = undefined;
export type SqlBoundArrayValue = SqlBoundValues[];
export type SqlBoundPrimitiveValue =
  | number
  | string
  | null
  | bigint
  // deno-lint-ignore no-explicit-any
  | ArrayLike<any>;
export type SqlBoundCustomValues =
  | SqlFragment
  | SqlFragmentIdentifier
  | SqlFragmentRaw;
export type SqlBoundValues =
  | SqlBoundPrimitiveValue
  | SqlBoundArrayValue
  | SqlBoundCustomValues
  | SqlBoundIgnoredValues;
