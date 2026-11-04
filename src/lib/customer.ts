export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  document_number: string | null;
  street: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  address: string | null;
  owner_id: string | null;
};

export type CustomerForm = {
  name: string;
  phone: string;
  documentNumber: string;
  street: string;
  addressNumber: string;
  neighborhood: string;
  city: string;
};

export const emptyCustomerForm: CustomerForm = {
  name: "",
  phone: "",
  documentNumber: "",
  street: "",
  addressNumber: "",
  neighborhood: "",
  city: "",
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return digits.replace(/^(\d{0,2})/, "($1");
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d+)/, "($1) $2");
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3");
  return digits.replace(/^(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
}

export function maskDocument(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function normalizeCity(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function customerAddress(customer: Customer) {
  return formatCustomerAddress(customer) || customer.address || "—";
}

export function validateCustomer(form: CustomerForm) {
  if (!form.name.trim()) return "Informe o nome do cliente";
  const phoneLength = onlyDigits(form.phone).length;
  if (form.phone.trim() && phoneLength !== 10 && phoneLength !== 11)
    return "Informe um telefone válido";
  const documentLength = onlyDigits(form.documentNumber).length;
  if (form.documentNumber.trim() && documentLength !== 11 && documentLength !== 14)
    return "Informe um CPF ou CNPJ válido";
  return null;
}

function formatCustomerAddress(customer: {
  street: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
}) {
  return [
    [customer.street, customer.address_number].filter(Boolean).join(", "),
    [customer.neighborhood, customer.city].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" — ");
}

export function customerPayload(form: CustomerForm) {
  const nullable = (value: string) => value.trim() || null;
  const fields = {
    name: form.name.trim(),
    phone: nullable(form.phone),
    document_number: nullable(form.documentNumber),
    street: nullable(form.street),
    address_number: nullable(form.addressNumber),
    neighborhood: nullable(form.neighborhood),
    city: nullable(form.city),
  };
  return { ...fields, address: formatCustomerAddress(fields) || null };
}

export function customerToForm(customer: Customer): CustomerForm {
  return {
    name: customer.name,
    phone: customer.phone ?? "",
    documentNumber: customer.document_number ?? "",
    street: customer.street ?? "",
    addressNumber: customer.address_number ?? "",
    neighborhood: customer.neighborhood ?? "",
    city: customer.city ?? "",
  };
}
