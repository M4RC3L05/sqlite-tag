export type SqlBoundIgnoredValues = undefined;
export type SqlBoundArrayValue = SqlBoundValues[];
export type SqlBoundPrimitiveValue =
  | number
  | string
  | null
  | bigint
  | Buffer
  | NodeJS.TypedArray;
export type SqlBoundCustomValues =
  | TSqlFragment
  | TSqlFragmentIdentifier
  | TSqlFragmentRaw;
export type SqlBoundValues =
  | SqlBoundPrimitiveValue
  | SqlBoundArrayValue
  | SqlBoundCustomValues
  | SqlBoundIgnoredValues;

const join = (values: SqlBoundValues[], glue: SqlFragment = sql`, `) =>
  values
    .filter((v) => v !== undefined)
    .reduce(
      (acc, curr, index, array) =>
        sql`${acc}${
          index === 0 || index === array.length ? undefined : glue
        }${curr}`,
      undefined,
    ) as SqlFragment;

const eq = (value: [SqlBoundValues, SqlBoundValues]) =>
  sql`${value[0]} = ${value[1]}`;

const joinObject = (
  value: Record<string, SqlBoundValues>,
  glue = new SqlFragment([", "], []),
) =>
  join(
    Object.entries(value)
      .filter(([_, v]) => v !== undefined)
      .map((entry) => eq(entry)),
    glue,
  );

const joinObjectIdentifiers = (
  value: Record<string, SqlBoundValues>,
  glue = new SqlFragment([", "], []),
) =>
  join(
    Object.entries(value)
      .filter(([_, v]) => v !== undefined)
      .map((entry) => eq([new SqlFragmentIdentifier(entry[0]), entry[1]])),
    glue,
  );

export type TSqlFragment = SqlFragment;

class SqlFragment {
  #query = "";
  #params: SqlBoundValues[] = [];

  constructor(strings: string[], args: SqlBoundValues[]) {
    this.#build(strings, args);
  }

  #buildPrimitive(arg: SqlBoundPrimitiveValue) {
    this.#query += "?";
    this.#params.push(arg);
  }

  #buildCustom(arg: SqlBoundCustomValues) {
    this.#query += arg instanceof SqlFragment ? arg.query : arg.value;

    if (arg instanceof SqlFragment) {
      this.#params.push(...arg.params);
    }
  }

  #buildValue(value: SqlBoundValues) {
    if (
      value instanceof SqlFragment ||
      value instanceof SqlFragmentIdentifier ||
      value instanceof SqlFragmentRaw
    ) {
      this.#buildCustom(value);
    } else if (Array.isArray(value)) {
      this.#buildCustom(
        join(
          [new SqlFragment(["("], []), join(value), new SqlFragment([")"], [])],
          new SqlFragment([], []),
        ),
      );
    } else if (value === undefined) {
      // ignore undefined values
    } else {
      this.#buildPrimitive(value);
    }
  }

  #build(strings: string[], args: SqlBoundValues[]) {
    for (let i = 0, size = strings.length; i < size; i += 1) {
      const segment = strings[i];
      const arg = args[i];

      this.#query += segment;

      if (i > args.length) continue;

      this.#buildValue(arg);
    }
  }

  get query() {
    return this.#query;
  }

  get params() {
    return this.#params;
  }

  toString(pretty = false) {
    return JSON.stringify(
      { query: this.query, params: this.params },
      (key, value) =>
        typeof value === "bigint" ? `${value.toString()}n` : value,
      pretty ? 2 : 0,
    );
  }
}

export type TSqlFragmentIdentifier = SqlFragmentIdentifier;

class SqlFragmentIdentifier {
  #value = "";

  #escape(value: string) {
    return String(value)
      .split(".")
      .map((segment) => `"${segment.trim().replaceAll('"', "")}"`)
      .join(".");
  }

  constructor(value: string) {
    this.#value = value;
  }

  get value() {
    return this.#escape(this.#value);
  }
}

export type TSqlFragmentRaw = SqlFragmentRaw;

class SqlFragmentRaw {
  #value: string | number;

  constructor(value: string | number) {
    this.#value = value;
  }

