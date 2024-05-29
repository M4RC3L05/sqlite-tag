import {
  SqlFragment,
  SqlFragmentIdentifier,
  SqlFragmentRaw,
} from "./sql-fragments.ts";
import type {
  SqlBoundArrayValue,
  SqlBoundCustomValues,
  SqlBoundIgnoredValues,
  SqlBoundPrimitiveValue,
  SqlBoundValues,
} from "./types.ts";
import { eq, join, joinObject, joinObjectIdentifiers } from "./utils.ts";

/**
 * @example
 *
 * ```ts
 * sql`select * from ${sql.id("foo")}`
 * // { query: 'select * from "foo"', params: [] }
 *
 * sql`select * from ${sql.id("foo.bar")}`
 * // { query: 'select * from "foo"."bar"', params: [] }
 *
 * sql`select * from ${sql.id("foo.\"bar")}`
 * // { query: 'select * from "foo"."bar"', params: [] }
 * ```
 */
export const sqlId = (value: string): SqlFragmentIdentifier =>
  new SqlFragmentIdentifier(value);

/**
 * @example
 *
 * ```ts
 * sql`select ${sql.raw("(1 + 1)")}`
 * // { query: 'select (1 + 1)', params: [] }
 * ```
 */
export const sqlRaw = (value: string | number): SqlFragmentRaw =>
  new SqlFragmentRaw(value);

/**
 * @example
 *
 * ```ts
 * sql`select ${sql.if(true, () => sql`(1 + 1)`)}`
 * // { query: 'select (1 + 1)', params: [] }
 *
 * sql`select ${sql.if(false, () => sql`(1 + 1)`)}`
 * // { query: 'select ', params: [] }
 *
 * sql`select ${sql.if(false, sql`(1 + 1)`)}`
 * // { query: 'select ', params: [] }
 * ```
 */
export const sqlIf = (
  cond: boolean | (() => boolean),
  value: SqlBoundValues | (() => SqlBoundValues),
): SqlBoundValues =>
  (typeof cond === "function" ? cond() : cond)
    ? (typeof value === "function" ? value() : value)
    : undefined;

/**
 * @example
 *
 * ```ts
 * sql`select ${sql.if(true, () => sql`(1 + 1)`, () => 1)}`
 * // { query: 'select (1 + 1)', params: [] }
 *
 * sql`select ${sql.if(false, () => sql`(1 + 1)`, () => 1)}`
 * // { query: 'select ?', params: [1] }
 *
 * sql`select ${sql.if(false, sql`(1 + 1)`, 1)}`
 * // { query: 'select ?', params: [1] }
 * ```
 */
export const sqlTernary = (
  cond: boolean | (() => boolean),
  left: SqlBoundValues | (() => SqlBoundValues),
  right: SqlBoundValues | (() => SqlBoundValues),
): SqlBoundValues => ((typeof cond === "function" ? cond() : cond)
  ? typeof left === "function" ? left() : left
  : typeof right === "function"
  ? right()
  : right);

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * ```ts
 * sql`select * from foo where ${sql.eq([sql.id("foo"), 1])}`
 * // { query: 'select "foo" = ?', params: [1] }
 *
 * sql`select * from foo where ${sql.eq(sql.id("foo"), 1)}`
 * // { query: 'select "foo" = ?', params: [1] }
 * ```
 */
export function sqlEq(data: [SqlBoundValues, SqlBoundValues]): SqlFragment;
export function sqlEq(
  data: SqlBoundValues,
  data2: SqlBoundValues,
): SqlFragment;
export function sqlEq(data: SqlBoundValues, data2?: SqlBoundValues) {
  // @ts-ignore: ts stuff
  return eq(Array.isArray(data) && data2 === undefined ? data : [data, data2!]);
}

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * ```ts
 * sql`select * from foo where  ${sql.join([sql`e = 1`, sql`e = ${2}`, 3])}`
 * // { query: 'select * from foo where e = 1, e = ?, ?', params: [2, 3] }
 *
 * sql`select * from foo where  ${sql.join(undefined, sql`e = 1`, sql`e = ${2}`, 3)}`
 * // { query: 'select * from foo where e = 1, e = ?, ?', params: [2, 3] }
 * ```
 */
