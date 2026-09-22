export type MockRole = "admin" | "user";

export const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
export const MOCK_REP_ID = "00000000-0000-4000-8000-000000000002";
export const MOCK_STORAGE_KEY = "fruta2:mock-database:v1";
export const MOCK_SESSION_KEY = "fruta2:mock-session:v1";

const now = () => new Date().toISOString();

export function createMockDatabase() {
  const products = [
    ["prod-abacaxi", "Abacaxi", 13, 18, 48, 8],
    ["prod-acerola", "Acerola", 12, 17, 32, 8],
    ["prod-caja", "Cajá", 14, 20, 18, 6],
    ["prod-goiaba", "Goiaba", 11, 16, 40, 8],
    ["prod-manga", "Manga", 12, 18, 24, 6],
    ["prod-maracuja", "Maracujá", 15, 22, 12, 6],
  ].map(([id, name, cost_price, sale_price, stock_quantity, low_stock_threshold]) => ({
    id,
    name,
    cost_price,
    sale_price,
    stock_quantity,
    low_stock_threshold,
    owner_id: null,
    created_at: now(),
  }));

  return {
    profiles: [
      { id: MOCK_ADMIN_ID, email: "matriz@fruta2.demo", full_name: "Matriz Fruta²" },
      { id: MOCK_REP_ID, email: "representante@fruta2.demo", full_name: "Ana Representante" },
    ],
    user_roles: [
      { id: "role-admin", user_id: MOCK_ADMIN_ID, role: "admin" },
      { id: "role-rep", user_id: MOCK_REP_ID, role: "user" },
    ],
    rep_invites: [
      {
        id: "invite-rep",
        email: "representante@fruta2.demo",
        name: "Ana Representante",
        cities: ["Feira de Santana", "Serrinha"],
        accepted_user_id: MOCK_REP_ID,
        accepted_at: now(),
        status: "active",
        invited_by: MOCK_ADMIN_ID,
        created_at: now(),
      },
    ],
    products,
    customers: [
      {
        id: "customer-1",
        name: "Mercadinho Central",
        phone: "(75) 99999-1001",
        document_number: "12.345.678/0001-90",
        street: "Rua das Flores",
        address_number: "120",
        neighborhood: "Centro",
        city: "Feira de Santana",
        address: "Rua das Flores, 120 — Centro, Feira de Santana",
        owner_id: MOCK_REP_ID,
        created_at: now(),
      },
      {
        id: "customer-2",
        name: "Padaria Bom Sabor",
        phone: "(75) 98888-2002",
        document_number: "123.456.789-09",
        street: "Avenida Brasil",
        address_number: "45",
        neighborhood: "Cidade Nova",
        city: "Serrinha",
        address: "Avenida Brasil, 45 — Cidade Nova, Serrinha",
        owner_id: MOCK_REP_ID,
        created_at: now(),
      },
    ],
    sales: [],
    stock_entries: [],
    supplier_payments: [],
    supplier_payment_items: [],
    representative_profit_payments: [],
    stock_transfers: [],
    privacy_consents: [],
    work_shifts: [],
    shift_route_points: [],
    data_backups: [{ id: "backup-demo", created_at: now() }],
  } satisfies Record<string, Array<Record<string, unknown>>>;
}

export type MockDatabase = ReturnType<typeof createMockDatabase>;

export function mockProfile(role: MockRole) {
  return role === "admin"
    ? { id: MOCK_ADMIN_ID, email: "matriz@fruta2.demo", fullName: "Matriz Fruta²", role }
    : {
        id: MOCK_REP_ID,
        email: "representante@fruta2.demo",
        fullName: "Ana Representante",
        role,
      };
}
