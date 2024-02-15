/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
export type SqlBoundIgnoredValues = undefined;
export type SqlBoundArrayValue = SqlBoundValues[];
export type SqlBoundPrimitiveValue = number | string | null | bigint | Buffer | NodeJS.TypedArray;
export type SqlBoundCustomValues = TSqlFragment | TSqlFragmentIdentifier | TSqlFragmentRaw;
export type SqlBoundValues = SqlBoundPrimitiveValue | SqlBoundArrayValue | SqlBoundCustomValues | SqlBoundIgnoredValues;
export type TSqlFragment = SqlFragment;
declare class SqlFragment {
    #private;
    constructor(strings: string[], args: SqlBoundValues[]);
    get query(): string;
    get params(): SqlBoundValues[];
    toString(pretty?: boolean): string;
}
export type TSqlFragmentIdentifier = SqlFragmentIdentifier;
declare class SqlFragmentIdentifier {
    #private;
    constructor(value: string);
    get value(): string;
}
export type TSqlFragmentRaw = SqlFragmentRaw;
declare class SqlFragmentRaw {
    #private;
    constructor(value: string | number);
    get value(): string;
}
/**
 * @example
 *
 * sql`select * from ${sql.id("foo")} where a = ${1} and b in ${[1, 2, 3]}`
 * // { query: 'select * from "foo" where a = ? and b in (?, ?, ?)', params: [1, 1, 2, 3] }
 */
export declare const sql: {
    (strings: TemplateStringsArray, ...args: SqlBoundValues[]): TSqlFragment;
    /**
     * @example
     *
     * sql`select * from ${sql.id("foo")}`
     * // { query: 'select * from "foo"', params: [] }
     *
     * sql`select * from ${sql.id("foo.bar")}`
     * // { query: 'select * from "foo"."bar"', params: [] }
     *
     * sql`select * from ${sql.id("foo.\"bar")}`
     * // { query: 'select * from "foo"."bar"', params: [] }
     */
    id(value: string): TSqlFragmentIdentifier;
    /**
     * @example
     *
     * sql`select ${sql.raw("(1 + 1)")}`
     * // { query: 'select (1 + 1)', params: [] }
     */
    raw(value: string | number): TSqlFragmentRaw;
    /**
     * @example
     *
     * sql`select ${sql.if(true, () => sql`(1 + 1)`)}`
     * // { query: 'select (1 + 1)', params: [] }
     *
     * sql`select ${sql.if(false, () => sql`(1 + 1)`)}`
     * // { query: 'select ', params: [] }
     */
    if(cond: boolean | (() => boolean), value: () => SqlBoundValues): SqlBoundValues;
    /**
     * @example
     *
     * sql`select ${sql.if(true, () => sql`(1 + 1)`, () => 1)}`
     * // { query: 'select (1 + 1)', params: [] }
     *
     * sql`select ${sql.if(false, () => sql`(1 + 1)`, () => 1)}`
     * // { query: 'select ?', params: [1] }
     */
    ternary(cond: boolean | (() => boolean), left: () => SqlBoundValues, right: () => SqlBoundValues): SqlBoundValues;
    eq: typeof sqlEq;
    join: typeof sqlJoin;
    /**
     * Undefined values will be filtered out.
     *
     * @example
     *
     * sql`update foo set ${sql.joinObject({ a: 1, b: sql.raw(2)})}`
     * // { query: 'update foo set ? = ?, ? = 2', params: ["a", 1, "b"] }
     */
    joinObject(values: Record<string, SqlBoundValues>, glue?: SqlFragment): SqlFragment;
    /**
     * Undefined values will be filtered out.
     *
     * @example
     *
     * sql`update foo set ${sql.set({ a: 1, b: sql.raw(2)})}`
     * // { query: 'update foo set "a" = ?, "b" = 2', params: [1] }
     */
    set(value: Record<string, SqlBoundValues>): SqlFragment;
    /**
     * Undefined values will be filtered out.
     *
     * @example
     *
     * sql`insert into foo ${sql.insert({ a: 1, b: sql.raw(2)})}`
     * // { query: 'insert into foo ("a", "b") values (?, 2)', params: [1] }
     */
    insert(data: Record<string, SqlBoundValues>): SqlFragment;
};
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where ${sql.eq([sql.id("foo"), 1])}`
 * // { query: 'select "foo" = ?', params: [1] }
 */
declare function sqlEq(data: [SqlBoundValues, SqlBoundValues]): SqlFragment;
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where ${sql.eq(sql.id("foo"), 1)}`
 * // { query: 'select "foo" = ?', params: [1] }
 */
declare function sqlEq(data: SqlBoundValues, data2: SqlBoundValues): SqlFragment;
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where  ${sql.join([sql`e = 1`, sql`e = ${2}`, 3])}`
 * // { query: 'select * from foo where e = 1 or e = ? or ?', params: [2, 3] }
 */
declare function sqlJoin(values: SqlBoundValues[], glue?: SqlFragment): SqlFragment;
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where  ${sql.join(undefined, sql`e = 1`, sql`e = ${2}`, 3)}`
 * // { query: 'select * from foo where e = 1 or e = ? or ?', params: [2, 3] }
 */
declare function sqlJoin(glue?: SqlFragment, ...values: SqlBoundValues[]): SqlFragment;
export {};