export function sqlJoin(
  values: SqlBoundValues[],
  glue?: SqlFragment,
): SqlFragment;
export function sqlJoin(
  glue?: SqlFragment,
  ...values: SqlBoundValues[]
): SqlFragment;
export function sqlJoin(
  arg1?: SqlBoundValues[] | SqlFragment,
  arg2?: SqlBoundValues | SqlFragment,
  ...args: SqlBoundValues[]
): SqlFragment {
  if (Array.isArray(arg1)) {
    return join(arg1, (arg2 as SqlFragment) ?? sql`, `);
  }

  if (!arg1 || arg1 instanceof SqlFragment) {
    return join([arg2 as SqlBoundValues, ...args], arg1 ?? sql`, `);
  }

  throw new TypeError("Invalid arguments");
}

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * ```ts
 * sql`update foo set ${sql.joinObject({ a: 1, b: sql.raw(2)})}`
 * // { query: 'update foo set ? = ?, ? = 2', params: ["a", 1, "b"] }
 * ```
 */
export const sqlJoinObject = (
  values: Record<string, SqlBoundValues>,
  glue: SqlFragment = sql`, `,
): SqlFragment => joinObject(values, glue);

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * ```ts
 * sql`update foo set ${sql.set({ a: 1, b: sql.raw(2)})}`
 * // { query: 'update foo set "a" = ?, "b" = 2', params: [1] }
 * ```
 */
export const sqlSet = (value: Record<string, SqlBoundValues>): SqlFragment =>
  joinObjectIdentifiers(value);

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * ```ts
 * sql`insert into foo ${sql.insert({ a: 1, b: sql.raw(2)})}`
 * // { query: 'insert into foo ("a", "b") values (?, 2)', params: [1] }
 * ```
 */
export const sqlInsert = (
  data: Record<string, SqlBoundValues>,
): SqlFragment => {
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined),
  );

  return sql`(${
    join(
      Object.keys(filtered).map((key) => new SqlFragmentIdentifier(key)),
    )
  }) values (${join(Object.values(filtered))})`;
};

type Sql = {
  (strings: TemplateStringsArray, ...args: SqlBoundValues[]): SqlFragment;

  id: typeof sqlId;
  raw: typeof sqlRaw;
  if: typeof sqlIf;
  ternary: typeof sqlTernary;
  eq: typeof sqlEq;
  join: typeof sqlJoin;
  joinObject: typeof sqlJoinObject;
  set: typeof sqlSet;
  insert: typeof sqlInsert;
};

/**
 * SQL string tag.
 *
 * @example
 *
 * ```ts
 * sql`select * from ${sql.id("foo")} where a = ${1} and b in ${[1, 2, 3]}`
 * // { query: 'select * from "foo" where a = ? and b in (?, ?, ?)', params: [1, 1, 2, 3] }
 * ```
 */
export const sql: Sql = (
  strings: TemplateStringsArray,
  ...args: SqlBoundValues[]
): SqlFragment => new SqlFragment(Array.from(strings), args);

sql.id = sqlId;
sql.raw = sqlRaw;
sql.if = sqlIf;
sql.ternary = sqlTernary;
sql.eq = sqlEq;
sql.join = sqlJoin;
sql.joinObject = sqlJoinObject;
sql.set = sqlSet;
sql.insert = sqlInsert;

/**
 * Export types.
 */
export type {
  Sql,
  SqlBoundArrayValue,
  SqlBoundCustomValues,
  SqlBoundIgnoredValues,
  SqlBoundPrimitiveValue,
  SqlBoundValues,
  SqlFragment,
  SqlFragmentIdentifier,
  SqlFragmentRaw,
};
