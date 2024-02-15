import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sql } from "./mod.ts";

describe("sql``", () => {
  it("should create a new sql fragment", () => {
    const s = sql`select * from foo`;

    assert.equal(
      s.toString(),
      JSON.stringify({ query: "select * from foo", params: [] }),
    );
  });

  it("should bind primitive sql values correctly", () => {
    const s = sql`select * from foo where a = ${1} and b = ${"foo"} and c is ${null} and d = ${10n} and e = ${Buffer.from(
      "",
    )} and f = ${new Uint8Array()} and g = ${undefined} and h in ${[1, "foo"]}`;

    assert.equal(
      s.toString(),
      JSON.stringify({
        query:
          "select * from foo where a = ? and b = ? and c is ? and d = ? and e = ? and f = ? and g =  and h in (?, ?)",
        params: [
          1,
          "foo",
          null,
          "10n",
          { type: "Buffer", data: [] },
          {},
          1,
          "foo",
        ],
      }),
    );
  });

  it("should bind custom sql values correctly", () => {
    const s = sql`select * from ${sql.id("foo.bar")} and ${sql.raw(
      "a-",
    )} = 'foo' and b = ${sql.if(true, () => 1)} ${sql.if(
      false,
      () => sql`c = 1`,
    )} and ${sql.eq([sql.id("d"), 2])} and ${sql.join(
      [sql`e = 1`, sql`e = ${2}`, 3, sql.raw(4)],
      sql` or `,
    )} and ${sql.joinObject({ a: 1, b: sql.raw(2) })} and ${sql.set({
      a: "b",
      b: 1,
      c: sql`1`,
      d: sql.id("foo.bar"),
    })} and (${sql.ternary(
      true,
      () => 1,
      () => sql.id("a.b.c"),
    )} or ${sql.ternary(
      false,
      () => 1,
      () => sql.id("a.b.c"),
    )}) and (${sql.insert({ foo: "bar", biz: sql`a`, buz: sql.raw("foo") })})`;

    assert.equal(
      s.toString(),
      JSON.stringify({
        query:
          'select * from "foo"."bar" and a- = \'foo\' and b = ?  and "d" = ? and e = 1 or e = ? or ? or 4 and ? = ?, ? = 2 and "a" = ?, "b" = ?, "c" = 1, "d" = "foo"."bar" and (? or "a"."b"."c") and (("foo", "biz", "buz") values (?, a, foo))',
        params: [1, 2, 2, 3, "a", 1, "b", "b", 1, 1, "bar"],
      }),
    );
  });
});

describe("sql.id()", () => {
  it("should escape identifier", () => {
    assert.equal(sql.id("").value, '""');
    assert.equal(sql.id("a").value, '"a"');
    assert.equal(sql.id("a.").value, '"a".""');
    assert.equal(sql.id("a.b").value, '"a"."b"');
    assert.equal(sql.id('"a').value, '"a"');
    assert.equal(sql.id('a".b').value, '"a"."b"');
    assert.equal(sql.id('a"."b"').value, '"a"."b"');
  });
});

describe("sql.raw()", () => {
  it("should just dump whatever it was passed to it", () => {
    assert.equal(sql.raw("a").value, "a");
    assert.equal(sql.raw(1).value, "1");
    assert.equal(sql.raw("a-.0").value, "a-.0");
  });
});

describe("sql.if()", () => {
  it("should return undefined if condition is false", () => {
    assert.equal(
      sql.if(false, () => 1),
      undefined,
    );
    assert.equal(
      sql.if(
        () => false,
        () => 1,
      ),
      undefined,
    );
  });

  it("should return the value if condition is true", () => {
    assert.equal(
      sql.if(true, () => 1),
      1,
    );
    assert.equal(
      sql.if(
        () => true,
        () => 1,
      ),
      1,
    );
  });
});

describe("sql.ternary", () => {
  it("should return right if condition is false", () => {
    assert.equal(
      sql.ternary(
        false,
        () => 1,
        () => 2,
      ),
      2,
    );
    assert.equal(
      sql.ternary(
        () => false,
        () => 1,
        () => 2,
      ),
      2,
    );
  });

  it("should return left if condition is true", () => {
    assert.equal(
      sql.ternary(
        true,
        () => 1,
        () => 2,
      ),
      1,
    );
    assert.equal(
      sql.ternary(
        () => true,
        () => 1,
        () => 2,
      ),
      1,
    );
  });
});

