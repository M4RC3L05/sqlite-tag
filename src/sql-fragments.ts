import type {
  SqlBoundCustomValues,
  SqlBoundPrimitiveValue,
  SqlBoundValues,
} from "./types.ts";
import { join } from "./utils.ts";

export class SqlFragmentIdentifier {
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

  get value(): string {
    return this.#escape(this.#value);
  }
}

export class SqlFragmentRaw {
  #value: string | number;

  constructor(value: string | number) {
    this.#value = value;
  }

  get value(): string {
    return String(this.#value);
  }
}

export class SqlFragment {
  #query = "";
  #params: SqlBoundValues[] = [];

  constructor(strings: string[], args: SqlBoundValues[]) {
    this.#build(strings, args);
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

  #build(strings: string[], args: SqlBoundValues[]) {
    for (let i = 0, size = strings.length; i < size; i += 1) {
      const segment = strings[i];
      const arg = args[i];

      this.#query += segment;

      if (i > args.length) continue;

      this.#buildValue(arg);
    }
  }

  get query(): string {
    return this.#query;
  }

  get params(): SqlBoundValues[] {
    return this.#params;
  }

  toString(pretty = false): string {
    return JSON.stringify(
      { query: this.query, params: this.params },
      (_, value) => typeof value === "bigint" ? `${value.toString()}n` : value,
      pretty ? 2 : 0,
    );
  }
}
