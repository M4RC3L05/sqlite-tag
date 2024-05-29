import { SqlFragment, SqlFragmentIdentifier } from "./sql-fragments.ts";
import type { SqlBoundValues } from "./types.ts";

export const join = (
  values: SqlBoundValues[],
  glue: SqlFragment = new SqlFragment([", "], []),
) =>
  values
    .filter((v) => v !== undefined)
    .reduce(
      (acc, curr, index, array) =>
        new SqlFragment(["", "", "", ""], [
          acc,
          index === 0 || index === array.length ? undefined : glue,
          curr,
        ]),
    ) as SqlFragment;

export const eq = (value: [SqlBoundValues, SqlBoundValues]): SqlFragment =>
  value[0] === undefined || value[1] === undefined
    ? new SqlFragment([], [])
    : new SqlFragment(["", " = ", ""], [value[0], value[1]]);

export const joinObject = (
  value: Record<string, SqlBoundValues>,
  glue: SqlFragment = new SqlFragment([", "], []),
): SqlFragment =>
  join(
    Object.entries(value)
      .filter(([_, v]) => v !== undefined)
      .map((entry) => eq(entry)),
    glue,
  );

export const joinObjectIdentifiers = (
  value: Record<string, SqlBoundValues>,
  glue: SqlFragment = new SqlFragment([", "], []),
): SqlFragment =>
  join(
    Object.entries(value)
      .filter(([_, v]) => v !== undefined)
      .map((entry) => eq([new SqlFragmentIdentifier(entry[0]), entry[1]])),
    glue,
  );
