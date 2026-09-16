import type { Session, User } from "@supabase/supabase-js";
import {
  createMockDatabase,
  mockProfile,
  MOCK_SESSION_KEY,
  MOCK_STORAGE_KEY,
  type MockDatabase,
  type MockRole,
} from "@/lib/mock-data";

type Row = Record<string, any>;
type Result = { data: any; error: { message: string } | null; count?: number | null };
type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "INITIAL_SESSION" | "TOKEN_REFRESHED" | "USER_UPDATED";

const listeners = new Set<(event: AuthEvent, session: Session | null) => void>();
let memoryDb: MockDatabase | null = null;

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readDb(): MockDatabase {
  if (!storageAvailable()) return memoryDb ?? (memoryDb = createMockDatabase());
  const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
  if (!raw) {
    const seeded = createMockDatabase();
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
  try {
    return JSON.parse(raw) as MockDatabase;
  } catch {
    const seeded = createMockDatabase();
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeDb(db: MockDatabase) {
  memoryDb = db;
  if (storageAvailable()) window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("fruta2:mock-data"));
}

function currentProfile() {
  if (!storageAvailable()) return null;
  try {
    return JSON.parse(window.localStorage.getItem(MOCK_SESSION_KEY) ?? "null") as ReturnType<
      typeof mockProfile
    > | null;
  } catch {
    return null;
  }
}

function toUser(profile: ReturnType<typeof mockProfile>): User {
  return {
    id: profile.id,
    email: profile.email,
    app_metadata: { provider: "mock", role: profile.role },
    user_metadata: { full_name: profile.fullName },
    aud: "authenticated",
    created_at: new Date(0).toISOString(),
  } as User;
}

function toSession(profile: ReturnType<typeof mockProfile> | null): Session | null {
  if (!profile) return null;
  return {
    access_token: `mock-${profile.role}`,
    refresh_token: "mock",
    expires_in: 31536000,
    expires_at: Math.floor(Date.now() / 1000) + 31536000,
    token_type: "bearer",
    user: toUser(profile),
  } as Session;
}

function uid() {
  return currentProfile()?.id ?? null;
}

function randomId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function relationFor(table: string, row: Row, relation: string, db: MockDatabase) {
  if (relation === "products") return db.products.find((item) => item.id === row.product_id) ?? null;
  if (relation === "customers") return db.customers.find((item) => item.id === row.customer_id) ?? null;
  return null;
}

class MockQueryBuilder implements PromiseLike<Result> {
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private values: Row | Row[] | null = null;
  private filters: Array<(row: Row) => boolean> = [];
  private ordering: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private columns = "*";
  private returnRows = false;
  private head = false;
  private countMode = false;

  constructor(private readonly table: keyof MockDatabase) {}

  select(columns = "*", options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    this.returnRows = this.mode === "insert" || this.mode === "update";
    this.head = options?.head === true;
    this.countMode = options?.count === "exact";
    return this;
  }
  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.values = values;
    return this;
  }
  update(values: Row) {
    this.mode = "update";
    this.values = values;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    if (operator === "is") this.filters.push((row) => row[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push((row) => String(row[column] ?? "") >= String(value ?? ""));
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push((row) => String(row[column] ?? "") <= String(value ?? ""));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.ordering = { column, ascending: options?.ascending !== false };
    return this;
  }
  limit(value: number) {
    this.maxRows = value;
    return this;
  }
  async single() {
    const result = await this.execute();
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    return row
      ? { data: row, error: null }
      : { data: null, error: { message: "Registro não encontrado" } };
  }
  async maybeSingle() {
    const result = await this.execute();
    const row = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    return { data: row, error: null };
  }
  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matches(row: Row) {
    return this.filters.every((filter) => filter(row));
  }

  private decorate(rows: Row[], db: MockDatabase) {
    const relations = [...this.columns.matchAll(/(products|customers)\s*\(/g)].map((match) => match[1]);
    if (relations.length === 0) return rows;
    return rows.map((row) => ({
      ...row,
      ...Object.fromEntries(relations.map((name) => [name, relationFor(this.table, row, name, db)])),
    }));
  }

  private applySideEffects(db: MockDatabase, before: Row[], after: Row[]) {
    if (this.table === "stock_entries") {
      for (const row of after) {
        const product = db.products.find((item) => item.id === row.product_id);
        if (product) product.stock_quantity = Number(product.stock_quantity) + Number(row.quantity);
      }
      for (const row of before) {
        const product = db.products.find((item) => item.id === row.product_id);
        if (product)
          product.stock_quantity = Math.max(0, Number(product.stock_quantity) - Number(row.quantity));
      }
    }
    if (this.table === "sales") {
      for (const row of after) {
        if (row.status === "scheduled") continue;
        const product = db.products.find((item) => item.id === row.product_id);
        if (product)
          product.stock_quantity = Math.max(0, Number(product.stock_quantity) - Number(row.quantity));
      }
      for (const row of before) {
        if (row.status === "scheduled") continue;
        const product = db.products.find((item) => item.id === row.product_id);
        if (product) product.stock_quantity = Number(product.stock_quantity) + Number(row.quantity);
      }
    }
    if (this.table === "stock_transfers") {
      for (const row of after) {
        const product = db.products.find((item) => item.id === row.source_product_id);
        if (product)
          product.stock_quantity = Math.max(0, Number(product.stock_quantity) - Number(row.quantity));
      }
      for (const row of before) {
        const product = db.products.find((item) => item.id === row.source_product_id);
        if (product) product.stock_quantity = Number(product.stock_quantity) + Number(row.quantity);
      }
    }
  }

  private async execute(): Promise<Result> {
    const db = readDb();
    const tableRows = db[this.table] as Row[];
    if (!tableRows) return { data: null, error: { message: `Tabela local desconhecida: ${this.table}` } };

    if (this.mode === "insert") {
      const input = Array.isArray(this.values) ? this.values : [this.values ?? {}];
      const created = input.map((value) => ({
        id: value.id ?? randomId(),
        created_at: value.created_at ?? new Date().toISOString(),
        ...(this.table === "privacy_consents" ? { user_id: value.user_id ?? uid() } : {}),
        ...(this.table === "work_shifts" ? { user_id: value.user_id ?? uid() } : {}),
        ...value,
      }));
      tableRows.push(...created);
      this.applySideEffects(db, [], created);
      writeDb(db);
      return { data: this.returnRows ? this.decorate(created, db) : null, error: null };
    }

    const matched = tableRows.filter((row) => this.matches(row));
    if (this.mode === "update") {
      const before = matched.map((row) => ({ ...row }));
      for (const row of matched) Object.assign(row, this.values ?? {}, { updated_at: new Date().toISOString() });
      if (this.table === "sales") {
        for (let index = 0; index < matched.length; index += 1) {
          const previous = before[index];
          const current = matched[index];
          if (previous?.status === "scheduled" && current?.status !== "scheduled") {
            const product = db.products.find((item) => item.id === current?.product_id);
            if (product)
              product.stock_quantity = Math.max(
                0,
                Number(product.stock_quantity) - Number(current?.quantity),
              );
          } else if (previous?.status !== "scheduled" && current?.status === "scheduled") {
            const product = db.products.find((item) => item.id === current?.product_id);
            if (product)
              product.stock_quantity = Number(product.stock_quantity) + Number(current?.quantity);
          }
        }
      }
      writeDb(db);
      return { data: this.returnRows ? this.decorate(matched, db) : null, error: null };
    }
    if (this.mode === "delete") {
      this.applySideEffects(db, matched, []);
      db[this.table] = tableRows.filter((row) => !this.matches(row)) as never;
      if (this.table === "supplier_payments") {
        (db as Record<string, Row[]>).supplier_payment_items = (
          db.supplier_payment_items as Row[]
        ).filter((item) => !matched.some((payment) => payment.id === item.payment_id));
      }
      writeDb(db);
      return { data: null, error: null };
    }

    let rows = [...matched];
    if (this.ordering) {
      const { column, ascending } = this.ordering;
      rows.sort((a, b) => String(a[column] ?? "").localeCompare(String(b[column] ?? "")) * (ascending ? 1 : -1));
    }
    if (this.maxRows !== null) rows = rows.slice(0, this.maxRows);
    const count = this.countMode ? rows.length : null;
    return { data: this.head ? null : this.decorate(rows, db), error: null, count };
  }
}

export function mockSignIn(role: MockRole) {
  const profile = mockProfile(role);
  if (storageAvailable()) window.localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(profile));
  const session = toSession(profile);
  listeners.forEach((listener) => listener("SIGNED_IN", session));
  return session;
}

export function resetMockData() {
  writeDb(createMockDatabase());
}

export const supabase = {
  from(table: keyof MockDatabase) {
    return new MockQueryBuilder(table);
  },
  auth: {
    async getSession() {
      return { data: { session: toSession(currentProfile()) }, error: null };
    },
    async getUser() {
      const profile = currentProfile();
      return { data: { user: profile ? toUser(profile) : null }, error: null };
    },
    onAuthStateChange(callback: (event: AuthEvent, session: Session | null) => void) {
      listeners.add(callback);
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
    },
    async signOut(_options?: { scope?: "local" | "global" }) {
      if (storageAvailable()) window.localStorage.removeItem(MOCK_SESSION_KEY);
      listeners.forEach((listener) => listener("SIGNED_OUT", null));
      return { error: null };
    },
  },
  channel(..._args: unknown[]) {
    const channel = {
      on(..._args: unknown[]) {
        return channel;
      },
      subscribe(..._args: unknown[]) {
        if (typeof window !== "undefined") window.addEventListener("fruta2:mock-data", () => undefined);
        return channel;
      },
    };
    return channel;
  },
  removeChannel(_channel?: unknown) {},
};
