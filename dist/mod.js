const join = (values, glue = sql`, `)=>values.filter((v)=>v !== undefined).reduce((acc, curr, index, array)=>sql`${acc}${index === 0 || index === array.length ? undefined : glue}${curr}`, undefined);
const eq = (value)=>sql`${value[0]} = ${value[1]}`;
const joinObject = (value, glue = new SqlFragment([
    ", "
], []))=>join(Object.entries(value).filter(([_, v])=>v !== undefined).map((entry)=>eq(entry)), glue);
const joinObjectIdentifiers = (value, glue = new SqlFragment([
    ", "
], []))=>join(Object.entries(value).filter(([_, v])=>v !== undefined).map((entry)=>eq([
            new SqlFragmentIdentifier(entry[0]),
            entry[1]
        ])), glue);
let SqlFragment = class SqlFragment {
    #query = "";
    #params = [];
    constructor(strings, args){
        this.#build(strings, args);
    }
    #buildPrimitive(arg) {
        this.#query += "?";
        this.#params.push(arg);
    }
    #buildCustom(arg) {
        this.#query += arg instanceof SqlFragment ? arg.query : arg.value;
        if (arg instanceof SqlFragment) {
            this.#params.push(...arg.params);
        }
    }
    #buildValue(value) {
        if (value instanceof SqlFragment || value instanceof SqlFragmentIdentifier || value instanceof SqlFragmentRaw) {
            this.#buildCustom(value);
        } else if (Array.isArray(value)) {
            this.#buildCustom(join([
                new SqlFragment([
                    "("
                ], []),
                join(value),
                new SqlFragment([
                    ")"
                ], [])
            ], new SqlFragment([], [])));
        } else if (value === undefined) {
        // ignore undefined values
        } else {
            this.#buildPrimitive(value);
        }
    }
    #build(strings, args) {
        for(let i = 0, size = strings.length; i < size; i += 1){
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
        return JSON.stringify({
            query: this.query,
            params: this.params
        }, (key, value)=>typeof value === "bigint" ? `${value.toString()}n` : value, pretty ? 2 : 0);
    }
};
let SqlFragmentIdentifier = class SqlFragmentIdentifier {
    #value = "";
    #escape(value) {
        return String(value).split(".").map((segment)=>`"${segment.trim().replaceAll('"', "")}"`).join(".");
    }
    constructor(value){
        this.#value = value;
    }
    get value() {
        return this.#escape(this.#value);
    }
};
let SqlFragmentRaw = class SqlFragmentRaw {
    #value;
    constructor(value){
        this.#value = value;
    }
    get value() {
        return String(this.#value);
    }
};
/**
 * @example
 *
 * sql`select * from ${sql.id("foo")} where a = ${1} and b in ${[1, 2, 3]}`
 * // { query: 'select * from "foo" where a = ? and b in (?, ?, ?)', params: [1, 1, 2, 3] }
 */ export const sql = (strings, ...args)=>new SqlFragment(Array.from(strings), args);
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
 */ sql.id = (value)=>new SqlFragmentIdentifier(value);
/**
 * @example
 *
 * sql`select ${sql.raw("(1 + 1)")}`
 * // { query: 'select (1 + 1)', params: [] }
 */ sql.raw = (value)=>new SqlFragmentRaw(value);
/**
 * @example
 *
 * sql`select ${sql.if(true, () => sql`(1 + 1)`)}`
 * // { query: 'select (1 + 1)', params: [] }
 *
 * sql`select ${sql.if(false, () => sql`(1 + 1)`)}`
 * // { query: 'select ', params: [] }
 */ sql.if = (cond, value)=>(typeof cond === "function" ? cond() : cond) ? value() : undefined;
/**
 * @example
 *
 * sql`select ${sql.if(true, () => sql`(1 + 1)`, () => 1)}`
 * // { query: 'select (1 + 1)', params: [] }
 *
 * sql`select ${sql.if(false, () => sql`(1 + 1)`, () => 1)}`
 * // { query: 'select ?', params: [1] }
 */ sql.ternary = (cond, left, right)=>(typeof cond === "function" ? cond() : cond) ? left() : right();
function sqlEq(data, data2) {
    // @ts-ignore
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    return eq(Array.isArray(data) && data2 === undefined ? data : [
        data,
        data2
    ]);
}
sql.eq = sqlEq;
function sqlJoin(arg1, arg2, ...args) {
    if (Array.isArray(arg1)) {
        return join(arg1, arg2 ?? sql`, `);
    }
    if (!arg1 || arg1 instanceof SqlFragment) {
        return join([
            arg2,
            ...args
        ], arg1 ?? sql`, `);
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
 */ sql.joinObject = (values, glue = sql`, `)=>joinObject(values, glue);
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`update foo set ${sql.set({ a: 1, b: sql.raw(2)})}`
 * // { query: 'update foo set "a" = ?, "b" = 2', params: [1] }
 */ sql.set = (value)=>joinObjectIdentifiers(value);
/**
 * Undefined values will be filtered out.
 *
 * @example
 *
 * sql`insert into foo ${sql.insert({ a: 1, b: sql.raw(2)})}`
 * // { query: 'insert into foo ("a", "b") values (?, 2)', params: [1] }
 */ sql.insert = (data)=>{
    const filtered = Object.fromEntries(Object.entries(data).filter(([_, v])=>v !== undefined));
    return sql`(${join(Object.keys(filtered).map((key)=>new SqlFragmentIdentifier(key)))}) values (${join(Object.values(filtered))})`;
};

