const MISSING_LEGAL_VALUE = "De completat inainte de lansare";

function publicLegalValue(name, fallback = MISSING_LEGAL_VALUE) {
  return String(process.env[name] || "").trim() || fallback;
}

export const legalDetails = {
  operatorName: publicLegalValue("NEXT_PUBLIC_LEGAL_OPERATOR_NAME", "Nota 5+"),
  operatorAddress: publicLegalValue("NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS"),
  registrationId: publicLegalValue("NEXT_PUBLIC_LEGAL_REGISTRATION_ID"),
  contactEmail: publicLegalValue("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL")
};

export function getLegalContactHref() {
  return legalDetails.contactEmail === MISSING_LEGAL_VALUE
    ? null
    : `mailto:${legalDetails.contactEmail}`;
}
