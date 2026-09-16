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
  if (customer.street && customer.address_number && customer.neighborhood && customer.city) {
    return `${customer.street}, ${customer.address_number} — ${customer.neighborhood}, ${customer.city}`;
  }
  return customer.address || "—";
}

export function validateCustomer(form: CustomerForm) {
  if (Object.values(form).some((value) => !value.trim()))
    return "Preencha todos os campos obrigatórios";
  const phoneLength = onlyDigits(form.phone).length;
  if (phoneLength !== 10 && phoneLength !== 11) return "Informe um telefone válido";
  const documentLength = onlyDigits(form.documentNumber).length;
  if (documentLength !== 11 && documentLength !== 14) return "Informe um CPF ou CNPJ válido";
  return null;
}