describe("sql.eq()", () => {
  describe("sql.eq([a, b])", () => {
    it("should join a tuple with `=`", () => {
      assert.equal(
        sql.eq([1, sql`bar`]).toString(),
        JSON.stringify({ query: "? = bar", params: [1] }),
      );
    });

    it("should handle undefined values", () => {
      assert.equal(
        sql.eq([null, sql`bar`]).toString(),
        JSON.stringify({ query: "? = bar", params: [null] }),
      );

      assert.equal(
        sql.eq([sql`bar`, null]).toString(),
        JSON.stringify({ query: "bar = ?", params: [null] }),
      );

      assert.equal(
        sql.eq([undefined, sql`bar`]).toString(),
        JSON.stringify({ query: " = bar", params: [] }),
      );

      assert.equal(
        sql.eq([sql`bar`, undefined]).toString(),
        JSON.stringify({ query: "bar = ", params: [] }),
      );
    });
  });

  describe("sql.eq(a, b)", () => {
    it("should join 2 args with `=`", () => {
      assert.equal(
        sql.eq([1, 2], sql`bar`).toString(),
        JSON.stringify({ query: "(?, ?) = bar", params: [1, 2] }),
      );
    });

    it("should handle undefined values", () => {
      assert.equal(
        sql.eq(null, sql`bar`).toString(),
        JSON.stringify({ query: "? = bar", params: [null] }),
      );

      assert.equal(
        sql.eq(sql`bar`, null).toString(),
        JSON.stringify({ query: "bar = ?", params: [null] }),
      );

      assert.equal(
        sql.eq(sql`bar`, undefined).toString(),
        JSON.stringify({ query: "bar = ", params: [] }),
      );

      assert.equal(
        sql.eq(undefined, sql`bar`).toString(),
        JSON.stringify({ query: " = bar", params: [] }),
      );
    });
  });
});

describe("sql.join()", () => {
  describe("sql.join([...x])", () => {
    it("should join values in array", () => {
      assert.equal(
        sql.join([1, null, undefined, sql.id("foo")]).toString(),
        JSON.stringify({ query: '?, ?, "foo"', params: [1, null] }),
      );
    });

    it("should join values in array with custom glue", () => {
      assert.equal(
        sql.join([1, null, undefined, sql.id("foo")], sql` and `).toString(),
        JSON.stringify({ query: '? and ? and "foo"', params: [1, null] }),
      );
    });
  });

  describe("sql.join(...x)", () => {
    it("should join values in variadic args", () => {
      assert.equal(
        sql.join(undefined, 1, null, undefined, sql.id("foo")).toString(),
        JSON.stringify({ query: '?, ?, "foo"', params: [1, null] }),
      );
    });

    it("should join values in variadic args with custom glue", () => {
      assert.equal(
        sql.join(sql` or `, 1, null, undefined, sql.id("foo")).toString(),
        JSON.stringify({ query: '? or ? or "foo"', params: [1, null] }),
      );
    });
  });
});

describe("sql.joinObject()", () => {
  it("should join object keys and values", () => {
    assert.equal(
      sql.joinObject({ a: 1, b: sql`foo`, c: null, d: undefined }).toString(),
      JSON.stringify({
        query: "? = ?, ? = foo, ? = ?",
        params: ["a", 1, "b", "c", null],
      }),
    );
  });

  it("should join object keys and values with custom glue", () => {
    assert.equal(
      sql
        .joinObject({ a: 1, b: sql`foo`, c: null, d: undefined }, sql` or `)
        .toString(),
      JSON.stringify({
        query: "? = ? or ? = foo or ? = ?",
        params: ["a", 1, "b", "c", null],
      }),
    );
  });
});

describe("sql.set()", () => {
  it("should join object keys and values and keys be identifiers", () => {
    assert.equal(
      sql.set({ a: 1, b: sql`foo`, c: null, d: undefined }).toString(),
      JSON.stringify({
        query: '"a" = ?, "b" = foo, "c" = ?',
        params: [1, null],
      }),
    );
  });
});

describe("sql.insert()", () => {
  it("should generate a sql insert from a object, using object keys as identifiers", () => {
    assert.equal(
      sql.insert({ a: 1, b: sql`foo`, c: null, d: undefined }).toString(),
      JSON.stringify({
        query: '("a", "b", "c") values (?, foo, ?)',
        params: [1, null],
      }),
    );
  });
});