  get value() {
    return String(this.#value);
  }
}

/**
 * @example
 *
 * sql`select * from ${sql.id("foo")} where a = ${1} and b in ${[1, 2, 3]}`
 * // { query: 'select * from "foo" where a = ? and b in (?, ?, ?)', params: [1, 1, 2, 3] }
 */
export const sql = (
  strings: TemplateStringsArray,
  ...args: SqlBoundValues[]
): TSqlFragment => new SqlFragment(Array.from(strings), args);

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
sql.id = (value: string): TSqlFragmentIdentifier =>
  new SqlFragmentIdentifier(value);

/**
 * @example
 *
 * sql`select ${sql.raw("(1 + 1)")}`
 * // { query: 'select (1 + 1)', params: [] }
 */
sql.raw = (value: string | number): TSqlFragmentRaw =>
  new SqlFragmentRaw(value);

/**
 * @example
 *
 * sql`select ${sql.if(true, () => sql`(1 + 1)`)}`
 * // { query: 'select (1 + 1)', params: [] }
 *
 * sql`select ${sql.if(false, () => sql`(1 + 1)`)}`
 * // { query: 'select ', params: [] }
 */
sql.if = (cond: boolean | (() => boolean), value: () => SqlBoundValues) =>
  (typeof cond === "function" ? cond() : cond) ? value() : undefined;

/**
 * @example
 *
 * sql`select ${sql.if(true, () => sql`(1 + 1)`, () => 1)}`
 * // { query: 'select (1 + 1)', params: [] }
 *
 * sql`select ${sql.if(false, () => sql`(1 + 1)`, () => 1)}`
 * // { query: 'select ?', params: [1] }
 */
sql.ternary = (
  cond: boolean | (() => boolean),
  left: () => SqlBoundValues,
  right: () => SqlBoundValues,
) => ((typeof cond === "function" ? cond() : cond) ? left() : right());

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where ${sql.eq([sql.id("foo"), 1])}`
 * // { query: 'select "foo" = ?', params: [1] }
 */
function sqlEq(data: [SqlBoundValues, SqlBoundValues]): SqlFragment;
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where ${sql.eq(sql.id("foo"), 1)}`
 * // { query: 'select "foo" = ?', params: [1] }
 */
function sqlEq(data: SqlBoundValues, data2: SqlBoundValues): SqlFragment;
function sqlEq(data: SqlBoundValues, data2?: SqlBoundValues) {
  // @ts-ignore
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  return eq(Array.isArray(data) && data2 === undefined ? data : [data, data2!]);
}
sql.eq = sqlEq;

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where  ${sql.join([sql`e = 1`, sql`e = ${2}`, 3])}`
 * // { query: 'select * from foo where e = 1 or e = ? or ?', params: [2, 3] }
 */
function sqlJoin(values: SqlBoundValues[], glue?: SqlFragment): SqlFragment;
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`select * from foo where  ${sql.join(undefined, sql`e = 1`, sql`e = ${2}`, 3)}`
 * // { query: 'select * from foo where e = 1 or e = ? or ?', params: [2, 3] }
 */
function sqlJoin(glue?: SqlFragment, ...values: SqlBoundValues[]): SqlFragment;
function sqlJoin(
  arg1?: SqlBoundValues[] | SqlFragment,
  arg2?: SqlBoundValues | SqlFragment,
  ...args: SqlBoundValues[]
) {
  if (Array.isArray(arg1)) {
    return join(arg1, (arg2 as SqlFragment) ?? sql`, `);
  }

  if (!arg1 || arg1 instanceof SqlFragment) {
    return join([arg2 as SqlBoundValues, ...args], arg1 ?? sql`, `);
  }

  throw new TypeError("Invalid arguments");
}

sql.join = sqlJoin;

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`update foo set ${sql.joinObject({ a: 1, b: sql.raw(2)})}`
 * // { query: 'update foo set ? = ?, ? = 2', params: ["a", 1, "b"] }
 */
sql.joinObject = (values: Record<string, SqlBoundValues>, glue = sql`, `) =>
  joinObject(values, glue);

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`update foo set ${sql.set({ a: 1, b: sql.raw(2)})}`
 * // { query: 'update foo set "a" = ?, "b" = 2', params: [1] }
 */
sql.set = (value: Record<string, SqlBoundValues>) =>
  joinObjectIdentifiers(value);

/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`insert into foo ${sql.insert({ a: 1, b: sql.raw(2)})}`
 * // { query: 'insert into foo ("a", "b") values (?, 2)', params: [1] }
 */
sql.insert = (data: Record<string, SqlBoundValues>) => {
  const filtered = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined),
  );

  return sql`(${join(
    Object.keys(filtered).map((key) => new SqlFragmentIdentifier(key)),
  )}) values (${join(Object.values(filtered))})`;
};
