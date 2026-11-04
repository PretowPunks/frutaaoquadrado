import { describe, expect, it } from "vitest";
import {
  customerAddress,
  customerPayload,
  customerToForm,
  emptyCustomerForm,
  maskPhone,
  validateCustomer,
} from "./customer";

describe("customer registration", () => {
  it("requires only the name and sends missing optional fields as null", () => {
    const form = { ...emptyCustomerForm, name: " Allisson de Andrade da Silva " };
    expect(validateCustomer(form)).toBeNull();
    expect(validateCustomer(emptyCustomerForm)).not.toBeNull();
    expect(customerPayload(form)).toEqual({
      name: "Allisson de Andrade da Silva",
      phone: null,
      document_number: null,
      street: null,
      address_number: null,
      neighborhood: null,
      city: null,
      address: null,
    });
  });
  it("still validates phone and document when supplied", () => {
    const form = { ...emptyCustomerForm, name: "Allisson" };
    expect(validateCustomer({ ...form, phone: "123" })).not.toBeNull();
    expect(validateCustomer({ ...form, documentNumber: "123" })).not.toBeNull();
    expect(
      validateCustomer({ ...form, phone: "(75) 99999-9999", documentNumber: "123.456.789-00" }),
    ).toBeNull();
    expect(maskPhone("")).toBe("");
  });
  it("allows editing existing fields and clearing optional values", () => {
    const customer = {
      id: "c1",
      owner_id: "owner1",
      ...customerPayload({
        ...emptyCustomerForm,
        name: "Allisson",
        phone: "(75) 99999-9999",
        street: "Rua Nova",
        city: "Salvador",
      }),
    };
    const edited = { ...customerToForm(customer), name: "Allisson Silva", phone: "", city: "" };
    expect(customerPayload(edited)).toMatchObject({
      name: "Allisson Silva",
      phone: null,
      city: null,
      address: "Rua Nova",
    });
    expect(customerAddress(customer)).toBe("Rua Nova — Salvador");
  });
});
